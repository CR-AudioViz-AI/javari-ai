// lib/javari/engine/unified.ts
// Javari Unified AI Engine — v5
// 2026-02-20 — STEP 1: validator stage + routing metadata integration
//
// Changelog from v4:
//   - routeRequest() now returns RoutingDecision.routingMeta
//   - analyzeRoutingContext() called before chain to set model/fallback hints
//   - buildProviderChain() now uses ctx.fallback_chain from routing context
//   - Post-generation validator stage: runs when ctx.requires_validation
//   - isOutputMalformed() check integrated into provider loop
//   - Validator corrected output used when available
//   - All provider model hints flow from routing context (not hardcoded)
//   - Long-form threshold: 1500 chars (unchanged)
//   - Timeouts: 25s short / 50s long (unchanged)

import { normalizeEnvelope } from "@/lib/normalize-envelope";
import { routeRequest, buildFallbackChain }  from "@/lib/javari/multi-ai/router";
import { analyzeRoutingContext }              from "@/lib/javari/multi-ai/routing-context";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { getProvider, getProviderApiKey }    from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT }              from "./systemPrompt";
import { retrieveRelevantMemory }            from "@/lib/javari/memory/retrieval";
import type { Message }                      from "@/lib/types";
import type { RoutingContext as LegacyRoutingContext } from "@/lib/javari/multi-ai/router";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_ATTEMPT_TIMEOUT_SHORT_MS = 25_000;
const PROVIDER_ATTEMPT_TIMEOUT_LONG_MS  = 50_000;
const RETRY_BASE_MS  = 200;
const RETRY_MAX_MS   = 1_000;
const MAX_PROVIDERS_SHORT = 8;
const MAX_PROVIDERS_LONG  = 3;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Provider chain builder ─────────────────────────────────────────────────────
// v5: Uses routing context fallback_chain when available; falls back to legacy logic

function buildProviderChain(
  primaryProvider: string,
  isLongForm: boolean,
  fallbackHint?: string[]
): string[] {
  // If routing context provided a chain, use it (deduplicated)
  if (fallbackHint?.length) {
    const base = [...new Set(fallbackHint)];
    return isLongForm ? base.slice(0, MAX_PROVIDERS_LONG) : base.slice(0, MAX_PROVIDERS_SHORT);
  }

  if (isLongForm) {
    const longFormOrder = ["groq", "openai", "anthropic", "mistral", "openrouter"];
    return [
      ...longFormOrder,
      ...(longFormOrder.includes(primaryProvider) ? [] : [primaryProvider]),
    ].slice(0, MAX_PROVIDERS_LONG);
  }

  return [
    primaryProvider,
    primaryProvider !== "groq"       ? "groq"       : null,
    primaryProvider !== "openai"     ? "openai"     : null,
    primaryProvider !== "anthropic"  ? "anthropic"  : null,
    primaryProvider !== "mistral"    ? "mistral"    : null,
    primaryProvider !== "openrouter" ? "openrouter" : null,
    primaryProvider !== "xai"        ? "xai"        : null,
    primaryProvider !== "perplexity" ? "perplexity" : null,
  ]
    .filter(Boolean)
    .slice(0, MAX_PROVIDERS_SHORT) as string[];
}

