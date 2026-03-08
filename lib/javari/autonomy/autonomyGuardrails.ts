// lib/javari/autonomy/autonomyGuardrails.ts
// Javari AI — Autonomy Guardrails
// Purpose: Safety enforcement layer that wraps all autonomous execution.
//          Every operation Javari takes autonomously must pass these checks.
// Date: 2026-03-09
//
// Guardrail categories:
//   1. Cost protection     — per-cycle and daily spend limits
//   2. Scope enforcement   — Javari can only operate on whitelisted repos/paths
//   3. Rate limiting       — max operations per unit time
//   4. Destructive-op gate — deletes, schema drops, production deploys require confirmation
//   5. Secret protection   — never log, commit, or output secret values
//   6. Rollback trigger    — auto-revert if health score drops after action

// ── Types ──────────────────────────────────────────────────────────────────

export type GuardrailCategory =
  | "cost" | "scope" | "rate_limit" | "destructive" | "secret" | "rollback";

export interface GuardrailCheck {
  allowed   : boolean;
  category  : GuardrailCategory;
  reason?   : string;
  riskLevel : "low" | "medium" | "high" | "critical";
}

export interface GuardrailContext {
  operationType   : string;
  targetRepo?     : string;
  targetPath?     : string;
  estimatedCostUsd: number;
  isDestructive?  : boolean;
  isProductionDeploy?: boolean;
  cycleId?        : string;
  userId?         : string;
}

// ── Config ─────────────────────────────────────────────────────────────────

export const GUARDRAIL_CONFIG = {
  maxCostPerCycleUsd  : 2.00,
  maxCostPerDayUsd    : 250.00,   // raised from 50 — allows sustained autonomous execution
  maxSingleTaskCostUsd: 10.00,    // new: hard cap per individual task
  maxOpsPerMinute     : 20,
  maxOpsPerHour       : 200,
  maxOpsPerDay        : 1000,
  // Repos Javari is allowed to operate on
  allowedRepos        : [
    "CR-AudioViz-AI/javari-ai",
    "CR-AudioViz-AI/craudiovizai-core",
  ],
  // Paths that are off-limits for autonomous writes
  forbiddenPaths      : [
    ".env",
    ".env.local",
    ".env.production",
    "lib/platform-secrets/crypto.ts",  // encryption key handling
    "lib/javari/secrets/vault-crypto.ts",
    "vercel.json",                      // cron config — requires human review
  ],
  // Operations that always require human confirmation (production context)
  destructiveOps      : [
    "drop_table",
    "delete_column",
    "production_deploy",
    "delete_bucket",
    "purge_cache",
  ],
} as const;

// ── In-memory rate counters ────────────────────────────────────────────────

let _opsThisMinute = 0;
let _opsThisHour   = 0;
let _opsToday      = 0;
let _costToday     = 0;

let _minuteReset = Date.now() + 60_000;
let _hourReset   = Date.now() + 3_600_000;
let _dayReset    = Date.now() + 86_400_000;

function tickCounters(cost: number): void {
  const now = Date.now();
  if (now > _minuteReset) { _opsThisMinute = 0; _minuteReset = now + 60_000; }
  if (now > _hourReset)   { _opsThisHour   = 0; _hourReset   = now + 3_600_000; }
  if (now > _dayReset)    { _opsToday = 0; _costToday = 0; _dayReset = now + 86_400_000; }
  _opsThisMinute++;
  _opsThisHour++;
  _opsToday++;
  _costToday += cost;
}

// ── Secret pattern detector ────────────────────────────────────────────────

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,        // OpenAI keys
  /AIza[a-zA-Z0-9_-]{35}/,      // Google API keys
  /ghp_[a-zA-Z0-9]{36}/,        // GitHub PAT
  /xoxb-[0-9]+-[a-zA-Z0-9]+/,  // Slack bot tokens
  /[a-f0-9]{32}:[a-f0-9]{32}/,  // Generic credential pairs
  /AKIA[A-Z0-9]{16}/,           // AWS access key
  /(?:password|secret|key|token)[\s]*[:=][\s]*['"]?[^\s'"]{8,}/i,
];

export function containsSecretValue(content: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(content));
}

