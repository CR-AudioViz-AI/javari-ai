// lib/ai/builders/engineer.ts
// Purpose: Engineer AI — generates complete, production-grade code from a BuildSpec.
//          Second stage of the AI Build Team pipeline.
//          Input: BuildSpec from architect.ts
//          Output: Complete file content ready to commit.
// Date: 2026-03-10

import { JavariRouter } from "@/lib/javari/router";
import type { BuildSpec } from "./architect";

export interface EngineerOutput {
  filePath   : string;
  content    : string;
  language   : string;
  lineCount  : number;
  durationMs : number;
}

// Route engineer calls through JavariRouter — code_task selects strongest coding model
async function anthropicCall(system: string, user: string, maxTokens: number): Promise<string> {
  const result = await JavariRouter.generate({
    taskType  : "code_task",
    prompt    : user,
    system,
    maxTokens,
  });
  if (!result.ok) throw new Error(`[engineer] JavariRouter failed: ${result.error}`);
  return result.content;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  build_module: `You are the Engineer AI building TypeScript modules for CR AudioViz AI — Fortune 50-quality.
Rules:
- TypeScript strict mode throughout. No 'any'. No type suppressions.
- Every function has JSDoc + error handling.
- Export all public interfaces and functions.
- No placeholder comments. No TODOs. Complete implementations.
- File header comment: filename, purpose, date.
Return ONLY the complete .ts file content. No markdown fences.`,

  generate_api: `You are the Engineer AI building Next.js 14 App Router API routes for CR AudioViz AI.
Rules:
- TypeScript strict. export const runtime = "nodejs". export const dynamic = "force-dynamic".
- GET and/or POST handlers with full error handling.
- Supabase createClient with service role for DB access.
- Return NextResponse.json with proper status codes.
- OWASP-safe: validate inputs, no SQL injection surface.
Return ONLY the complete route.ts file content. No markdown fences.`,

  create_service: `You are the Engineer AI building TypeScript service modules for CR AudioViz AI.
Rules:
- TypeScript strict. Named exports. No default exports on services.
- Factory function returning service instance.
- All async functions wrapped in try/catch.
- Structured logging (console.log with [service-name] prefix).
Return ONLY the complete .ts file content. No markdown fences.`,

  create_database_migration: `You are the Engineer AI writing Supabase PostgreSQL migrations for CR AudioViz AI.
Rules:
- CREATE TABLE IF NOT EXISTS for all tables.
- Include proper indexes.
- RLS policies with: ALTER TABLE t ENABLE ROW LEVEL SECURITY + policy definitions.
- Header comment with migration name, date, and description.
- Idempotent: safe to run multiple times.
Return ONLY the complete .sql file content. No markdown fences.`,

  deploy_microservice: `You are the Engineer AI building deployable Next.js 14 API microservices for CR AudioViz AI.
Rules:
- Self-contained: includes all logic in one file.
- Health check logic in GET handler.
- POST handler implements the described service.
- TypeScript strict. Error handling on all paths.
Return ONLY the complete route.ts file content. No markdown fences.`,

  generate_ui_component: `You are the Engineer AI building React/TypeScript UI components for CR AudioViz AI.
Platform stack: shadcn/ui, Tailwind CSS, Framer Motion.
Rules:
- TypeScript strict. Named export + default export both.
- Props interface defined above the component.
- WCAG 2.2 AA accessibility: aria labels, keyboard nav, focus management.
- Responsive design with Tailwind.
- No hardcoded strings. No inline styles.
Return ONLY the complete .tsx file content. No markdown fences.`,

  generate_documentation: `You are the Engineer AI writing technical documentation for CR AudioViz AI.
Rules:
- Markdown format with clear headings.
- Overview, Installation/Usage, API Reference, Examples, Notes sections.
- Code examples in appropriate language blocks.
- Accurate technical content — no vague descriptions.
Return ONLY the complete Markdown content. No preamble.`,

  generate_tests: `You are the Engineer AI writing Jest tests for CR AudioViz AI.
Rules:
- TypeScript strict. @jest/globals imports.
- Describe/it blocks with meaningful names.
- Test happy path, error paths, and edge cases.
- Mock all external dependencies (fetch, Supabase, etc).
- No flaky async tests — use proper awaits and mocks.
Return ONLY the complete .test.ts file content. No markdown fences.`,

  ai_task: `You are the Engineer AI on the CR AudioViz AI platform.
Generate a complete, production-quality implementation for the described task.
Rules:
- Production-grade. No placeholders. No TODOs.
- Appropriate format for the task (code, SQL, Markdown, config).
- If code: TypeScript strict mode with full error handling.
Return ONLY the artifact content. No preamble.`,
};

export async function runEngineer(spec: BuildSpec): Promise<EngineerOutput> {
  const t0 = Date.now();

  const systemPrompt = SYSTEM_PROMPTS[spec.artifactType] ?? SYSTEM_PROMPTS.ai_task;

  const userPrompt = `Task: ${spec.taskId}
File: ${spec.filePath}
Artifact type: ${spec.artifactType}
Framework: ${spec.framework}

ARCHITECT SPECIFICATION:
Components: ${spec.components.join(", ")}
Integrations: ${spec.integrations.join(", ")}
Data flows: ${spec.dataFlows.join(" | ")}
Interfaces to implement: ${spec.interfaces.join(", ")}

Implementation notes:
${spec.implementation}

${spec.migrationSql ? `SQL schema provided:\n${spec.migrationSql.slice(0, 800)}\n` : ""}
Security requirements: ${spec.securityNotes}
Performance targets: ${spec.performanceNotes}

Generate the complete implementation. No placeholders. Production-ready.`;

  // SQL migrations get shorter max_tokens; UI components and modules get more
  const maxTokens = spec.artifactType === "create_database_migration" ? 3000
    : spec.artifactType === "generate_documentation" ? 3000
    : 7000;

  const raw = await anthropicCall(systemPrompt, userPrompt, maxTokens);

  // Strip markdown code fences — AI may wrap output in ```typescript...``` or ```...```
  // even when instructed not to. This is a safety net that guarantees clean file content.
  const content = stripMarkdownFences(raw);
  const lineCount = content.split("\n").length;

  return {
    filePath  : spec.filePath,
    content,
    language  : spec.language,
    lineCount,
    durationMs: Date.now() - t0,
  };
}

/**
 * Strip markdown code fences from AI-generated content.
 * Handles: ```typescript, ```ts, ```sql, ```tsx, ```js, ```json, ``` (generic)
 * Also handles truncated files that end mid-content without a closing fence.
 */
function stripMarkdownFences(raw: string): string {
  const lines = raw.split("\n");
  const first = lines[0]?.trim() ?? "";

  // If first line is a code fence, strip it (and trailing fence if present)
  if (/^```/.test(first)) {
    const body = lines.slice(1);
    // Remove trailing ``` if present
    if (body[body.length - 1]?.trim() === "```") {
      body.pop();
    }
    return body.join("\n").trim();
  }

  return raw.trim();
}
