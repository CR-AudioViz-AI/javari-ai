import { normalizePayload } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider } from "@/lib/javari/providers";
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
  // Persona templates determine tone & behavior
  const personaPrompts: Record<string, string> = {
    default: "You are Javari, an advanced AI assistant.",
    friendly: "You are Javari, warm, friendly, conversational.",
    developer: "You are Javari, a senior software engineer. Be precise.",
    executive: "You are Javari, concise, strategic, outcome-driven.",
    teacher: "You are Javari, patient, clear, educational."
  };

  const systemMessage: Message = {
    role: "system",
    content: personaPrompts[persona] || personaPrompts.default
  };

  // Create full message array
  const finalMessages: Message[] = [systemMessage, ...messages];

  // Build routing context from the latest user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const routingContext: RoutingContext = {
    prompt: lastUserMessage?.content ?? "",
    mode: "single",
  };

  // Route to best provider + model using routeRequest
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
          content: "Provider unavailable. Please try again."
        }
      ],
      success: false,
      error: "Missing provider instance"
    });
  }

  // === STREAMING HOOKS FOR AVATAR STATES ===
  const emitState = (state: string) => {
    console.log("AVATAR_STATE:", state);
  };

  emitState("thinking");

  // === GENERATE RESPONSE USING PROVIDER ===
  const response = await provider.generateStream({
    messages: finalMessages,
    model: modelName,
    files
  });

  emitState("speaking");

  // === NORMALIZE OUTPUT FOR UI ===
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
