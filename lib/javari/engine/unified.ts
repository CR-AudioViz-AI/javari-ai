// lib/javari/engine/unified.ts
// Javari Unified AI Engine — v2
// Pipeline: memory retrieval (once) → identity injection → provider routing → retry with backoff
// Changes from v1:
//   - Memory retrieved ONCE here, not duplicated in chat route
//   - Exponential backoff between provider attempts (250ms → 500ms → 1000ms)
//   - Jitter added to prevent thundering herd on cold starts
//   - Fallback chain expanded to 6 providers (groq added — fast free tier)
//   - Error categorization: transient vs fatal (don't retry 400/401/403)
//   - Provider attempt timeout: 22s per attempt (leaves 8s buffer inside 30s max)
// 2026-02-19

import { normalizeEnvelope } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import type { Message } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_ATTEMPT_TIMEOUT_MS = 22_000; // 22s per provider, leaves buffer in 30s maxDuration
const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 1_500;
const MAX_PROVIDERS = 6;

// Errors that indicate the provider is permanently misconfigured — don't retry
const FATAL_ERROR_PATTERNS = [
  /invalid.*api.*key/i,
  /api key.*not.*valid/i,
  /authentication.*failed/i,
  /401/,
  /403/,
  /account.*disabled/i,
  /quota.*exceeded/i,
  /billing/i,
];

// Errors that are transient — worth retrying on next provider
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /network/i,
  /connection/i,
  /503/,
  /502/,
  /500/,
  /overloaded/i,
  /rate.*limit/i,
  /429/,
  /econnreset/i,
  /fetch.*failed/i,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  // ±20% random jitter to prevent thundering herd
  return ms + Math.floor((Math.random() - 0.5) * ms * 0.4);
}

function isFatalError(err: string): boolean {
  return FATAL_ERROR_PATTERNS.some((p) => p.test(err));
}

function backoffMs(attempt: number): number {
  return jitter(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
}

/** Run a promise with a hard timeout */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Provider timeout after ${ms}ms`)), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

// ── Main engine ──────────────────────────────────────────────────────────────

export async function unifiedJavariEngine({
  messages = [],
  persona = "default",
  context = {},
  files = [],
  _memoryAlreadyInjected = false, // set to true when caller already prepended memory
}: {
  messages?: Message[];
  persona?: string;
  context?: Record<string, unknown>;
  files?: unknown[];
  _memoryAlreadyInjected?: boolean;
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

  // ── STEP 1: Retrieve R2 semantic memory (skip if caller already injected) ──
  let memoryContext = "";
  if (!_memoryAlreadyInjected) {
    try {
      memoryContext = await retrieveRelevantMemory(userPrompt);
    } catch {
      // Non-fatal — continue without memory context
      console.info("[Javari] Memory retrieval skipped (non-fatal)");
    }
  }

  // ── STEP 2: Assemble system prompt ────────────────────────────────────────
  const promptParts: string[] = [];
  if (memoryContext) promptParts.push(memoryContext);
  promptParts.push(JAVARI_SYSTEM_PROMPT);
  if (personaOverlay) promptParts.push(personaOverlay);
  const systemPrompt = promptParts.join("\n\n");

  // ── STEP 3: Build provider fallback chain ─────────────────────────────────
  const routingDecision = routeRequest({ prompt: userPrompt, mode: "single" } as RoutingContext);
  const primaryProvider = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  // 6-provider fallback chain: primary first, then best alternatives
  // Groq added — very fast free tier, ideal for cold-start recovery
  const candidateProviders = [
    primaryProvider,
    primaryProvider !== "anthropic" ? "anthropic" : null,
    primaryProvider !== "openai" ? "openai" : null,
    primaryProvider !== "groq" ? "groq" : null,
    primaryProvider !== "mistral" ? "mistral" : null,
    primaryProvider !== "openrouter" ? "openrouter" : null,
  ]
    .filter(Boolean)
    .slice(0, MAX_PROVIDERS) as string[];

  const errors: { provider: string; error: string; fatal: boolean }[] = [];

  for (let i = 0; i < candidateProviders.length; i++) {
    const pName = candidateProviders[i];

    // Add backoff delay between attempts (not before the first)
    if (i > 0) {
      await sleep(backoffMs(i - 1));
    }

    // Skip if we can't get the key
    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch {
      errors.push({ provider: pName, error: "Key unavailable", fatal: true });
      continue;
    }

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

      // Wrap the entire stream collection in a timeout
      const fullText = await withTimeout(
        (async () => {
          const stream = provider.generateStream(userPrompt, {
            rolePrompt: systemPrompt,
            preferredModel: modelName,
          });

          let text = "";
          const iter = (stream as AsyncIterable<string>)[Symbol.asyncIterator]
            ? (stream as AsyncIterable<string>)[Symbol.asyncIterator]()
            : (stream as AsyncIterator<string>);

          while (true) {
            const { done, value } = await iter.next();
            if (done) break;
            if (value) text += value;
          }

          return text;
        })(),
        PROVIDER_ATTEMPT_TIMEOUT_MS
      );

      if (!fullText?.trim()) {
        errors.push({ provider: pName, error: "Empty response", fatal: false });
        continue;
      }

      return normalizeEnvelope(fullText, {
        success: true,
        provider: pName,
        model: modelName,
        latency: Date.now() - start,
        memoryUsed: !!memoryContext || _memoryAlreadyInjected,
        providerAttempts: i + 1,
      });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fatal = isFatalError(errMsg);
      errors.push({ provider: pName, error: errMsg, fatal });
      console.error(`[Javari] Provider ${pName} failed (attempt ${i + 1}, ${fatal ? "fatal" : "transient"}):`, errMsg.slice(0, 120));

      // Don't try more providers if this is a transient error on a fast provider —
      // the next provider will likely succeed. But if it's fatal (bad key), skip immediately.
      // Either way, the loop continues to the next candidate.
    }
  }

  // All providers exhausted
  const providerSummary = errors.map((e) => `${e.provider}(${e.fatal ? "fatal" : "transient"})`).join(", ");
  console.error(`[Javari] All ${candidateProviders.length} providers failed:`, providerSummary);

  return normalizeEnvelope(
    "I'm Javari — I'm having trouble reaching my AI providers right now. Please try again in a moment.",
    {
      success: false,
      error: `All providers failed: ${providerSummary}`,
      providerErrors: errors,
    }
  );
}
