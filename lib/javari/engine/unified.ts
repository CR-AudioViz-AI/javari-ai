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
  // Javari identity system prompt — prepended to ALL provider calls.
  // This ensures every underlying model responds as Javari, not as itself.
  const javariSystemMessage: Message = {
    role: "system",
    content: JAVARI_SYSTEM_PROMPT
  };

  // Persona overlay appended after the identity lock
  const personaOverlays: Record<string, string> = {
    default: "",
    friendly: "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, engineering-focused.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher: "Tone: patient, clear, step-by-step educational."
  };

  const personaOverlay = personaOverlays[persona] ?? "";

  // Build final message array: identity lock → persona → conversation
  const finalMessages: Message[] = [
    javariSystemMessage,
    ...(personaOverlay
      ? [{ role: "system" as const, content: personaOverlay }]
      : []),
    ...messages
  ];

  // Build routing context from the latest user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const routingContext: RoutingContext = {
    prompt: lastUserMessage?.content ?? "",
    mode: "single"
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
          content: "Javari is temporarily unavailable. Please try again in a moment."
        }
      ],
      success: false,
      error: "Missing provider instance"
    });
  }

  // Avatar state hooks
  const emitState = (state: string) => {
    console.log("AVATAR_STATE:", state);
  };

  emitState("thinking");

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
}
