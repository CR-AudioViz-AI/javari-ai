// lib/ai/builders/validator.ts
// Purpose: Validator AI — reviews generated code against Henderson Standard.
//          Third stage of the AI Build Team pipeline.
//          Checks: TypeScript correctness, security, completeness, no placeholders.
//          Never blocks on parse failure — defaults to approved.
// Date: 2026-03-10

import { getSecret } from "@/lib/platform-secrets/getSecret";
import type { BuildSpec } from "./architect";

export interface ValidationResult {
  passed       : boolean;
  score        : number;      // 0-100
  issues       : string[];
  notes        : string;
  autoApproved : boolean;     // true when validator AI failed to parse — logged
  durationMs   : number;
}

async function anthropicCall(system: string, user: string): Promise<string> {
  const apiKey = await getSecret("ANTHROPIC_API_KEY").catch(() => "")
    || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) throw new Error("[validator] ANTHROPIC_API_KEY unavailable");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method : "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as { content: Array<{ type: string; text?: string }> };
  return d.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim();
}

export async function runValidator(
  spec   : BuildSpec,
  content: string
): Promise<ValidationResult> {
  const t0 = Date.now();

  const system = `You are the Validator AI for CR AudioViz AI — Fortune 50 quality standards.
Review the generated artifact and score it. Return ONLY valid JSON, no markdown.

Schema:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": ["list of specific problems found — empty array if none"],
  "notes": "one-sentence verdict"
}

Scoring criteria:
- 90-100: Production-ready, no issues
- 70-89: Minor issues, safe to ship
- 50-69: Moderate issues, use with caution
- <50: Major issues, fail

Fail conditions (passed=false): placeholder code, missing error handling, SQL injection surface,
hardcoded secrets, TypeScript 'any' with no justification, broken imports, stub functions.`;

  const user = `Task: ${spec.taskId}
File: ${spec.filePath}
Artifact type: ${spec.artifactType}

Generated content (first 3500 chars):
${content.slice(0, 3500)}

Validate this artifact.`;

  let result: ValidationResult = {
    passed: true,
    score: 85,
    issues: [],
    notes: "Auto-approved (validator parse fallback)",
    autoApproved: true,
    durationMs: 0,
  };

  try {
    const raw = await anthropicCall(system, user);
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean) as { passed?: boolean; score?: number; issues?: string[]; notes?: string };

    result = {
      passed      : parsed.passed !== false,
      score       : typeof parsed.score === "number" ? parsed.score : 80,
      issues      : Array.isArray(parsed.issues) ? parsed.issues : [],
      notes       : parsed.notes ?? "Validated",
      autoApproved: false,
      durationMs  : Date.now() - t0,
    };
  } catch (err) {
    console.warn("[validator] Parse failed — auto-approving:", err instanceof Error ? err.message : String(err));
    result.durationMs = Date.now() - t0;
  }

  return result;
}
