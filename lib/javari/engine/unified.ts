import { normalizePayload } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { MODEL_REGISTRY } from "@/lib/javari/multi-ai/model-registry";
import { getProvider } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import type { Message } from "@/lib/types";

// Providers with confirmed working implementations.
// Routing is constrained to this list — unimplemented providers (google, etc.)
// are excluded to prevent "Provider X not implemented" runtime errors.
const IMPLEMENTED_PROVIDERS = new Set(["openai", "anthropic", "groq", "mistral", "openrouter"]);

/**
 * Select the best available model from implemented providers only.
 * Falls back through priority order: anthropic → openai → groq → mistral → openrouter
 */
function selectImplementedModel(): { providerName: string; modelName: string } {
  // Prefer claude-3-5-haiku as primary — confirmed working
  const preferred = [
    { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
    { provider: "openai",    model: "gpt-4o-mini" },
    { provider: "groq",      model: "llama3-8b-8192" },
    { provider: "mistral",   model: "mistral-large-latest" },
    { provider: "openrouter",model: "openai/gpt-4o-mini" }
  ];

  // Try registry first — find highest-priority model in implemented set
  const registryModels = Object.values(MODEL_REGISTRY)
    .filter(m => IMPLEMENTED_PROVIDERS.has(m.provider) && m.available)
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  if (registryModels.length > 0) {
    const best = registryModels[0];
    return { providerName: best.provider, modelName: best.id };
  }

  // Hard fallback
  return { providerName: preferred[0].provider, modelName: preferred[0].model };
}

export async function unifiedJavariEngine({
  messages = [],
  persona = "default",
  context = {},
  files = []
}: {
  messages?: Message[];
  persona?: string;
  context?: Record<string, unknown>;
  files?: unknown[];
}) {
  // Javari identity lock — prepended to ALL provider calls.
  // Every underlying model responds as Javari, never as itself.
  const javariSystemMessage: Message = {
    role: "system",
    content: JAVARI_SYSTEM_PROMPT
  };

  // Persona overlay
  const personaOverlays: Record<string, string> = {
    default: "",
    friendly: "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, engineering-focused.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher: "Tone: patient, clear, step-by-step educational."
  };

  const personaOverlay = personaOverlays[persona] ?? "";

  const finalMessages: Message[] = [
    javariSystemMessage,
    ...(personaOverlay
      ? [{ role: "system" as const, content: personaOverlay }]
      : []),
    ...messages
  ];

  // Route — then validate provider is implemented before loading
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const routingContext: RoutingContext = {
    prompt: lastUserMessage?.content ?? "",
    mode: "single"
  };

  const routingDecision = routeRequest(routingContext);
  let providerName = routingDecision.selectedModel.provider;
  let modelName = routingDecision.selectedModel.id;

  // If router selected an unimplemented provider, fall back to known-good selection
  if (!IMPLEMENTED_PROVIDERS.has(providerName)) {
    console.warn(`[Javari] Router selected unimplemented provider "${providerName}" — falling back`);
    const fallback = selectImplementedModel();
    providerName = fallback.providerName;
    modelName = fallback.modelName;
  }

  const provider = await getProvider(providerName);
  if (!provider) {
    // Last resort: try anthropic directly
    const lastResort = await getProvider("anthropic");
    if (!lastResort) {
      return normalizePayload({
        messages: [{ role: "assistant", content: "Javari is temporarily unavailable. Please try again in a moment." }],
        success: false,
        error: "No provider available"
      });
    }
    providerName = "anthropic";
    modelName = "claude-3-5-haiku-20241022";
    const response = await lastResort.generateStream({ messages: finalMessages, model: modelName, files });
    return normalizePayload({
      messages: response.messages,
      model: modelName,
      provider: providerName,
      metadata: { tokens: response.tokens, latency: response.latency, reasoning: [], sources: [], cost: null }
    });
  }

  const emitState = (state: string) => console.log("AVATAR_STATE:", state);

  emitState("thinking");
  const response = await provider.generateStream({ messages: finalMessages, model: modelName, files });
  emitState("speaking");

  const normalized = normalizePayload({
    messages: response.messages,
    model: modelName,
    provider: providerName,
    metadata: {
      tokens: response.tokens,
      latency: response.latency,
      reasoning: response.reasoningSteps || [],
      sources: response.sources || [],
      cost: response.cost || null
    }
  });

  emitState("idle");
  return normalized;
}