// ── Main engine ───────────────────────────────────────────────────────────────

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
  const providerTimeout = isLongForm
    ? PROVIDER_ATTEMPT_TIMEOUT_LONG_MS
    : PROVIDER_ATTEMPT_TIMEOUT_SHORT_MS;

  // ── STEP 1: Routing context analysis ─────────────────────────────────────
  const routingCtx = analyzeRoutingContext(userPrompt, "single");

  // ── Legacy routing decision (for model name / primary provider) ───────────
  const routingDecision = routeRequest({
    prompt: userPrompt,
    mode: _systemCommandMode ? "single" : "single",
  } as LegacyRoutingContext);

  const primaryProvider = routingDecision.routingMeta.primary_provider_hint;
  const modelName       = routingDecision.routingMeta.primary_model_hint;

  // ── Build provider chain using routing context ────────────────────────────
  const candidateProviders = buildProviderChain(
    primaryProvider,
    isLongForm,
    routingDecision.routingMeta.fallback_chain
  );

  // ── Persona overlay ───────────────────────────────────────────────────────
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

  // Inject JSON instruction if required
  if (routingCtx.requires_json && !_systemCommandMode) {
    promptParts.push(
      "IMPORTANT: The user requires strict JSON output. " +
      "Return ONLY valid JSON. No markdown, no backticks, no prose outside JSON."
    );
  }

  const systemPrompt = promptParts.join("\n\n");

  // ── Logging ───────────────────────────────────────────────────────────────
  console.info(
    `[Javari] v5 routing: provider=${primaryProvider} model=${modelName} ` +
    `reasoning=${routingCtx.requires_reasoning_depth} json=${routingCtx.requires_json} ` +
    `validate=${routingCtx.requires_validation} risk=${routingCtx.high_risk} ` +
    `complexity=${routingCtx.complexity_score} chain=${candidateProviders.join(",")}`
  );

  // ── Provider fallback loop ────────────────────────────────────────────────
  const errors: { provider: string; error: string; fatal: boolean }[] = [];
  let bestOutput: string | null = null;
  let bestProvider = "";

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

    // Per-provider model: use routing hint for primary, default for fallbacks
    const perProviderModel = i === 0 ? modelName : undefined;

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

      const fullText = await withTimeout(
        (async () => {
          const stream = provider.generateStream(userPrompt, {
            rolePrompt: systemPrompt,
            preferredModel: perProviderModel,
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

      // ── Malformed output check ──────────────────────────────────────────
      if (isOutputMalformed(fullText)) {
        errors.push({ provider: pName, error: "Empty/malformed response", fatal: false });
        continue;
      }

      bestOutput   = fullText.trim();
      bestProvider = pName;
      break; // Successful generation — exit loop

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

  // ── All providers failed ──────────────────────────────────────────────────
  if (!bestOutput) {
    const providerSummary = errors
      .map((e) => `${e.provider}(${e.fatal ? "fatal" : "transient"})`)
      .join(", ");
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

  // ── STEP 1: Validator stage ───────────────────────────────────────────────
  // Only runs when context flags it; never loops (single call)
  let finalOutput = bestOutput;
  let validationResult: Awaited<ReturnType<typeof validateResponse>> | null = null;

  if (routingCtx.requires_validation && !_systemCommandMode) {
    try {
      validationResult = await validateResponse(userPrompt, bestOutput, routingCtx, {
        useFullModel: routingCtx.high_risk,
        attemptFix: true,
      });

      if (!validationResult.skipped) {
        if (!validationResult.passed && validationResult.corrected) {
          // Validator rewrote the output — use corrected version
          finalOutput = validationResult.corrected;
          console.info(`[Javari] Validator corrected output (score=${validationResult.score})`);
        } else if (!validationResult.passed && !validationResult.corrected) {
          // Failed and no fix — log but don't crash; use original
          console.warn(
            `[Javari] Validation failed (score=${validationResult.score}), ` +
            `issues=${validationResult.issues.join("; ")}. Using original.`
          );
        } else {
          console.info(`[Javari] Validation passed (score=${validationResult.score})`);
        }
      }
    } catch (vErr) {
      console.warn("[Javari] Validator threw:", vErr instanceof Error ? vErr.message : vErr);
      // Graceful: use original output
    }
  }

  // ── JSON post-validation ──────────────────────────────────────────────────
  if (routingCtx.requires_json) {
    try {
      JSON.parse(finalOutput);
      console.info("[Javari] JSON output validated successfully");
    } catch {
      console.warn("[Javari] JSON output failed parse — returning as-is with warning");
      // Could attempt strip+reparse but don't risk breaking partial-valid output
    }
  }

  // ── Return normalized envelope ────────────────────────────────────────────
  return normalizeEnvelope(finalOutput, {
    success: true,
    provider: bestProvider,
    model: modelName,
    latency: Date.now() - start,
    // @ts-expect-error -- extra metadata fields (non-standard but useful)
    memoryUsed: !!memoryContext || _memoryAlreadyInjected,
    providerAttempts: errors.length + 1,
    isLongForm,
    maxTokens,
    routingMeta: {
      requires_reasoning_depth: routingCtx.requires_reasoning_depth,
      requires_json:            routingCtx.requires_json,
      requires_validation:      routingCtx.requires_validation,
      high_risk:                routingCtx.high_risk,
      complexity_score:         routingCtx.complexity_score,
      validation: validationResult
        ? {
            passed:    validationResult.passed,
            score:     validationResult.score,
            skipped:   validationResult.skipped,
            model:     validationResult.model,
            durationMs: validationResult.durationMs,
          }
        : null,
    },
  });
}
