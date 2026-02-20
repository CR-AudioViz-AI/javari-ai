// lib/javari/engine/unified.ts
// Javari Unified AI Engine — v4
// Changelog from v3:
//   - Long-form threshold raised to 1500 chars (was 500) — avoids Anthropic timeout on medium prompts
//   - Long-form mode: Groq-first fallback chain (fastest model for large outputs)
//   - Provider attempt timeout: 25s (short) / 50s (long-form), both safe under Vercel Pro 60s limit
//   - MAX_PROVIDERS reduced to 3 for long-form (prevents timeout chain exceeding 60s)
//   - systemCommand mode: short-circuits to Groq/OpenAI only (fastest completion)
// 2026-02-19 — P1-003 (v4 fix)

import { normalizeEnvelope } from "@/lib/normalize-envelope";
import { routeRequest, type RoutingContext } from "@/lib/javari/multi-ai/router";
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT } from "./systemPrompt";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import type { Message } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_ATTEMPT_TIMEOUT_SHORT_MS = 25_000; // ≤1500 char prompts
const PROVIDER_ATTEMPT_TIMEOUT_LONG_MS  = 50_000; // >1500 char prompts (Vercel Pro max 60s)
const RETRY_BASE_MS  = 200;
const RETRY_MAX_MS   = 1_000;
const MAX_PROVIDERS_SHORT = 6; // Can try many on short prompts
const MAX_PROVIDERS_LONG  = 3; // Limit on long-form to stay under 60s total

// Long-form threshold: only use long path for truly large prompts (1500+ chars)
const LONG_FORM_THRESHOLD_CHARS = 1_500;

const MAX_TOKENS_NORMAL    = 4_096;
const MAX_TOKENS_LONG_FORM = 8_192;

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor((Math.random() - 0.5) * ms * 0.4);
}

function isFatalError(err: string): boolean {
  return FATAL_ERROR_PATTERNS.some((p) => p.test(err));
}

function backoffMs(attempt: number): number {
  return jitter(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
}

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

// ── Build provider chain ──────────────────────────────────────────────────────

function buildProviderChain(
  primaryProvider: string,
  isLongForm: boolean
): string[] {
  if (isLongForm) {
    // Long-form: prefer fastest providers (Groq > OpenAI > primary if different)
    const longFormOrder = ["groq", "openai", "mistral"];
    const chain = [
      ...longFormOrder,
      // Add primary if not already included
      ...(longFormOrder.includes(primaryProvider) ? [] : [primaryProvider]),
    ].slice(0, MAX_PROVIDERS_LONG);
    return chain;
  }

  // Normal: routing-first with full fallback chain
  return [
    primaryProvider,
    primaryProvider !== "anthropic"  ? "anthropic"  : null,
    primaryProvider !== "openai"     ? "openai"     : null,
    primaryProvider !== "groq"       ? "groq"       : null,
    primaryProvider !== "mistral"    ? "mistral"    : null,
    primaryProvider !== "openrouter" ? "openrouter" : null,
  ]
    .filter(Boolean)
    .slice(0, MAX_PROVIDERS_SHORT) as string[];
}

// ── Main engine ──────────────────────────────────────────────────────────────

export async function unifiedJavariEngine({
  messages = [],
  persona = "default",
  context = {},
  files = [],
  _memoryAlreadyInjected = false,
  _systemCommandMode = false,
  _longForm = false,
}: {
  messages?: Message[];
  persona?: string;
  context?: Record<string, unknown>;
  files?: unknown[];
  _memoryAlreadyInjected?: boolean;
  _systemCommandMode?: boolean;
  _longForm?: boolean;
}) {
  const start = Date.now();

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userPrompt = lastUserMessage?.content ?? "";

  // ── Determine mode ────────────────────────────────────────────────────────
  const isLongForm = _longForm || userPrompt.length > LONG_FORM_THRESHOLD_CHARS;
  const maxTokens  = isLongForm ? MAX_TOKENS_LONG_FORM : MAX_TOKENS_NORMAL;
  const providerTimeout = isLongForm ? PROVIDER_ATTEMPT_TIMEOUT_LONG_MS : PROVIDER_ATTEMPT_TIMEOUT_SHORT_MS;

  // ── Persona overlay (suppressed in system command mode) ───────────────────
  const personaOverlays: Record<string, string> = {
    default: "",
    friendly:   "Tone: warm, conversational, encouraging.",
    developer:  "Tone: precise, technical, senior-engineer level.",
    executive:  "Tone: concise, strategic, outcome-driven.",
    teacher:    "Tone: patient, clear, educational.",
  };
  const personaOverlay = _systemCommandMode ? "" : (personaOverlays[persona] ?? "");

  // ── Memory retrieval ──────────────────────────────────────────────────────
  let memoryContext = "";
  if (!_memoryAlreadyInjected) {
    try {
      memoryContext = await retrieveRelevantMemory(userPrompt);
    } catch {
      console.info("[Javari] Memory retrieval skipped (non-fatal)");
    }
  }

  // ── Assemble system prompt ────────────────────────────────────────────────
  const promptParts: string[] = [];
  if (memoryContext) promptParts.push(memoryContext);
  promptParts.push(JAVARI_SYSTEM_PROMPT);
  if (personaOverlay) promptParts.push(personaOverlay);
  const systemPrompt = promptParts.join("\n\n");

  // ── Provider fallback chain ────────────────────────────────────────────────
  const routingDecision = routeRequest({ prompt: userPrompt, mode: "single" } as RoutingContext);
  const primaryProvider = routingDecision.selectedModel.provider;
  const modelName = routingDecision.selectedModel.id;

  const candidateProviders = buildProviderChain(primaryProvider, isLongForm);

  console.info(
    `[Javari] isLongForm=${isLongForm} promptLen=${userPrompt.length} ` +
    `timeout=${providerTimeout}ms maxTokens=${maxTokens} ` +
    `chain=${candidateProviders.join(",")}`
  );

  const errors: { provider: string; error: string; fatal: boolean }[] = [];

  for (let i = 0; i < candidateProviders.length; i++) {
    const pName = candidateProviders[i];
    if (i > 0) await sleep(backoffMs(i - 1));

    let apiKey: string;
    try {
      apiKey = getProviderApiKey(pName as Parameters<typeof getProviderApiKey>[0]);
    } catch {
      errors.push({ provider: pName, error: "Key unavailable", fatal: true });
      continue;
    }

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

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
        providerTimeout
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
        isLongForm,
        maxTokens,
      });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fatal = isFatalError(errMsg);
      errors.push({ provider: pName, error: errMsg, fatal });
      console.error(
        `[Javari] Provider ${pName} failed (attempt ${i + 1}, ${fatal ? "fatal" : "transient"}):`,
        errMsg.slice(0, 120)
      );
    }
  }

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
