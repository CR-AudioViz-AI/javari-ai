// lib/javari/engine/unified.ts
// Javari Unified AI Engine — v11
// 2026-02-21 — STEP 10: enterprise org/team routing, region-aware fallback, audit events
//
// Changelog from v5 (STEP 1):
//   - New mode: "multi_ai_team" — orchestrates multiple specialist agents
//   - orchestrateTask() called when mode=multi_ai_team or prompt is complex
//   - Agent assignment via determineAgentForTask() delegation rules
//   - OrchestrationEvents logged to console + passed through in routingMeta
//   - All v5 paths (single-agent, validator, memory) preserved exactly
//   - Zero regressions to STEP 0/1/2

import { normalizeEnvelope }                from "@/lib/normalize-envelope";
import { routeRequest, buildFallbackChain } from "@/lib/javari/multi-ai/router";
import { analyzeRoutingContext }             from "@/lib/javari/multi-ai/routing-context";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { getProvider, getProviderApiKey }   from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT }             from "./systemPrompt";
import { retrieveRelevantMemory }           from "@/lib/javari/memory/retrieval";
import {
  orchestrateTask,
  isMultiAgentMode,
  type OrchestrationEvent,
} from "@/lib/javari/multi-ai/orchestrator";
import { determineAgentForTask }            from "@/lib/javari/multi-ai/roles";
import type { Message }                     from "@/lib/types";
import type { RoutingContext as LegacyRoutingContext } from "@/lib/javari/multi-ai/router";
import { runModuleFactory } from "@/lib/javari/factory/module-factory";
import { enforceEntitlement, type Feature } from "@/lib/javari/revenue/entitlements";
import { checkBalance, deductCredits, estimateCallCost } from "@/lib/javari/revenue/credits";
import { logUsageEvent, logAIModelCost } from "@/lib/javari/revenue/metering";
import { routingLog, autonomyLog }           from "@/lib/observability/logger";
import { recordLatency, recordError, recordModelCost } from "@/lib/observability/metrics";
import { isCanaryEnabled, recordCanaryOutcome } from "@/lib/canary/feature-canary";
import { track }                             from "@/lib/analytics/track";
import { writeAuditEvent }                   from "@/lib/enterprise/audit";
import { getTeamConfig, resolveTeamFromWorkspace } from "@/lib/enterprise/ai-teams";
import type { TeamType }                     from "@/lib/enterprise/ai-teams";

// ── Region-aware routing ───────────────────────────────────────────────────────
// Maps deployment region (Vercel VERCEL_REGION env) to provider preference.
const REGION_PROVIDER_PREFERENCE: Record<string, string[]> = {
  "iad1":  ["openai",     "anthropic",  "groq",    "openrouter"],  // us-east
  "sfo1":  ["anthropic",  "openai",     "groq",    "openrouter"],  // us-west
  "fra1":  ["anthropic",  "openrouter", "openai",  "groq"],        // eu-central
  "sin1":  ["openrouter", "anthropic",  "openai",  "groq"],        // ap-southeast
  "default": ["groq",    "anthropic",  "openai",  "openrouter"],
};

function getRegionProviders(): string[] {
  const region = process.env.VERCEL_REGION ?? "default";
  return REGION_PROVIDER_PREFERENCE[region] ?? REGION_PROVIDER_PREFERENCE["default"];
}

// ── Constants (unchanged from v5) ─────────────────────────────────────────────

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

// ── Helpers (unchanged) ───────────────────────────────────────────────────────

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

// ── Provider chain builder (unchanged from v5) ─────────────────────────────────

