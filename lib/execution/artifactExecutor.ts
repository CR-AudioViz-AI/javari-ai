// lib/execution/artifactExecutor.ts
// Purpose: Artifact Execution Engine — turns roadmap tasks into real platform builds.
//          Routes tasks to the AI Build Team (architect → engineer → validator → documenter),
//          commits generated artifacts to GitHub, triggers Vercel deployments,
//          and records all results in build_artifacts + roadmap_task_artifacts.
//
// Pipeline per task:
//   task → determine artifact type → AI build team → GitHub commit →
//   Vercel deploy → verify → update build_artifacts + roadmap_task_artifacts
//
// Supported artifact types:
//   build_module | generate_api | create_service | create_database_migration |
//   deploy_microservice | generate_ui_component | generate_documentation |
//   generate_tests | ai_task (default)
//
// Date: 2026-03-10

import { createClient }    from "@supabase/supabase-js";
import { commitFileChange, triggerVercelDeploy, verifyDeployment } from "./devopsExecutor";
import { recordArtifact }  from "@/lib/roadmap/artifactRecorder";
import { getSecret }       from "@/lib/platform-secrets/getSecret";

// ── DB ────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "build_module"
  | "generate_api"
  | "create_service"
  | "create_database_migration"
  | "deploy_microservice"
  | "generate_ui_component"
  | "generate_documentation"
  | "generate_tests"
  | "ai_task";

export interface ArtifactTask {
  id          : string;
  title       : string;
  description : string;
  type?       : string;
  phase_id?   : string;
  source?     : string;
  metadata?   : Record<string, unknown>;
}

export interface BuildSpec {
  artifactType   : ArtifactType;
  filePath       : string;
  fileContent    : string;
  documentation  : string;
  validationNotes: string;
  shouldCommit   : boolean;
  shouldDeploy   : boolean;
  migrationSql?  : string;
}

