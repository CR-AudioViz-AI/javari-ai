// lib/javari/multi-ai/validator.ts
// Javari Validator Stage — Step 1 routing engine
// 2026-02-20 — STEP 1 implementation
//
// Purpose: After any AI generation, run a fast Claude validation pass when:
//   - context.requires_validation === true
//   - context.high_risk === true
//   - output appears empty or malformed
//
// Design principles:
//   - NEVER loops: max 1 validation attempt per generation
//   - Fast: uses claude-haiku-4 (low cost) not Sonnet unless escalated
//   - Non-blocking: validation failures return best-effort + reason, not crash
//   - Streaming-safe: validation is buffered, does not interrupt SSE
//   - Returns original content if validator call fails (graceful degradation)

import { vault } from "@/lib/javari/secrets/vault";
import type { RoutingContext } from "./routing-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  score: number;           // 0–100, 100 = perfect
  issues: string[];        // human-readable list of problems found
  corrected?: string;      // if validator rewrote, the corrected output
  model: string;           // which model did the validation
  durationMs: number;
  skipped: boolean;        // true if validator was not invoked
  skipReason?: string;
}

export interface ValidatorOptions {
  /** Max characters of content to validate (prevents huge costs). Default: 8000 */
  maxContentChars?: number;
  /** Use more expensive claude-sonnet for high-risk. Default: false (haiku) */
  useFullModel?: boolean;
  /** If validation fails and fixable, attempt rewrite. Default: true */
  attemptFix?: boolean;
}

// ── Validation rubric ─────────────────────────────────────────────────────────

const VALIDATION_SYSTEM_PROMPT = `You are a quality validator for Javari AI, an autonomous business AI system.
Your job: Review AI-generated content and check for critical issues.

Respond ONLY with this exact JSON structure (no markdown, no backticks):
{
  "score": <0-100>,
  "passed": <true|false>,
  "issues": [<string>, ...],
  "fix_required": <true|false>,
  "corrected": "<corrected content or null>"
}

Score rubric:
- 90–100: No issues. "passed": true
- 70–89: Minor issues (style, verbosity). "passed": true
- 50–69: Moderate issues (incomplete, off-topic). "passed": false, "fix_required": true
- 0–49: Severe issues (hallucination, empty, harmful, wrong). "passed": false, "fix_required": true

Check for:
1. Empty or extremely short responses (< 10 words)
2. Truncated responses ending mid-sentence
3. Repeating the user prompt verbatim without answering
4. Hallucinated facts, URLs, or filenames
5. Refusals without valid reason
6. JSON output that is malformed (if JSON was requested)
7. Code that contains obvious syntax errors
8. Responses that ignore the actual question

If "fix_required": true, provide a corrected version in "corrected" field.
If no fix possible, set "corrected": null.`;

// ── Core validator ────────────────────────────────────────────────────────────

function shouldSkipValidation(
  content: string,
  ctx: RoutingContext
): { skip: boolean; reason: string } {
  if (!ctx.requires_validation && !ctx.high_risk) {
    return { skip: true, reason: "validation_not_required" };
  }
  if (!content || content.trim().length < 10) {
    // Empty content — skip validator, mark as failed at caller level
    return { skip: true, reason: "content_too_short_for_validation" };
  }
  return { skip: false, reason: "" };
}

