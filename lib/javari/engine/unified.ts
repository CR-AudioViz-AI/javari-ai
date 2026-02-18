import { normalizeEnvelope } from "@/lib/normalize-envelope";
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
  const start = Date.now();

  // Persona overlays
  const personaOverlays: Record<string, string> = {
    default: "",
    friendly: "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, senior-engineer level.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher: "Tone: patient, clear, educational."
  };
  const personaOverlay = personaOverlays[persona] || "";

  // Build the full system prompt (Javari identity + optional persona overlay)
  const systemPrompt = personaOverlay
    ? `${JAVARI_SYSTEM_PROMPT}\n\n${personaOverlay}`
    : JAVARI_SYSTEM_PROMPT;

  // Extract the last user message as the prompt string for the provider
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const userPrompt = lastUserMessage?.content ?? "";

  // Route to best available provider + model
  const routingContext: RoutingContext = {
    prompt: userPrompt,
    mode: "single",
  };
  const routingDecision = routeRequest(routingContext);
  const providerName = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  // Try routed provider, fall back to anthropic, then openai
  const providerOrder = [
    providerName,
    providerName !== "anthropic" ? "anthropic" : null,
    providerName !== "openai" ? "openai" : null,
    providerName !== "mistral" ? "mistral" : null,
  ].filter(Boolean) as string[];

  let lastError = "";

  for (const pName of providerOrder) {
    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch {
      continue; // no key for this provider, try next
    }

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

      // Providers take a string message + options
      // Collect AsyncIterator<string> stream into full response
      const stream = provider.generateStream(userPrompt, {
        rolePrompt: systemPrompt,
        preferredModel: modelName,
      });

      let fullText = "";
      const iter = stream[Symbol.asyncIterator]
        ? (stream as AsyncIterable<string>)[Symbol.asyncIterator]()
        : stream as AsyncIterator<string>;

      while (true) {
        const { done, value } = await iter.next();
        if (done) break;
        if (value) fullText += value;
      }

      const latency = Date.now() - start;

      return normalizeEnvelope(fullText || "I\'m Javari. How can I help you?", {
        success: true,
        provider: pName,
        model: modelName,
        latency,
      });

    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Javari] Provider ${pName} failed:`, lastError);
      continue; // try next provider
    }
  }

  // All providers failed
  return normalizeEnvelope(
    "I\'m Javari — I\'m temporarily unable to reach my AI providers. Please try again in a moment.",
    {
      success: false,
      error: lastError,
    }
  );
}
