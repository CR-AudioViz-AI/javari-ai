import { normalizePayload } from "@/lib/normalize-envelope";
import { multiAIRouter } from "@/lib/javari/multi-ai/router";
import { getProvider } from "@/lib/javari/providers";
import type { Message } from "@/lib/types";
export async function unifiedJavariEngine({
  messages = [],
  persona = "default",
  context = {},
  files = []
}) {
  // Persona templates determine tone & behavior
  const personaPrompts: Record<string, string> = {
    default: "You are Javari, an advanced AI assistant.",
    friendly: "You are Javari, warm, friendly, conversational.",
    developer: "You are Javari, a senior software engineer. Be precise.",
    executive: "You are Javari, concise, strategic, outcome-driven.",
    teacher: "You are Javari, patient, clear, educational."
  };
  const systemMessage = {
    role: "system",
    content: personaPrompts[persona] || personaPrompts.default
  };
  // Create full message array
  const finalMessages: Message[] = [systemMessage, ...messages];
  // Multi-AI router selects best provider & model
  const { providerName, modelName } = await multiAIRouter(finalMessages);
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
  // These hooks power: listening → thinking → speaking animation
  const emitState = (state: string) => {
    // Future:
    // SSE or WebSocket broadcast to avatar state manager
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
