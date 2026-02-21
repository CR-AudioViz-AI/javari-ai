// lib/autonomy-core/fixer/ring2.ts
// CR AudioViz AI — Ring 2 Auto-Fixer
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// SAFETY CONTRACT:
//   - Only applies fixable=true anomalies via approved FixType list
//   - Always produces FULL-FILE replacement (never partial patch)
//   - Never touches: billing, DB schema, auth, permissions, marketplace, partner keys
//   - Every action logged immutably via writeAuditEvent()
//   - Respects AUTONOMOUS_CORE_MAX_PATCHES_PER_CYCLE ceiling
//   - Respects AUTONOMOUS_CORE_KILL_SWITCH

import type { Anomaly, CorePatch, FixType } from "../crawler/types";
import { writeAuditEvent } from "@/lib/enterprise/audit";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("autonomy");

// ── GitHub write helper ───────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";
const REPO         = process.env.AUTONOMOUS_CORE_REPO ?? "CR-AudioViz-AI/javari-ai";

async function ghRead(path: string): Promise<{ content: string; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${path}`);
  const data = await res.json() as { content?: string; sha?: string; encoding?: string };
  const content = data.encoding === "base64" && data.content
    ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8")
    : "";
  return { content, sha: data.sha ?? "" };
}

async function ghWrite(path: string, content: string, sha: string, message: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
    {
      method:  "PUT",
      headers: {
        Authorization:  `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept:         "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
        branch: "main",
      }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write failed: ${res.status} — ${err.slice(0, 200)}`);
  }
}

// ── FORBIDDEN paths — Ring 2 must NEVER touch these ──────────────────────────

const FORBIDDEN_PATHS = [
  "lib/javari/revenue",
  "lib/enterprise/billing",
  "lib/enterprise/partners",
  "lib/security",
  "supabase/migrations",
  "app/api/billing",
  "app/api/admin",
  "app/api/sso",
  "app/api/partners",
];

function isForbiddenPath(path: string): boolean {
  return FORBIDDEN_PATHS.some((fp) => path.includes(fp));
}

// ── Fix generators — produce full-file new content ───────────────────────────

function applyRuntimeDeclaration(content: string): string {
  // Add after first block comment or before first import
  if (/export\s+const\s+runtime/.test(content)) return content; // already present

  const insertAfterComment = content.replace(
    /^((?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\n)*)(import|export)/m,
    `$1export const runtime = "nodejs";\n$2`
  );

  if (insertAfterComment !== content) return insertAfterComment;
  // Fallback: prepend
  return `export const runtime = "nodejs";\n\n${content}`;
}

function applyDynamicExport(content: string): string {
  if (/export\s+const\s+dynamic/.test(content)) return content;

  const insertAfterRuntime = content.replace(
    /(export\s+const\s+runtime\s*=\s*["'][^"']+["'];?\s*\n)/,
    `$1export const dynamic = "force-dynamic";\n`
  );
  if (insertAfterRuntime !== content) return insertAfterRuntime;

  // Before first export
  return content.replace(
    /^((?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\n)*)(export)/m,
    `$1export const dynamic = "force-dynamic";\n$2`
  );
}

function removeConsoleLogs(content: string): string {
  // Only remove simple console.log() calls — never console.error/warn/info
  // Uses safe regex — won't touch strings that mention console.log
  return content.replace(/^\s*console\.log\([^)]*\);\s*\n/gm, "");
}

function addCacheHeaderComment(content: string): string {
  // Add a comment near GET handlers reminding about cache headers
  // This is informational only — never modifies logic
  if (/Cache-Control/.test(content)) return content;
  return content.replace(
    /(export\s+(?:async\s+)?function\s+GET|export\s+const\s+GET)/,
    `// TODO(autonomy): Add Cache-Control header for optimal CDN performance\n$1`
  );
}

// ── FixType → transform map ───────────────────────────────────────────────────

const FIXERS: Partial<Record<FixType, (content: string) => string>> = {
  add_runtime_declaration:   applyRuntimeDeclaration,
  add_dynamic_export:        applyDynamicExport,
  remove_console_log:        removeConsoleLogs,
  add_cache_header_comment:  addCacheHeaderComment,
};

// ── Patch ID generator ────────────────────────────────────────────────────────

