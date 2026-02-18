import { normalizePayload } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { MODEL_REGISTRY } from "@/lib/javari/multi-ai/model-registry";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import type { Message } from "@/lib/types";
import type { AIProvider } from "@/lib/javari/router/types";

// Providers with confirmed working implementations.
const IMPLEMENTED_PROVIDERS = new Set<string>(["openai", "anthropic", "groq", "mistral", "openrouter"]);

// Priority fallback chain when router selects an unimplemented provider
const FALLBACK_CHAIN: Array<{ provider: AIProvider; model: string }> = [
  { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
  { provider: "openai",    model: "gpt-4o-mini" },
  { provider: "mistral",   model: "mistral-large-latest" },
  { provider: "groq",      model: "llama3-8b-8192" }
];

/**
 * Try each provider in the fallback chain until one works.
 * Returns the first provider+key pair that resolves successfully.
 */
function selectFallbackProvider(): { provider: AIProvider; model: string; apiKey: string } | null {
  for (const candidate of FALLBACK_CHAIN) {
    try {
      const apiKey = getProviderApiKey(candidate.provider);
      if (apiKey) return { ...candidate, apiKey };
    } catch {
      // key not set — try next
    }
  }
  return null;
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
  // Javari identity lock — all providers respond as Javari
  const javariSystemMessage: Message = {
    role: "system",
    content: JAVARI_SYSTEM_PROMPT
  };

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
    ...(personaOverlay ? [{ role: "system" as const, content: personaOverlay }] : []),
    ...messages
  ];

  // Route to best model
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const routingContext: RoutingContext = {
    prompt: lastUserMessage?.content ?? "",
    mode: "single"
  };

  const routingDecision = routeRequest(routingContext);
  let providerName = routingDecision.selectedModel.provider as AIProvider;
  let modelName = routingDecision.selectedModel.id;

  // If router selected an unimplemented provider, fall back
  if (!IMPLEMENTED_PROVIDERS.has(providerName)) {
    console.warn(`[Javari] Router selected unimplemented provider "${providerName}" — using fallback`);
    const fallback = selectFallbackProvider();
    if (!fallback) {
      return normalizePayload({
        messages: [{ role: "assistant", content: "Javari is temporarily unavailable. No providers are configured." }],
        success: false,
        error: "No implemented providers available"
      });
    }
    providerName = fallback.provider;
    modelName = fallback.model;
  }

  // Get API key — if missing for routed provider, fall back
  let apiKey: string;
  try {
    apiKey = getProviderApiKey(providerName);
  } catch {
    console.warn(`[Javari] API key missing for "${providerName}" — using fallback`);
    const fallback = selectFallbackProvider();
    if (!fallback) {
      return normalizePayload({
        messages: [{ role: "assistant", content: "Javari is temporarily unavailable. API keys are not configured." }],
        success: false,
        error: "API key not configured"
      });
    }
    providerName = fallback.provider;
    modelName = fallback.model;
    apiKey = fallback.apiKey;
  }

  const provider = getProvider(providerName, apiKey);

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