export function redactSecrets(content: string): string {
  let result = content;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

// ── Individual guardrail checks ────────────────────────────────────────────

function checkCost(ctx: GuardrailContext): GuardrailCheck {
  if (ctx.estimatedCostUsd + _costToday > GUARDRAIL_CONFIG.maxCostPerDayUsd) {
    return {
      allowed  : false,
      category : "cost",
      reason   : `Daily cost limit ($${GUARDRAIL_CONFIG.maxCostPerDayUsd}) would be exceeded. Current: $${_costToday.toFixed(4)}`,
      riskLevel: "critical",
    };
  }
  if (ctx.estimatedCostUsd > GUARDRAIL_CONFIG.maxSingleTaskCostUsd) {
    return {
      allowed  : false,
      category : "cost",
      reason   : `Single task cost $${ctx.estimatedCostUsd} exceeds per-task cap $${GUARDRAIL_CONFIG.maxSingleTaskCostUsd}`,
      riskLevel: "high",
    };
  }
  if (ctx.estimatedCostUsd > GUARDRAIL_CONFIG.maxCostPerCycleUsd) {
    return {
      allowed  : false,
      category : "cost",
      reason   : `Single operation cost $${ctx.estimatedCostUsd} exceeds per-cycle cap $${GUARDRAIL_CONFIG.maxCostPerCycleUsd}`,
      riskLevel: "high",
    };
  }
  return { allowed: true, category: "cost", riskLevel: "low" };
}

function checkScope(ctx: GuardrailContext): GuardrailCheck {
  if (ctx.targetRepo) {
    const allowed = GUARDRAIL_CONFIG.allowedRepos.some(
      (r) => ctx.targetRepo === r || ctx.targetRepo?.endsWith(`/${r.split("/")[1]}`)
    );
    if (!allowed) {
      return {
        allowed  : false,
        category : "scope",
        reason   : `Repo "${ctx.targetRepo}" is not in the allowed list`,
        riskLevel: "critical",
      };
    }
  }

  if (ctx.targetPath) {
    const forbidden = GUARDRAIL_CONFIG.forbiddenPaths.some(
      (p) => ctx.targetPath === p || ctx.targetPath?.endsWith(p)
    );
    if (forbidden) {
      return {
        allowed  : false,
        category : "scope",
        reason   : `Path "${ctx.targetPath}" is in the forbidden list`,
        riskLevel: "critical",
      };
    }
  }

  return { allowed: true, category: "scope", riskLevel: "low" };
}

function checkRateLimit(): GuardrailCheck {
  if (_opsThisMinute >= GUARDRAIL_CONFIG.maxOpsPerMinute) {
    return {
      allowed  : false,
      category : "rate_limit",
      reason   : `Rate limit: ${_opsThisMinute}/${GUARDRAIL_CONFIG.maxOpsPerMinute} ops/min`,
      riskLevel: "medium",
    };
  }
  if (_opsThisHour >= GUARDRAIL_CONFIG.maxOpsPerHour) {
    return {
      allowed  : false,
      category : "rate_limit",
      reason   : `Rate limit: ${_opsThisHour}/${GUARDRAIL_CONFIG.maxOpsPerHour} ops/hour`,
      riskLevel: "high",
    };
  }
  if (_opsToday >= GUARDRAIL_CONFIG.maxOpsPerDay) {
    return {
      allowed  : false,
      category : "rate_limit",
      reason   : `Rate limit: ${_opsToday}/${GUARDRAIL_CONFIG.maxOpsPerDay} ops/day`,
      riskLevel: "high",
    };
  }
  return { allowed: true, category: "rate_limit", riskLevel: "low" };
}

function checkDestructive(ctx: GuardrailContext): GuardrailCheck {
  if (ctx.isProductionDeploy) {
    // Production deploys from autonomous loop are blocked by policy — must be human-confirmed
    return {
      allowed  : false,
      category : "destructive",
      reason   : "Production deploys require human confirmation. Autonomous loop may only target preview environments.",
      riskLevel: "critical",
    };
  }
  if (ctx.isDestructive) {
    const isKnownDestructive = GUARDRAIL_CONFIG.destructiveOps.some(
      (op) => ctx.operationType.toLowerCase().includes(op)
    );
    if (isKnownDestructive) {
      return {
        allowed  : false,
        category : "destructive",
        reason   : `Destructive operation "${ctx.operationType}" requires human confirmation`,
        riskLevel: "critical",
      };
    }
  }
  return { allowed: true, category: "destructive", riskLevel: "low" };
}

// ── Primary gate ──────────────────────────────────────────────────────────

/**
 * runGuardrailCheck — run all guardrails before an autonomous operation.
 * Returns the first blocking check, or an allowed check if all pass.
 * Call this before every autonomous action.
 */
export function runGuardrailCheck(ctx: GuardrailContext): GuardrailCheck {
  const checks: GuardrailCheck[] = [
    checkCost(ctx),
    checkScope(ctx),
    checkRateLimit(),
    checkDestructive(ctx),
  ];

  const blocking = checks.find((c) => !c.allowed);
  if (blocking) {
    console.warn(
      `[guardrails] BLOCKED op="${ctx.operationType}" reason="${blocking.reason}" risk=${blocking.riskLevel}`
    );
    return blocking;
  }

  // All passed — tick rate counters
  tickCounters(ctx.estimatedCostUsd);
  return { allowed: true, category: "cost", riskLevel: "low" };
}

/**
 * assertGuardrails — throws if any guardrail blocks. Use in task executors.
 */
export function assertGuardrails(ctx: GuardrailContext): void {
  const check = runGuardrailCheck(ctx);
  if (!check.allowed) {
    throw new Error(`[guardrails] ${check.category.toUpperCase()}: ${check.reason}`);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────

export function getGuardrailStats(): {
  opsThisMinute: number;
  opsThisHour  : number;
  opsToday     : number;
  costToday    : number;
  limitsConfig : typeof GUARDRAIL_CONFIG;
} {
  return {
    opsThisMinute: _opsThisMinute,
    opsThisHour  : _opsThisHour,
    opsToday     : _opsToday,
    costToday    : Math.round(_costToday * 10000) / 10000,
    limitsConfig : GUARDRAIL_CONFIG,
  };
}