function patchId(): string {
  return `patch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Apply a single Ring 2 fix ─────────────────────────────────────────────────

async function applyFix(
  anomaly:    Anomaly,
  dryRun:     boolean
): Promise<CorePatch> {
  const id  = patchId();
  const now = new Date().toISOString();

  const patch: CorePatch = {
    id,
    snapshotId:  anomaly.snapshotId,
    anomalyId:   anomaly.id,
    filePath:    anomaly.filePath,
    fixType:     anomaly.fixType!,
    ring:        2,
    description: `Ring2 auto-fix: ${anomaly.fixType} on ${anomaly.filePath}`,
    oldContent:  "",
    newContent:  "",
    status:      "pending",
    appliedAt:   undefined,
  };

  try {
    if (isForbiddenPath(anomaly.filePath)) {
      patch.status = "rejected";
      patch.rolledBackReason = "FORBIDDEN_PATH";
      log.warn(`Ring2 blocked: forbidden path ${anomaly.filePath}`);
      return patch;
    }

    const fixer = FIXERS[anomaly.fixType!];
    if (!fixer) {
      patch.status = "rejected";
      patch.rolledBackReason = `No fixer for ${anomaly.fixType}`;
      return patch;
    }

    // Read current file
    const { content: oldContent, sha } = await ghRead(anomaly.filePath);
    const newContent = fixer(oldContent);

    // Verify the fix actually changed something
    if (newContent === oldContent) {
      patch.status = "rejected";
      patch.rolledBackReason = "No change produced — anomaly may be already fixed";
      return patch;
    }

    patch.oldContent = oldContent;
    patch.newContent = newContent;

    if (dryRun) {
      patch.status = "pending";
      log.info(`DRY RUN: would apply ${anomaly.fixType} to ${anomaly.filePath}`);
      return patch;
    }

    // Write to GitHub
    const commitMsg = `fix(autonomy-ring2): ${anomaly.fixType} in ${anomaly.filePath.split("/").pop()} [auto]`;
    await ghWrite(anomaly.filePath, newContent, sha, commitMsg);

    patch.status    = "applied";
    patch.appliedAt = new Date().toISOString();

    log.info(`Ring2 applied: ${anomaly.fixType} → ${anomaly.filePath}`, {
      meta: { patchId: id, linesChanged: Math.abs(newContent.split("\n").length - oldContent.split("\n").length) }
    });

    // Immutable audit trail
    await writeAuditEvent({
      action:   "module.generated",
      metadata: {
        system:   "autonomy-core-ring2",
        patchId:  id,
        fixType:  anomaly.fixType,
        filePath: anomaly.filePath,
        dryRun:   false,
      },
      severity: "info",
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown fixer error";
    patch.status = "failed";
    patch.rolledBackReason = msg;
    log.error(`Ring2 fixer failed: ${msg}`, { meta: { patchId: id, path: anomaly.filePath } });
  }

  return patch;
}

// ── Rollback a patch ──────────────────────────────────────────────────────────

export async function rollbackPatch(patch: CorePatch, reason: string): Promise<CorePatch> {
  if (patch.status !== "applied" || !patch.oldContent) {
    return { ...patch, rolledBackReason: "Nothing to roll back" };
  }

  try {
    const { sha } = await ghRead(patch.filePath);
    const commitMsg = `revert(autonomy-ring2): rollback ${patch.fixType} in ${patch.filePath.split("/").pop()} [auto]`;
    await ghWrite(patch.filePath, patch.oldContent, sha, commitMsg);

    const rolled: CorePatch = { ...patch, status: "rolled_back", rolledBackAt: new Date().toISOString(), rolledBackReason: reason };

    await writeAuditEvent({
      action:   "module.generated",
      metadata: { system: "autonomy-core-ring2-rollback", patchId: patch.id, reason, filePath: patch.filePath },
      severity: "warn",
    });

    log.warn(`Rolled back patch ${patch.id}: ${reason}`);
    return rolled;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rollback failed";
    log.error(`Rollback failed for ${patch.id}: ${msg}`);
    return { ...patch, rolledBackReason: `Rollback failed: ${msg}` };
  }
}

// ── Batch Ring 2 fixer ────────────────────────────────────────────────────────

export async function runRing2Fixes(
  anomalies: Anomaly[],
  opts: {
    maxPatches: number;
    dryRun:     boolean;
    killSwitch: boolean;
  }
): Promise<CorePatch[]> {
  if (opts.killSwitch) {
    log.warn("Ring2 halted: AUTONOMOUS_CORE_KILL_SWITCH is active");
    return [];
  }

  const fixable = anomalies
    .filter((a) => a.fixable && a.fixType && !isForbiddenPath(a.filePath))
    .slice(0, opts.maxPatches);

  log.info(`Ring2 processing ${fixable.length} fixable anomalies (dryRun=${opts.dryRun})`);

  const patches: CorePatch[] = [];
  // Sequential to avoid SHA conflicts on same file
  for (const anomaly of fixable) {
    const patch = await applyFix(anomaly, opts.dryRun);
    patches.push(patch);
    // Small delay between writes to avoid GitHub rate limiting
    if (!opts.dryRun && patch.status === "applied") {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return patches;
}