async function callClaudeValidator(
  userPrompt: string,
  generatedContent: string,
  useFullModel: boolean,
  maxChars: number
): Promise<{ score: number; passed: boolean; issues: string[]; corrected: string | null; model: string }> {
  const apiKey = vault.get("anthropic");
  if (!apiKey) {
    throw new Error("Anthropic API key not available for validator");
  }

  // Use Haiku for cost efficiency; Sonnet only for high-risk
  const model = useFullModel
    ? "claude-sonnet-4-20250514"
    : "claude-haiku-4-5-20251001";

  // Truncate to avoid huge costs
  const truncated = generatedContent.slice(0, maxChars);
  const wasT = truncated.length < generatedContent.length;

  const userMessage = `USER REQUEST:
${userPrompt.slice(0, 500)}

AI-GENERATED RESPONSE${wasT ? " [TRUNCATED]" : ""}:
${truncated}

Validate this response. Return ONLY the JSON object.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: VALIDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(12_000), // 12s hard limit for validator
  });

  if (!res.ok) {
    throw new Error(`Claude validator HTTP ${res.status}`);
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = data.content?.[0]?.text ?? "{}";

  // Parse — strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  const parsed = JSON.parse(cleaned) as {
    score?: number;
    passed?: boolean;
    issues?: string[];
    corrected?: string | null;
  };

  return {
    score:     typeof parsed.score   === "number"  ? parsed.score : 50,
    passed:    typeof parsed.passed  === "boolean" ? parsed.passed : false,
    issues:    Array.isArray(parsed.issues)         ? parsed.issues : ["Validation parse error"],
    corrected: typeof parsed.corrected === "string" ? parsed.corrected : null,
    model,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate a generated response.
 * Never throws — always returns a ValidationResult.
 * Called ONCE per generation. Never called recursively.
 */
export async function validateResponse(
  userPrompt: string,
  generatedContent: string,
  ctx: RoutingContext,
  opts: ValidatorOptions = {}
): Promise<ValidationResult> {
  const t0 = Date.now();
  const maxChars  = opts.maxContentChars ?? 8_000;
  const fullModel = opts.useFullModel ?? ctx.high_risk;

  // ── Pre-check: should we even validate? ──────────────────────────────────
  const { skip, reason } = shouldSkipValidation(generatedContent, ctx);
  if (skip) {
    return {
      passed: true,
      score: 85,
      issues: [],
      model: "none",
      durationMs: Date.now() - t0,
      skipped: true,
      skipReason: reason,
    };
  }

  // ── Quick heuristic checks (no API cost) ─────────────────────────────────
  const quickIssues: string[] = [];
  const trimmed = generatedContent.trim();

  if (trimmed.length < 20) {
    quickIssues.push("Response is extremely short (< 20 chars)");
  }
  const endsAbruptly = !trimmed.match(/[.!?'"`)\]}>]$/) && trimmed.length > 100;
  if (endsAbruptly) {
    quickIssues.push("Response appears truncated (ends without punctuation)");
  }
  const isPromptRepeat =
    userPrompt.length > 20 &&
    trimmed.toLowerCase().startsWith(userPrompt.slice(0, 50).toLowerCase());
  if (isPromptRepeat) {
    quickIssues.push("Response repeats the user prompt verbatim");
  }

  if (quickIssues.length > 0 && trimmed.length < 50) {
    // Clear failure — don't bother calling Claude
    return {
      passed: false,
      score: 20,
      issues: quickIssues,
      model: "heuristic",
      durationMs: Date.now() - t0,
      skipped: false,
    };
  }

  // ── Claude validator call ─────────────────────────────────────────────────
  try {
    const result = await callClaudeValidator(
      userPrompt,
      generatedContent,
      fullModel,
      maxChars
    );

    return {
      passed:     result.passed,
      score:      result.score,
      issues:     [...quickIssues, ...result.issues],
      corrected:  result.corrected ?? undefined,
      model:      result.model,
      durationMs: Date.now() - t0,
      skipped:    false,
    };
  } catch (err) {
    // Validator failed — gracefully pass through original content
    console.warn("[Validator] Call failed, passing through:", err instanceof Error ? err.message : err);
    return {
      passed:     true,
      score:      70,
      issues:     ["Validator unavailable — content unverified"],
      model:      "error",
      durationMs: Date.now() - t0,
      skipped:    false,
      skipReason: "validator_error",
    };
  }
}

/**
 * Quick empty/malformed check — no API call.
 * Used in fallback chain to decide whether to try next provider.
 */
export function isOutputMalformed(content: string | null | undefined): boolean {
  if (!content) return true;
  const t = content.trim();
  if (t.length < 10) return true;
  // Check for common error payloads mistakenly included in output
  if (t.startsWith('{"error"') && t.length < 200) return true;
  if (t === "undefined" || t === "null") return true;
  return false;
}