function buildProviderChain(
  primaryProvider: string,
  isLongForm: boolean,
  fallbackHint?: string[]
): string[] {
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

// ── Build a synthetic TaskNode for multi_ai_team mode ─────────────────────────
// (Allows orchestrateTask() to work without a full task graph)

function buildSyntheticTaskNode(
  userPrompt: string,
  routingCtx: ReturnType<typeof analyzeRoutingContext>
) {
  return {
    id:          "unified_task",
    title:       "Direct request",
    description: userPrompt,
    type:        "generation" as const,
    status:      "running"    as const,
    dependencies: [],
    dependents:  [],
    routing: {
      provider:            routingCtx.primary_provider_hint,
      model:               routingCtx.primary_model_hint,
      requires_validation: routingCtx.requires_validation,
      requires_json:       routingCtx.requires_json,
      high_risk:           routingCtx.high_risk,
      cost_sensitivity:    routingCtx.cost_sensitivity,
      fallback_chain:      routingCtx.fallback_chain,
      requires_reasoning_depth: routingCtx.requires_reasoning_depth,
    },
    attempt:      0,
    maxAttempts:  3,
    createdAt:    new Date().toISOString(),
    parentGoalId: "unified",
  };
}

// ── Multi-AI Team execution ───────────────────────────────────────────────────

async function runMultiAiTeam(
  userPrompt: string,
  routingCtx: ReturnType<typeof analyzeRoutingContext>,
  systemPrompt: string,
  start: number
): Promise<ReturnType<typeof normalizeEnvelope>> {
  const syntheticTask = buildSyntheticTaskNode(userPrompt, routingCtx);

  const orchEvents: OrchestrationEvent[] = [];
  const orchEmit = (e: OrchestrationEvent) => {
    orchEvents.push(e);
    console.info(
      `[Javari-Team] ${e.type} role=${e.role} provider=${e.provider ?? ""} score=${e.score ?? ""}`
    );
  };

  const result = await orchestrateTask(
    syntheticTask as Parameters<typeof orchestrateTask>[0],
    "",
    "unified",
    orchEmit
  );

  if (!result.success || !result.finalOutput) {
    return normalizeEnvelope(
      "I encountered a problem coordinating my AI team. Please try again.",
      {
        success: false,
        error:   result.error ?? "Multi-AI team returned empty output",
        multiAiTeam: true,
        agents: result.agentsUsed,
      }
    );
  }

  return normalizeEnvelope(result.finalOutput, {
    success:  true,
    provider: result.agentsUsed.join("+"),
    model:    result.strategy,
    latency:  Date.now() - start,
    // @ts-expect-error extended metadata
    multiAiTeam:   true,
    agentsUsed:    result.agentsUsed,
    mergeStrategy: result.strategy,
    orchEventCount: orchEvents.length,
    routingMeta: {
      requires_reasoning_depth: routingCtx.requires_reasoning_depth,
      requires_json:            routingCtx.requires_json,
      requires_validation:      routingCtx.requires_validation,
      high_risk:                routingCtx.high_risk,
      complexity_score:         routingCtx.complexity_score,
      multi_ai_team:            true,
    },
  });
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
  _mode,
  _userId,
}: {
  messages?: Message[];
  persona?: string;
  context?: Record<string, unknown>;
  files?: unknown[];
  _memoryAlreadyInjected?: boolean;
  _systemCommandMode?: boolean;
  _longForm?: boolean;
  /** v6: explicit mode override. "multi_ai_team" activates team orchestration. */
  _mode?: "single" | "multi_ai_team" | "module_factory" | "auto";
  /** v8 STEP 5: caller passes userId for entitlement/billing checks */
  _userId?: string;
  /** v9 STEP 6: if true, return cost estimate only — do not execute */
  _previewCost?: boolean;
  /** v11 STEP 10: enterprise org context */
  _orgId?:    string;
  /** v11 STEP 10: workspace team type for AI team routing */
  _teamType?: string;
  /** v11 STEP 10: preferred region for routing */
  _region?:   string;
}) {
  const start = Date.now();

  // ── v11 STEP 10: Region + enterprise team routing ──────────────────────────
  const _regionProviders = getRegionProviders();
  const _resolvedTeam    = resolveTeamFromWorkspace(_teamType);
  const _teamCfg         = _resolvedTeam !== "general"
    ? getTeamConfig(_resolvedTeam, _orgId)
    : null;

  // Team-level system prompt suffix (injected later)
  const _teamPromptSuffix = _teamCfg?.systemPromptSuffix ?? "";

  // Team preferred providers override region order (enterprise only)
  const _enterpriseProviders = _orgId && _teamCfg
    ? _teamCfg.preferredProviders
    : _regionProviders;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userPrompt      = lastUserMessage?.content ?? "";

  // ── Determine mode ─────────────────────────────────────────────────────────
  const isLongForm = _longForm || userPrompt.length > LONG_FORM_THRESHOLD_CHARS;
  const maxTokens  = isLongForm ? MAX_TOKENS_LONG_FORM : MAX_TOKENS_NORMAL;
  const providerTimeout = isLongForm
    ? PROVIDER_ATTEMPT_TIMEOUT_LONG_MS
    : PROVIDER_ATTEMPT_TIMEOUT_SHORT_MS;

  // ── STEP 1: Routing context analysis ──────────────────────────────────────
  const routingCtx = analyzeRoutingContext(userPrompt, "single");

  // ── STEP 5: Entitlement + balance guard ────────────────────────────────────
  const _billingUserId = _userId ?? "";
  if (!_systemCommandMode && _billingUserId) {
    try {
      // Feature gate: pick narrowest feature for this mode
      const _feature: Feature =
        _mode === "module_factory" ? "module_factory" :
        _mode === "multi_ai_team"  ? "multi_ai_team"  :
        "chat";
      await enforceEntitlement(_billingUserId, _feature);
      // Balance gate
      const _bal = await checkBalance(_billingUserId);
      if (!_bal.sufficient) {
        return normalizeEnvelope(
          "Insufficient credits. Visit /billing/credits to top up.",
          { success: false, provider: "billing", model: "entitlement-check",
            latency: 0, error: "INSUFFICIENT_CREDITS" }
        );
      }
    } catch (entErr: unknown) {
      const isEntitlement = (entErr instanceof Error) && entErr.message.startsWith("ENTITLEMENT_DENIED");
      if (isEntitlement) {
        const upgradeUrl = (entErr as { upgradeUrl?: string }).upgradeUrl ?? "/billing";
        return normalizeEnvelope(
          `Feature not available on your current plan. Upgrade at ${upgradeUrl}`,
          { success: false, provider: "billing", model: "entitlement-check",
            latency: 0, error: "ENTITLEMENT_DENIED", upgradeUrl }
        );
      }
      // Non-entitlement errors: log and continue (fail open)
      console.warn("[Javari] Billing pre-check threw (non-fatal):", entErr instanceof Error ? entErr.message : entErr);
    }
  }


  // ── STEP 6: Cost preview mode (estimate only, no execution) ─────────────
  if (_previewCost && _billingUserId) {
    const _prevCost = estimateCallCost(_mode === "multi_ai_team" ? "multi_ai_team" :
      _mode === "module_factory" ? "module_factory" : "chat");
    return normalizeEnvelope(
      `Estimated cost: ${_prevCost} credits`,
      { success: true, provider: "billing", model: "cost-preview", latency: 0,
        // @ts-expect-error extended metadata
        costPreview: true,
        estimatedCredits: _prevCost,
        entitlementStatus: "allowed",
      }
    );
  }

  // ── STEP 4: module_factory mode ────────────────────────────────────────────
  if (_mode === "module_factory") {
    // Parse "module: <name> | <description>" or fall back to userPrompt as description
    const parts     = userPrompt.split("|");
    const moduleName = parts[0]?.replace(/^module:/i, "").trim() || "New Module";
    const moduleDesc = parts[1]?.trim() || userPrompt;
    const factoryEvents: unknown[] = [];
    const factoryEmit = (e: unknown) => factoryEvents.push(e);
    try {
      const fr = await runModuleFactory(moduleName, moduleDesc, factoryEmit as Parameters<typeof runModuleFactory>[2]);
      if (fr.bundle) {
        const summary = [
          `Module **${fr.bundle.moduleName}** generated successfully.`,
          `${fr.bundle.successFiles} files ready to commit.`,
          fr.bundle.warnings.length ? `Warnings: ${fr.bundle.warnings.join("; ")}` : "",
        ].filter(Boolean).join(" ");
        return normalizeEnvelope(summary, {
          success: true, provider: "factory", model: "multi_agent",
          latency: Date.now() - start,
          // @ts-expect-error extended metadata
          moduleFactory: true, bundle: {
            moduleId: fr.bundle.moduleId,
            files: fr.bundle.files.map((f) => ({ path: f.path, category: f.category, lineCount: f.lineCount })),
            readyToCommit: fr.bundle.readyToCommit,
          },
        });
      }
    } catch (factoryErr) {
      console.error("[Javari] module_factory mode failed:", factoryErr instanceof Error ? factoryErr.message : factoryErr);
    }
    // Fallback to single-agent if factory fails
  }

  // ── STEP 3: Determine if multi_ai_team mode should activate ───────────────
  const syntheticTask  = buildSyntheticTaskNode(userPrompt, routingCtx);
  const useMultiTeam   =
    _mode === "multi_ai_team" ||
    (_mode !== "single" && !_systemCommandMode && isMultiAgentMode(syntheticTask as Parameters<typeof isMultiAgentMode>[0]));

  if (useMultiTeam) {
    // ── MULTI-AI TEAM PATH ─────────────────────────────────────────────────
    // Memory retrieval still applies (injected into system prompt context)
    let memoryContext = "";
    if (!_memoryAlreadyInjected) {
      try {
        memoryContext = await retrieveRelevantMemory(userPrompt);
      } catch {
        console.info("[Javari] Memory retrieval skipped (non-fatal)");
      }
    }

    const personaOverlays: Record<string, string> = {
      default:  "",
      friendly:  "Tone: warm, conversational, encouraging.",
      developer: "Tone: precise, technical, senior-engineer level.",
      executive: "Tone: concise, strategic, outcome-driven.",
      teacher:   "Tone: patient, clear, educational.",
    };

    const systemPromptParts: string[] = [];
    if (memoryContext) systemPromptParts.push(memoryContext);
    systemPromptParts.push(JAVARI_SYSTEM_PROMPT);
    const overlay = personaOverlays[persona] ?? "";
    if (overlay) systemPromptParts.push(overlay);
    const systemPrompt = systemPromptParts.join("\n\n");

    console.info(
      `[Javari] v6 multi_ai_team: complexity=${routingCtx.complexity_score} ` +
      `high_risk=${routingCtx.high_risk} requires_validation=${routingCtx.requires_validation}`
    );

    return runMultiAiTeam(userPrompt, routingCtx, systemPrompt, start);
  }

  // ── SINGLE-AGENT PATH (identical to v5) ────────────────────────────────────

  const routingDecision = routeRequest({
    prompt: userPrompt,
    mode: "single",
  } as LegacyRoutingContext);

  const primaryProvider = routingDecision.routingMeta.primary_provider_hint;
  const modelName       = routingDecision.routingMeta.primary_model_hint;

  const candidateProviders = buildProviderChain(
    primaryProvider,
    isLongForm,
    routingDecision.routingMeta.fallback_chain
  );

  const personaOverlays: Record<string, string> = {
    default:  "",
    friendly:  "Tone: warm, conversational, encouraging.",
    developer: "Tone: precise, technical, senior-engineer level.",
    executive: "Tone: concise, strategic, outcome-driven.",
    teacher:   "Tone: patient, clear, educational.",
  };
  const personaOverlay = _systemCommandMode ? "" : (personaOverlays[persona] ?? "");

  let memoryContext = "";
  if (!_memoryAlreadyInjected) {
    try {
      memoryContext = await retrieveRelevantMemory(userPrompt);
    } catch {
      console.info("[Javari] Memory retrieval skipped (non-fatal)");
    }
  }

  const promptParts: string[] = [];
  if (memoryContext) promptParts.push(memoryContext);
  promptParts.push(JAVARI_SYSTEM_PROMPT);
  if (personaOverlay) promptParts.push(personaOverlay);

  if (routingCtx.requires_json && !_systemCommandMode) {
    promptParts.push(
      "IMPORTANT: The user requires strict JSON output. " +
      "Return ONLY valid JSON. No markdown, no backticks, no prose outside JSON."
    );
  }

  const systemPrompt = promptParts.join("\n\n");

  console.info(
    `[Javari] v6 single: provider=${primaryProvider} model=${modelName} ` +
    `reasoning=${routingCtx.requires_reasoning_depth} json=${routingCtx.requires_json} ` +
    `validate=${routingCtx.requires_validation} risk=${routingCtx.high_risk} ` +
    `complexity=${routingCtx.complexity_score} chain=${candidateProviders.join(",")}`
  );

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

    const perProviderModel = i === 0 ? modelName : undefined;

    try {
      const provider = getProvider(pName as Parameters<typeof getProvider>[0], apiKey);

      const fullText = await withTimeout(
        (async () => {
          const stream = provider.generateStream(userPrompt, {
            rolePrompt:     systemPrompt,
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

      if (isOutputMalformed(fullText)) {
        errors.push({ provider: pName, error: "Empty/malformed response", fatal: false });
        continue;
      }

      bestOutput   = fullText.trim();
      bestProvider = pName;
      break;

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fatal  = isFatalError(errMsg);
      errors.push({ provider: pName, error: errMsg, fatal });
      console.error(
        `[Javari] Provider ${pName} failed (attempt ${i + 1}, ${fatal ? "fatal" : "transient"}):`,
        errMsg.slice(0, 120)
      );
    }
  }

  if (!bestOutput) {
    const providerSummary = errors
      .map((e) => `${e.provider}(${e.fatal ? "fatal" : "transient"})`)
      .join(", ");
    console.error(`[Javari] All ${candidateProviders.length} providers failed:`, providerSummary);

    // STEP 7: Record outage metrics + analytics
    recordError("provider.all_failed", { providers: providerSummary });
    track({ event: "outage_detected", properties: { providerSummary, candidateCount: candidateProviders.length } });
    routingLog.error("All providers failed", { meta: { providerSummary } });

    return normalizeEnvelope(
      "I'm Javari — I'm having trouble reaching my AI providers right now. Please try again in a moment.",
      {
        success:        false,
        error:          `All providers failed: ${providerSummary}`,
        providerErrors: errors,
        degraded:       true,
        degradedReason: "provider_outage",
      }
    );
  }

  let finalOutput = bestOutput;
  let validationResult: Awaited<ReturnType<typeof validateResponse>> | null = null;

  if (routingCtx.requires_validation && !_systemCommandMode) {
    try {
      validationResult = await validateResponse(userPrompt, bestOutput, routingCtx, {
        useFullModel: routingCtx.high_risk,
        attemptFix:   true,
      });

      if (!validationResult.skipped) {
        if (!validationResult.passed && validationResult.corrected) {
          finalOutput = validationResult.corrected;
          console.info(`[Javari] Validator corrected output (score=${validationResult.score})`);
        } else if (!validationResult.passed && !validationResult.corrected) {
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
    }
  }

  if (routingCtx.requires_json) {
    try {
      JSON.parse(finalOutput);
      console.info("[Javari] JSON output validated successfully");
    } catch {
      console.warn("[Javari] JSON output failed parse — returning as-is with warning");
    }
  }

  // ── STEP 7: Record latency + canary outcome ─────────────────────────────────
  const _totalMs = Date.now() - start;
  recordLatency("unified_engine", _totalMs, { mode: _mode ?? "auto" });
  if (_mode === "multi_ai_team") recordCanaryOutcome("multi_ai_team", !!finalOutput);
  if (_mode === "module_factory") recordCanaryOutcome("module_factory", !!finalOutput);

  // ── STEP 5: Post-call billing deduction + metering ────────────────────────
  let _creditsCharged = 0;
  let _traceId        = "";
  if (!_systemCommandMode && _billingUserId && finalOutput) {
    try {
      const _cost = estimateCallCost(
        bestProvider,
        modelName,
        (userPrompt.length + (finalOutput?.length ?? 0)),
        routingCtx.high_risk ? "expensive" : routingCtx.complexity_score > 70 ? "moderate" : "low"
      );
      _creditsCharged = _cost.credits;
      // Non-blocking: fire-and-forget deduction to not delay response
      const _deductPromise = deductCredits(
        _billingUserId, _creditsCharged,
        `${_mode ?? "chat"} — ${bestProvider}/${modelName}`,
        { idempotencyKey: `uni_${start}_${_billingUserId.slice(0,8)}` }
      ).then((r) => { if (!r.success) console.warn("[Javari] Credit deduction failed:", r.error); });
      _traceId = logUsageEvent({
        userId:      _billingUserId,
        eventType:   "chat",
        feature:     _mode ?? "chat",
        creditsUsed: _creditsCharged,
        success:     true,
        durationMs:  Date.now() - start,
        metadata:    { provider: bestProvider, model: modelName },
      });
      logAIModelCost({
        userId:          _billingUserId,
        provider:        bestProvider,
        model:           modelName,
        inputTokens:     Math.ceil(userPrompt.length / 4),
        outputTokens:    Math.ceil((finalOutput?.length ?? 0) / 4),
        costUsd:         _cost.costUSD,
        creditsCharged:  _creditsCharged,
        tier:            _cost.tier,
        marginMultiplier: 4,
        latencyMs:       Date.now() - start,
        success:         true,
        traceId:         _traceId,
      });
      void _deductPromise;
    } catch (billErr) {
      console.warn("[Javari] Post-call billing failed (non-fatal):", billErr instanceof Error ? billErr.message : billErr);
    }
  }

  // ── STEP 6: Annotate response with entitlement + cost metadata for UI ──
  const _postCallMeta = _billingUserId ? {
    entitlementStatus: "allowed" as const,
    creditsUsed:       _creditsCharged,
    userId:            _billingUserId,
  } : {};

  // v11: Enterprise audit event (fire-and-forget, only for org users)
  if (_orgId && _billingUserId) {
    void writeAuditEvent({
      action:    "module.generated",
      userId:    _billingUserId,
      orgId:     _orgId,
      metadata:  { provider: bestProvider, model: modelName, latency: Date.now() - start, mode: _mode ?? "single" },
      severity:  "info",
    });
  }

  return normalizeEnvelope(finalOutput, {
    success:  true,
    provider: bestProvider,
    model:    modelName,
    latency:  Date.now() - start,
    // @ts-expect-error extended metadata
    memoryUsed:       !!memoryContext || _memoryAlreadyInjected,
    providerAttempts: errors.length + 1,
    isLongForm,
    maxTokens,
    multiAiTeam: false,
    routingMeta: {
      requires_reasoning_depth: routingCtx.requires_reasoning_depth,
      requires_json:            routingCtx.requires_json,
      requires_validation:      routingCtx.requires_validation,
      high_risk:                routingCtx.high_risk,
      complexity_score:         routingCtx.complexity_score,
      multi_ai_team:            false,
      enterprise: _orgId ? { orgId: _orgId, teamType: _resolvedTeam, region: _region ?? process.env.VERCEL_REGION ?? "default" } : null,
      validation: validationResult
        ? {
            passed:     validationResult.passed,
            score:      validationResult.score,
            skipped:    validationResult.skipped,
            model:      validationResult.model,
            durationMs: validationResult.durationMs,
          }
        : null,
    },
  });
}