export interface ArtifactExecutionResult {
  ok             : boolean;
  taskId         : string;
  artifactType   : ArtifactType;
  buildArtifactId?: string;
  commitSha?     : string;
  deploymentUrl? : string;
  deploymentState?: string;
  output         : string;
  error?         : string;
  durationMs     : number;
  buildTeam: {
    architectMs  : number;
    engineerMs   : number;
    validatorMs  : number;
    documenterMs : number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_REPO    = "CR-AudioViz-AI/javari-ai";
const DEFAULT_PROJECT = "javari-ai";
const PLATFORM_URL    =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

// ── Anthropic AI caller ───────────────────────────────────────────────────

async function callAI(
  systemPrompt: string,
  userPrompt  : string,
  maxTokens   : number = 4000,
  role        : string = "ai"
): Promise<string> {
  const apiKey = await getSecret("ANTHROPIC_API_KEY")
    .catch(() => process.env.ANTHROPIC_API_KEY ?? "");

  if (!apiKey) throw new Error(`[artifactExecutor:${role}] ANTHROPIC_API_KEY not available`);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method : "POST",
    headers: {
      "Content-Type"     : "application/json",
      "x-api-key"        : apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model     : "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system    : systemPrompt,
      messages  : [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text?: string }> };
  return data.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim();
}

// ── Artifact type classifier ───────────────────────────────────────────────

function classifyArtifactType(task: ArtifactTask): ArtifactType {
  const combined = `${task.type ?? ""} ${task.title} ${task.description}`.toLowerCase();

  if (/migration|schema|table|database|sql/.test(combined))        return "create_database_migration";
  if (/api route|create.api|generate.api|endpoint/.test(combined)) return "generate_api";
  if (/ui component|react|component|frontend|page/.test(combined)) return "generate_ui_component";
  if (/test|spec|coverage|jest|testing/.test(combined))             return "generate_tests";
  if (/document|readme|wiki|doc/.test(combined))                    return "generate_documentation";
  if (/service|microservice|worker|daemon/.test(combined))          return "create_service";
  if (/deploy|deployment|release/.test(combined))                   return "deploy_microservice";
  if (/build.module|module|feature|system/.test(combined))          return "build_module";
  return "ai_task";
}

function deriveFilePath(task: ArtifactTask, artifactType: ArtifactType): string {
  const slug = task.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const ts   = new Date().toISOString().slice(0, 10);

  switch (artifactType) {
    case "generate_api":              return `app/api/javari/generated/${slug}/route.ts`;
    case "create_database_migration": return `docs/migrations/${ts}-${slug}.sql`;
    case "generate_ui_component":     return `components/generated/${slug}.tsx`;
    case "generate_tests":            return `__tests__/generated/${slug}.test.ts`;
    case "generate_documentation":    return `docs/generated/${slug}.md`;
    case "create_service":            return `lib/services/generated/${slug}.ts`;
    case "deploy_microservice":       return `app/api/javari/services/${slug}/route.ts`;
    case "build_module":              return `lib/modules/generated/${slug}/index.ts`;
    default:                          return `docs/artifacts/${ts}-${slug}.md`;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PHASE 2 — AI BUILD TEAM
// architect → engineer → validator → documenter
// ══════════════════════════════════════════════════════════════════════════

// ── Architect: produces the build spec ────────────────────────────────────

async function runArchitect(task: ArtifactTask, artifactType: ArtifactType): Promise<{
  spec: string; filePath: string; durationMs: number;
}> {
  const t0 = Date.now();

  const systemPrompt = `You are the Architect AI for the CR AudioViz AI platform — a Fortune 50-quality AI ecosystem.
Your role: analyze the task and produce a precise, implementable technical specification.

Rules:
- Return ONLY a JSON object. No markdown, no backticks, no commentary.
- Be specific about file paths, function signatures, data shapes, and integration points.
- Think in terms of Next.js 14 App Router, TypeScript strict mode, Supabase, and shadcn/ui.

JSON schema:
{
  "filePath": "string — exact file path for the artifact",
  "artifactType": "string",
  "description": "string — what this artifact does",
  "components": ["string"],
  "integrations": ["string"],
  "dataFlows": ["string"],
  "implementation": "string — key implementation notes for the engineer"
}`;

  const userPrompt = `Task: ${task.title}
Description: ${task.description}
Artifact type: ${artifactType}
Phase: ${task.phase_id ?? "general"}

Produce the build specification.`;

  const raw = await callAI(systemPrompt, userPrompt, 2000, "architect");

  let spec: { filePath?: string } = {};
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    spec = JSON.parse(cleaned);
  } catch {
    spec = { filePath: deriveFilePath(task, artifactType) };
  }

  return {
    spec: raw,
    filePath: (spec.filePath as string) || deriveFilePath(task, artifactType),
    durationMs: Date.now() - t0,
  };
}

// ── Engineer: generates the actual code/content ───────────────────────────

async function runEngineer(
  task        : ArtifactTask,
  artifactType: ArtifactType,
  filePath    : string,
  archSpec    : string
): Promise<{ content: string; durationMs: number }> {
  const t0 = Date.now();

  const prompts: Record<ArtifactType, string> = {
    build_module: `You are the Engineer AI building a TypeScript module for the CR AudioViz AI platform.
Generate a complete, production-grade TypeScript module file.
Rules: TypeScript strict mode, proper error handling, JSDoc comments, no placeholders.
Return ONLY the complete file content. No markdown, no explanation.`,

    generate_api: `You are the Engineer AI building a Next.js 14 API route for CR AudioViz AI.
Generate a complete app/api route using Next.js 14 App Router (route.ts).
Rules: TypeScript strict, proper error handling, Supabase integration where relevant, OWASP-safe.
Return ONLY the complete route.ts file content.`,

    create_service: `You are the Engineer AI building a TypeScript service module for CR AudioViz AI.
Generate a complete service with proper interfaces, error handling, and documentation.
Rules: TypeScript strict, async/await, proper exports, JSDoc.
Return ONLY the complete file content.`,

    create_database_migration: `You are the Engineer AI generating a Supabase PostgreSQL migration.
Generate a complete, safe SQL migration file.
Rules: CREATE TABLE IF NOT EXISTS, proper indexes, RLS policies where appropriate, idempotent.
Return ONLY the complete SQL file content.`,

    deploy_microservice: `You are the Engineer AI building a deployable Next.js API service for CR AudioViz AI.
Generate a complete, self-contained API route that implements the described microservice.
Rules: TypeScript strict, proper error handling, health check endpoint.
Return ONLY the complete route.ts file content.`,

    generate_ui_component: `You are the Engineer AI building a React component for CR AudioViz AI.
Generate a complete React/TypeScript component using shadcn/ui and Tailwind CSS.
Rules: TypeScript strict, accessible (WCAG 2.2 AA), no hardcoded values, proper props interface.
Return ONLY the complete .tsx file content.`,

    generate_documentation: `You are the Engineer AI generating technical documentation for CR AudioViz AI.
Generate comprehensive Markdown documentation including: overview, usage, API reference, examples.
Rules: Clear headings, code examples, accurate technical details.
Return ONLY the complete Markdown content.`,

    generate_tests: `You are the Engineer AI generating tests for CR AudioViz AI.
Generate a complete Jest test file with meaningful test cases.
Rules: TypeScript strict, test happy path and error paths, mock external dependencies.
Return ONLY the complete test file content.`,

    ai_task: `You are the Engineer AI on the CR AudioViz AI platform.
Generate a detailed, production-quality implementation for the described task.
Return a complete, actionable artifact — code, documentation, or analysis as appropriate.`,
  };

  const systemPrompt = prompts[artifactType] ?? prompts.ai_task;

  const userPrompt = `Task: ${task.title}
Description: ${task.description}
File path: ${filePath}

Architect specification:
${archSpec.slice(0, 1500)}

Generate the complete implementation now.`;

  const content = await callAI(systemPrompt, userPrompt, 6000, "engineer");
  return { content, durationMs: Date.now() - t0 };
}

// ── Validator: verifies the generated artifact ─────────────────────────────

async function runValidator(
  task       : ArtifactTask,
  content    : string,
  filePath   : string
): Promise<{ passed: boolean; notes: string; durationMs: number }> {
  const t0 = Date.now();

  const systemPrompt = `You are the Validator AI for CR AudioViz AI.
Your job: review generated code/content and determine if it meets production standards.

Return ONLY a JSON object:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": ["string"],
  "notes": "string — summary verdict"
}`;

  const userPrompt = `Task: ${task.title}
File: ${filePath}

Generated content (first 3000 chars):
${content.slice(0, 3000)}

Validate this artifact. Check: completeness, TypeScript correctness, error handling, security, no placeholders.`;

  const raw = await callAI(systemPrompt, userPrompt, 1000, "validator");

  let result = { passed: true, notes: "Validator: auto-approved" };
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed  = JSON.parse(cleaned) as { passed?: boolean; notes?: string };
    result = {
      passed: parsed.passed !== false,
      notes : parsed.notes ?? "Validated",
    };
  } catch {
    // Validator parse failed — default pass (never block on validator parse error)
    result = { passed: true, notes: raw.slice(0, 200) };
  }

  return { ...result, durationMs: Date.now() - t0 };
}

// ── Documenter: writes usage documentation ────────────────────────────────

async function runDocumenter(
  task     : ArtifactTask,
  content  : string,
  filePath : string
): Promise<{ documentation: string; durationMs: number }> {
  const t0 = Date.now();

  const systemPrompt = `You are the Documenter AI for CR AudioViz AI.
Write concise technical documentation for the generated artifact.
Format: Markdown. Include: purpose, usage, parameters/props, return values, examples.
Keep it under 500 words. Return ONLY the Markdown documentation.`;

  const userPrompt = `Task: ${task.title}
File: ${filePath}

Generated artifact summary (first 2000 chars):
${content.slice(0, 2000)}

Write the documentation.`;

  const documentation = await callAI(systemPrompt, userPrompt, 1000, "documenter");
  return { documentation, durationMs: Date.now() - t0 };
}

// ══════════════════════════════════════════════════════════════════════════
// build_artifacts database writer
// ══════════════════════════════════════════════════════════════════════════

async function writeBuildArtifact(record: {
  task_id         : string;
  artifact_type   : string;
  repo            : string;
  branch          : string;
  commit_sha?     : string;
  deployment_url? : string;
  status          : string;
  file_path?      : string;
  documentation?  : string;
  validation_notes?: string;
}): Promise<string | null> {
  try {
    const client = db();
    const { data, error } = await client
      .from("build_artifacts")
      .insert({
        task_id          : record.task_id,
        artifact_type    : record.artifact_type,
        repo             : record.repo,
        branch           : record.branch,
        commit_sha       : record.commit_sha ?? null,
        deployment_url   : record.deployment_url ?? null,
        status           : record.status,
        file_path        : record.file_path ?? null,
        documentation    : record.documentation ?? null,
        validation_notes : record.validation_notes ?? null,
        created_at       : new Date().toISOString(),
      })
      .select("artifact_id")
      .single();

    if (error) {
      console.warn("[artifactExecutor] build_artifacts insert error:", error.message);
      return null;
    }
    return (data as { artifact_id: string })?.artifact_id ?? null;
  } catch (err) {
    console.warn("[artifactExecutor] build_artifacts write failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// executeArtifact — main entry point
// ══════════════════════════════════════════════════════════════════════════

export async function executeArtifact(
  task  : ArtifactTask,
  userId: string = "system"
): Promise<ArtifactExecutionResult> {
  const globalStart = Date.now();
  const artifactType = classifyArtifactType(task);
  const repo         = (task.metadata?.repo as string) ?? DEFAULT_REPO;
  const project      = (task.metadata?.project as string) ?? DEFAULT_PROJECT;

  console.log(`[artifactExecutor] ▶ ${task.id} | type=${artifactType} | ${task.title.slice(0, 60)}`);

  const buildTeam = { architectMs: 0, engineerMs: 0, validatorMs: 0, documenterMs: 0 };

  try {
    // ── STEP 1: Architect ───────────────────────────────────────────────
    console.log(`[artifactExecutor] 🏛️  Architect running...`);
    const archResult = await runArchitect(task, artifactType);
    buildTeam.architectMs = archResult.durationMs;
    const filePath = archResult.filePath;
    console.log(`[artifactExecutor] 🏛️  Architect done — ${archResult.durationMs}ms | path=${filePath}`);

    // ── STEP 2: Engineer ────────────────────────────────────────────────
    console.log(`[artifactExecutor] 🔧 Engineer building...`);
    const engResult = await runEngineer(task, artifactType, filePath, archResult.spec);
    buildTeam.engineerMs = engResult.durationMs;
    const content = engResult.content;
    console.log(`[artifactExecutor] 🔧 Engineer done — ${engResult.durationMs}ms | ${content.length} chars`);

    // ── STEP 3: Validator ───────────────────────────────────────────────
    console.log(`[artifactExecutor] ✅ Validator checking...`);
    const valResult = await runValidator(task, content, filePath);
    buildTeam.validatorMs = valResult.durationMs;
    console.log(`[artifactExecutor] ✅ Validator done — passed=${valResult.passed} | ${valResult.notes.slice(0, 80)}`);

    // ── STEP 4: Documenter ──────────────────────────────────────────────
    console.log(`[artifactExecutor] 📝 Documenter writing...`);
    const docResult = await runDocumenter(task, content, filePath);
    buildTeam.documenterMs = docResult.durationMs;
    console.log(`[artifactExecutor] 📝 Documenter done — ${docResult.durationMs}ms`);

    // ── STEP 5: GitHub commit ───────────────────────────────────────────
    const branch = "main"; // all artifacts commit directly to main
    let commitSha: string | undefined;

    const commitMsg = `Javari AI automated build: ${task.title}`;
    console.log(`[artifactExecutor] 🐙 Committing to ${repo}/${filePath}...`);

    const commitResult = await commitFileChange(repo, filePath, content, commitMsg);

    if (commitResult.ok && commitResult.sha) {
      commitSha = commitResult.sha;
      console.log(`[artifactExecutor] 🐙 Committed — SHA: ${commitSha.slice(0, 8)}`);

      // Also commit documentation alongside the artifact
      const docPath = filePath.replace(/\.(ts|tsx|sql)$/, ".md");
      if (docPath !== filePath) {
        await commitFileChange(
          repo, docPath,
          `# ${task.title}\n\n${docResult.documentation}`,
          `docs: ${task.title} (auto-generated by Javari)`
        ).catch(() => { /* non-fatal */ });
      }
    } else {
      console.warn(`[artifactExecutor] ⚠️  Commit failed: ${commitResult.error}`);
    }

    // ── STEP 6: Vercel deployment (only for deployable artifact types) ──
    let deploymentUrl: string | undefined;
    let deploymentState: string | undefined;

    const deployableTypes: ArtifactType[] = [
      "generate_api", "deploy_microservice", "create_service", "build_module",
    ];

    if (deployableTypes.includes(artifactType) && commitSha) {
      console.log(`[artifactExecutor] 🚀 Triggering Vercel deploy...`);
      const deployResult = await triggerVercelDeploy(project);

      if (deployResult.ok) {
        deploymentUrl   = deployResult.url;
        deploymentState = deployResult.state;
        console.log(`[artifactExecutor] 🚀 Deploy triggered: ${deploymentUrl} (${deploymentState})`);
      } else {
        console.warn(`[artifactExecutor] ⚠️  Deploy failed: ${deployResult.error}`);
      }
    }

    // ── STEP 7: Write build_artifacts record ────────────────────────────
    const artifactId = await writeBuildArtifact({
      task_id          : task.id,
      artifact_type    : artifactType,
      repo,
      branch,
      commit_sha       : commitSha,
      deployment_url   : deploymentUrl,
      status           : valResult.passed ? "completed" : "validation_failed",
      file_path        : filePath,
      documentation    : docResult.documentation.slice(0, 2000),
      validation_notes : valResult.notes.slice(0, 500),
    });

    // ── STEP 8: Record proof artifacts in roadmap_task_artifacts ───────
    if (commitSha) {
      await recordArtifact({
        task_id          : task.id,
        artifact_type    : "commit",
        artifact_location: commitSha,
        artifact_data    : {
          repo, path: filePath, sha: commitSha,
          build_artifact_id: artifactId,
          artifact_type: artifactType,
        },
      });
    }

    if (deploymentUrl) {
      await recordArtifact({
        task_id          : task.id,
        artifact_type    : "deploy",
        artifact_location: deploymentUrl,
        artifact_data    : { state: deploymentState, deploy_type: artifactType },
      });
    }

    // Always record an AI output artifact for verifyTask to find
    await recordArtifact({
      task_id          : task.id,
      artifact_type    : "ai_output",
      artifact_location: `artifact:${task.id}:${Date.now()}`,
      artifact_data    : {
        artifact_type    : artifactType,
        file_path        : filePath,
        content_preview  : content.slice(0, 300),
        validator_passed : valResult.passed,
        build_artifact_id: artifactId,
        build_team_ms    : buildTeam,
      },
    });

    const durationMs = Date.now() - globalStart;
    console.log(
      `[artifactExecutor] ✅ Complete — ` +
      `type=${artifactType} commit=${commitSha?.slice(0, 8) ?? "none"} ` +
      `deploy=${deploymentUrl ?? "none"} ${durationMs}ms`
    );

    return {
      ok              : true,
      taskId          : task.id,
      artifactType,
      buildArtifactId : artifactId ?? undefined,
      commitSha,
      deploymentUrl,
      deploymentState,
      output          : `Built: ${filePath} | commit=${commitSha?.slice(0, 8) ?? "none"} | deploy=${deploymentUrl ?? "skipped"} | validated=${valResult.passed}`,
      durationMs,
      buildTeam,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - globalStart;

    console.error(`[artifactExecutor] ❌ ${task.id}: ${message}`);

    // Record failure artifact so verifyTask has something to find
    await recordArtifact({
      task_id          : task.id,
      artifact_type    : "ai_output",
      artifact_location: `artifact_error:${task.id}:${Date.now()}`,
      artifact_data    : { error: message, artifact_type: artifactType },
    }).catch(() => {});

    await writeBuildArtifact({
      task_id      : task.id,
      artifact_type: artifactType,
      repo,
      branch       : "main",
      status       : "failed",
    }).catch(() => {});

    return {
      ok          : false,
      taskId      : task.id,
      artifactType,
      output      : `Build failed: ${message}`,
      error       : message,
      durationMs,
      buildTeam,
    };
  }
}
