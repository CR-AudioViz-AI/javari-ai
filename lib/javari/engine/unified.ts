import { normalizePayload } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import type { Message } from "@/lib/types";

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
  // Javari identity system prompt — prepended to ALL provider calls
  const identityMessage: Message = {
    role: "system",
    content: JAVARI_SYSTEM_PROMPT
  };

  // Persona overlay (appended after identity, not replacing it)
  const personaOverlays: Record<string, string> = {
    default: "",
    friendly: "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, senior-engineer level.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher: "Tone: patient, clear, educational."
  };

  const personaOverlay = personaOverlays[persona] || "";
  const finalMessages: Message[] = personaOverlay
    ? [
        identityMessage,
        { role: "system", content: personaOverlay },
        ...messages
      ]
    : [identityMessage, ...messages];

  // Build routing context from the latest user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const routingContext: RoutingContext = {
    prompt: lastUserMessage?.content ?? "",
    mode: "single",
  };

  // Route to best provider + model
  const routingDecision = routeRequest(routingContext);
  const providerName = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  // Get API key for selected provider
  let apiKey: string;
  try {
    apiKey = getProviderApiKey(providerName as Parameters<typeof getProviderApiKey>[0]);
  } catch {
    // Fallback to anthropic if selected provider key is missing
    try {
      apiKey = getProviderApiKey("anthropic");
      const fallbackProvider = getProvider("anthropic", apiKey);
      return runProvider(fallbackProvider, "claude-3-5-haiku-20241022", finalMessages, "anthropic", files);
    } catch {
      return normalizePayload({
        messages: [{ role: "assistant", content: "I'm Javari — no AI providers are currently available. Please check API keys." }],
        success: false,
        error: "No provider keys available"
      });
    }
  }

  // Load provider instance
  const provider = getProvider(providerName as Parameters<typeof getProvider>[0], apiKey);

  return runProvider(provider, modelName, finalMessages, providerName, files);
}

async function runProvider(
  provider: ReturnType<typeof getProvider>,
  modelName: string,
  finalMessages: Message[],
  providerName: string,
  files: unknown[]
) {
  const emitState = (state: string) => {
    console.log("AVATAR_STATE:", state);
  };

  emitState("thinking");

  try {
    const response = await provider.generateStream({
      messages: finalMessages,
      model: modelName,
      files
    });

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
  } catch (err: unknown) {
    emitState("idle");
    const message = err instanceof Error ? err.message : "Unknown error";
    return normalizePayload({
      messages: [{ role: "assistant", content: "I'm Javari — I encountered an error processing your request. Please try again." }],
      success: false,
      error: message
    });
  }
}
