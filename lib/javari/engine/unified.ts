// lib/javari/engine/unified.ts
// Javari Unified AI Engine
// Memory retrieval → Identity injection → Provider routing → Fallback chain

import { normalizeEnvelope } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import type { Message } from "@/lib/types";

export async function unifiedJavariEngine({
  messages = [],
  persona = "default",
  context = {},
  files = [],
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
    teacher: "Tone: patient, clear, educational.",
  };
  const personaOverlay = personaOverlays[persona] || "";

  // Extract the last user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userPrompt = lastUserMessage?.content ?? "";

  // ── Step 1: Retrieve semantic memory (R2 Canonical + knowledge base) ──────
  // Runs BEFORE identity injection — memory is prepended as earliest context.
  // Returns "" on any failure — never breaks the pipeline.
  const memoryContext = await retrieveRelevantMemory(userPrompt);

  // ── Step 2: Build full system prompt ─────────────────────────────────────
  // Order: [memory context] → [Javari identity] → [persona overlay]
  // Identity remains the dominant top-level instruction.
  const parts: string[] = [];

  if (memoryContext) {
    parts.push(memoryContext);
  }

  parts.push(JAVARI_SYSTEM_PROMPT);

  if (personaOverlay) {
    parts.push(personaOverlay);
  }

  const systemPrompt = parts.join("

");

  // ── Step 3: Route to best available provider ──────────────────────────────
  const routingContext: RoutingContext = {
    prompt: userPrompt,
    mode: "single",
  };
  const routingDecision = routeRequest(routingContext);
  const providerName = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  const providerOrder = [
    providerName,
    providerName !== "anthropic" ? "anthropic" : null,
    providerName !== "openai" ? "openai" : null,
    providerName !== "mistral" ? "mistral" : null,
  ].filter(Boolean) as string[];

  let lastError = "";

  // ── Step 4: Try providers in order ───────────────────────────────────────
  for (const pName of providerOrder) {
    let apiKey: string;
    try {
      apiKey = getProviderApiKey(
        pName as Parameters<typeof getProviderApiKey>[0]
      );
    } catch {
      continue;
    }

    try {
      const provider = getProvider(
        pName as Parameters<typeof getProvider>[0],
        apiKey
      );

      const stream = provider.generateStream(userPrompt, {
        rolePrompt: systemPrompt,
        preferredModel: modelName,
      });

      let fullText = "";
      const iter = stream[Symbol.asyncIterator]
        ? (stream as AsyncIterable<string>)[Symbol.asyncIterator]()
        : (stream as AsyncIterator<string>);

      while (true) {
        const { done, value } = await iter.next();
        if (done) break;
        if (value) fullText += value;
      }

      const latency = Date.now() - start;

      return normalizeEnvelope(
        fullText || "I\'m Javari. How can I help you?",
        {
          success: true,
          provider: pName,
          model: modelName,
          latency,
          memoryUsed: !!memoryContext,
        }
      );
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Javari] Provider ${pName} failed:`, lastError);
      continue;
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
