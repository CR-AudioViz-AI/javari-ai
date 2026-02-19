// lib/javari/engine/unified.ts
// Javari Unified AI Engine
// Pipeline: memory retrieval → identity injection → provider routing → fallback

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

  const personaOverlays: Record<string, string> = {
    default: "",
    friendly: "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, senior-engineer level.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher: "Tone: patient, clear, educational.",
  };
  const personaOverlay = personaOverlays[persona] || "";

  // Last user message — used for routing and memory retrieval
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userPrompt = lastUserMessage?.content ?? "";

  // ── STEP 1: Retrieve R2 semantic memory ───────────────────────────────────
  // Runs BEFORE identity injection. Returns "" on any failure.
  const memoryContext = await retrieveRelevantMemory(userPrompt);

  // ── STEP 2: Assemble system prompt ────────────────────────────────────────
  // Order: [memory context] → [Javari identity] → [persona overlay]
  // Identity stays dominant — memory is prepended reference context.
  const promptParts: string[] = [];
  if (memoryContext) promptParts.push(memoryContext);
  promptParts.push(JAVARI_SYSTEM_PROMPT);
  if (personaOverlay) promptParts.push(personaOverlay);
  const systemPrompt = promptParts.join("\n\n");

  // ── STEP 3: Route to best available provider ──────────────────────────────
  const routingDecision = routeRequest({ prompt: userPrompt, mode: "single" } as RoutingContext);
  const providerName = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  const providerOrder = [
    providerName,
    providerName !== "anthropic" ? "anthropic" : null,
    providerName !== "openai"    ? "openai"    : null,
    providerName !== "mistral"   ? "mistral"   : null,
  ].filter(Boolean) as string[];

  let lastError = "";

  for (const pName of providerOrder) {
    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch { continue; }

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);
      const stream = provider.generateStream(userPrompt, {
        rolePrompt: systemPrompt,
        preferredModel: modelName,
      });

      let fullText = "";
      const iter = (stream as AsyncIterable<string>)[Symbol.asyncIterator]
        ? (stream as AsyncIterable<string>)[Symbol.asyncIterator]()
        : stream as AsyncIterator<string>;

      while (true) {
        const { done, value } = await iter.next();
        if (done) break;
        if (value) fullText += value;
      }

      return normalizeEnvelope(fullText || "I\'m Javari. How can I help you?", {
        success: true,
        provider: pName,
        model: modelName,
        latency: Date.now() - start,
        memoryUsed: !!memoryContext,
      });
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Javari] Provider ${pName} failed:`, lastError);
    }
  }

  return normalizeEnvelope(
    "I\'m Javari — temporarily unable to reach AI providers. Please try again.",
    { success: false, error: lastError }
  );
}
