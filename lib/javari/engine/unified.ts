import { normalizePayload } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider } from "@/lib/javari/providers";
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

  // Load provider instance
  const provider = await getProvider(providerName);
  if (!provider) {
    return normalizePayload({
      messages: [
        {
          role: "assistant",
          content: "I\'m Javari — I\'m temporarily unavailable. Please try again in a moment."
        }
      ],
      success: false,
      error: "Missing provider instance"
    });
  }

  // === AVATAR STATE HOOKS ===
  const emitState = (state: string) => {
    console.log("AVATAR_STATE:", state);
  };

  emitState("thinking");

  // === GENERATE RESPONSE ===
  const response = await provider.generateStream({
    messages: finalMessages,
    model: modelName,
    files
  });

  emitState("speaking");

  // === NORMALIZE OUTPUT ===
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
