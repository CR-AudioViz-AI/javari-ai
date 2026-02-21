// lib/javari/factory/generators/index.ts
// Javari Module Factory — Code Generation Pipelines
// 2026-02-20 — STEP 4 implementation
//
// 6 generator pipelines, each using multi-agent delegation:
//   reactPageGenerator()         → architect plans, engineer generates
//   apiRouteGenerator()          → engineer generates, validator checks
//   supabaseSchemaGenerator()    → json_specialist (strict SQL output)
//   uiComponentGenerator()       → architect + engineer
//   utilityModuleGenerator()     → engineer
//   typesGenerator()             → json_specialist (strict types)
//
// Each generator:
//   1. Builds a role-specific prompt
//   2. Calls the appropriate pipeline via orchestrateTask()
//   3. Validates output
//   4. Returns GeneratorResult

import { orchestrateTask }  from "@/lib/javari/multi-ai/orchestrator";
import { validateResponse } from "@/lib/javari/multi-ai/validator";
import type { TaskNode }    from "@/lib/javari/autonomy/types";
import type { ModuleBlueprint, RouteSpec, ApiSpec, ComponentSpec, DatabaseSpec }
  from "../blueprint";
import type { FileNode }    from "../file-tree";
import { toPascal, toSlug, toCamel } from "../file-tree";
import type { OrchestrationEvent } from "@/lib/javari/multi-ai/orchestrator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratorResult {
  fileId:          string;
  path:            string;
  content:         string;
  agentRole:       string;
  validationScore?: number;
  durationMs:      number;
  success:         boolean;
  error?:          string;
}

export type GeneratorEmit = (event: {
  type:      string;
  moduleId:  string;
  fileId:    string;
  content?:  string;
  meta?:     Record<string, unknown>;
  timestamp: string;
}) => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(): string { return new Date().toISOString(); }

function makeSyntheticTask(
  id: string,
  title: string,
  description: string,
  type: TaskNode["type"],
  requiresJson: boolean,
  highRisk: boolean
): TaskNode {
  return {
    id,
    title,
    description,
    type,
    status:      "running",
    dependencies: [],
    dependents:  [],
    routing: {
      provider:            requiresJson ? "mistral" : "anthropic",
      model:               requiresJson ? "mistral-large-latest" : "claude-sonnet-4-20250514",
      requires_validation: true,
      requires_json:       requiresJson,
      high_risk:           highRisk,
      cost_sensitivity:    "moderate",
      fallback_chain:      requiresJson
        ? ["mistral", "openai", "anthropic"]
        : ["anthropic", "openai", "groq"],
      requires_reasoning_depth: !requiresJson,
    },
    attempt:      0,
    maxAttempts:  3,
    createdAt:    ts(),
    parentGoalId: id,
  };
}

async function runGenerator(
  task: TaskNode,
  emit: GeneratorEmit,
  moduleId: string,
  fileId: string
): Promise<{ text: string; agentRole: string }> {
  const orchEvents: OrchestrationEvent[] = [];
  const orchEmit = (e: OrchestrationEvent) => {
    orchEvents.push(e);
    emit({
      type:     `factory_${e.type}`,
      moduleId,
      fileId,
      content:  e.content,
      meta:     { role: e.role, provider: e.provider, ...e.meta },
      timestamp: e.timestamp,
    });
  };

  const result = await orchestrateTask(task, "", moduleId, orchEmit);

  if (!result.success || !result.finalOutput) {
    throw new Error(result.error ?? "Generator returned empty output");
  }

  const agentRole = result.agentsUsed[0] ?? "engineer";
  return { text: result.finalOutput, agentRole };
}

// ── 1. React Page Generator ───────────────────────────────────────────────────

export async function reactPageGenerator(
  blueprint: ModuleBlueprint,
  route: RouteSpec,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId  = `page_${route.path.replace(/\//g, "_").replace(/\[|\]/g, "")}`;
  const hasParams = route.hasParams;

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "reactPageGenerator", path: route.path }, timestamp: ts() });

  const prompt = `
Generate a complete Next.js 14 App Router page component for:

Module: ${blueprint.moduleName}
Route:  ${route.path}
Type:   ${route.type}
Description: ${route.description}

Requirements:
- TypeScript (strict mode)
- "use client" directive if using state/events, else Server Component
- Tailwind CSS for all styling
- shadcn/ui components (import from "@/components/ui/...")
- Proper loading states, error boundaries
- WCAG 2.2 AA accessibility (aria-labels, semantic HTML)
${hasParams ? `- Dynamic params: extract from \`params\` prop (e.g. params.id)` : ""}
${blueprint.auth !== "none" ? `- Check Supabase auth — redirect to /login if unauthenticated` : ""}
${blueprint.needsDataFetching ? `- Fetch data from /api/${blueprint.slug} using fetch or SWR` : ""}
- Export default function named ${toPascal(route.path.split("/").filter(Boolean).join("-"))}Page

Return ONLY the complete TypeScript file content. No explanations.
Start with imports. End with export default.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate page: ${route.path}`, prompt, "generation", false, false);
    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { path: route.path, chars: text.length }, timestamp: ts() });

    return { fileId, path: `app${route.path}/page.tsx`, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path: `app${route.path}/page.tsx`, content: "",
             agentRole: "engineer", durationMs: Date.now() - t0, success: false, error };
  }
}

// ── 2. API Route Generator ────────────────────────────────────────────────────

export async function apiRouteGenerator(
  blueprint: ModuleBlueprint,
  api: ApiSpec,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId  = `api_${api.path.replace(/\//g, "_").replace(/\[|\]/g, "").replace(/^_api_/, "")}`;

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "apiRouteGenerator", path: api.path }, timestamp: ts() });

  const hasId = api.path.includes("[id]");
  const prompt = `
Generate a complete Next.js 14 App Router API route handler for:

Module:  ${blueprint.moduleName}
Path:    ${api.path}
Methods: ${api.methods.join(", ")}
Description: ${api.description}

Requirements:
- TypeScript (strict mode, runtime = "edge" unless using pg)
- Return NextResponse.json() for all responses
- Proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Input validation with descriptive error messages
- Error handling with try/catch on every handler
${api.requiresAuth ? `- Supabase server-side auth check — 401 if not authenticated` : "- No auth required"}
${blueprint.database ? `- Use Supabase client from "@/lib/supabase/server"` : ""}
${hasId ? `- Extract id from params: const { id } = await context.params` : ""}
- CORS headers if needed

Methods to implement:
${api.methods.map((m) => `- ${m}: ${getMethodDescription(m, blueprint.moduleName)}`).join("\n")}

Return ONLY the complete TypeScript route.ts file. No explanations.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate API: ${api.path}`, prompt, "generation", false, true);
    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { path: api.path, methods: api.methods }, timestamp: ts() });

    const filePath = `app${api.path}/route.ts`;
    return { fileId, path: filePath, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path: `app${api.path}/route.ts`, content: "",
             agentRole: "engineer", durationMs: Date.now() - t0, success: false, error };
  }
}

function getMethodDescription(method: string, name: string): string {
  const m: Record<string, string> = {
    GET:    `return list of ${name} or single item`,
    POST:   `create new ${name}, validate body, return created item`,
    PUT:    `fully update ${name} by id`,
    PATCH:  `partially update ${name} by id`,
    DELETE: `soft-delete or hard-delete ${name} by id`,
  };
  return m[method] ?? method;
}

// ── 3. Supabase Schema Generator ──────────────────────────────────────────────

export async function supabaseSchemaGenerator(
  blueprint: ModuleBlueprint,
  table: DatabaseSpec,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId = `schema_${table.tableName}`;

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "supabaseSchemaGenerator", table: table.tableName }, timestamp: ts() });

  const colDefs = table.columns.map((c) => {
    const parts = [`  ${c.name} ${c.type.toUpperCase()}`];
    if (!c.nullable) parts.push("NOT NULL");
    if (c.default)   parts.push(`DEFAULT ${c.default}`);
    return parts.join(" ");
  }).join(",\n");

  const prompt = `
Generate a complete Supabase PostgreSQL migration SQL file for:

Table: ${table.tableName}
Module: ${blueprint.moduleName}
Auth required: ${blueprint.auth !== "none"}

Schema:
CREATE TABLE IF NOT EXISTS ${table.tableName} (
${colDefs}
);

Requirements:
- Full CREATE TABLE with all columns above
- CREATE UNIQUE INDEX on id (if UUID primary key)
- Appropriate indexes for foreign keys and common query patterns
- IF EXISTS guards on all statements
- trigger: auto-update updated_at on UPDATE (if table has updated_at)
${table.hasRls ? `- Enable RLS: ALTER TABLE ${table.tableName} ENABLE ROW LEVEL SECURITY;
- RLS policies:
  - "Users can read own data" for SELECT
  - "Users can insert own data" for INSERT  
  - "Users can update own data" for UPDATE
  - "Users can delete own data" for DELETE
  (all using: auth.uid() = user_id)` : "- No RLS needed (public table)"}
- COMMENT ON TABLE with module description

Return ONLY the complete SQL migration. No explanations. No markdown.
Start with -- Javari Module Factory migration comment.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate schema: ${table.tableName}`, prompt, "generation", false, false);
    // json_specialist for SQL strict output
    task.routing.provider = "mistral";
    task.routing.model    = "mistral-large-latest";
    task.routing.fallback_chain = ["mistral", "openai", "anthropic"];

    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);
    const migration_ts = Date.now();
    const filePath = `supabase/migrations/${migration_ts}_${table.tableName}.sql`;

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { table: table.tableName, path: filePath }, timestamp: ts() });

    return { fileId, path: filePath, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path: `supabase/migrations/${Date.now()}_${table.tableName}.sql`,
             content: "", agentRole: "json_specialist",
             durationMs: Date.now() - t0, success: false, error };
  }
}

// ── 4. UI Component Generator ─────────────────────────────────────────────────

export async function uiComponentGenerator(
  blueprint: ModuleBlueprint,
  component: ComponentSpec,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId = `component_${toSlug(component.name)}`;

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "uiComponentGenerator", component: component.name }, timestamp: ts() });

  const prompt = `
Generate a complete React component for:

Module:    ${blueprint.moduleName}
Component: ${component.name}
Path:      ${component.path}
Description: ${component.description}

Characteristics:
${component.hasList ? `- Renders a list/grid of items with pagination` : ""}
${component.hasForm ? `- Contains a form with validation (React Hook Form or native)` : ""}
${component.hasModal ? `- Includes a Modal/Dialog (use shadcn Dialog)` : ""}

Requirements:
- TypeScript strict mode
- "use client" directive (it's interactive)
- Tailwind CSS — polished, professional design
- shadcn/ui components (Button, Card, Input, Label, Dialog, etc.)
- Proper TypeScript interfaces for props
- Loading skeleton state
- Empty state with helpful message
- Error state with retry option
- Accessible: aria-labels, keyboard navigation
- Named export AND default export

Return ONLY the complete .tsx file. No explanations.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate component: ${component.name}`, prompt, "generation", false, false);
    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { component: component.name, chars: text.length }, timestamp: ts() });

    return { fileId, path: component.path, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path: component.path, content: "",
             agentRole: "engineer", durationMs: Date.now() - t0, success: false, error };
  }
}

// ── 5. Utility Module Generator ───────────────────────────────────────────────

export async function utilityModuleGenerator(
  blueprint: ModuleBlueprint,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId = `util_${blueprint.slug}`;
  const path   = `lib/utils/${blueprint.slug}.ts`;

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "utilityModuleGenerator", path }, timestamp: ts() });

  const prompt = `
Generate a complete TypeScript utility module for:

Module:      ${blueprint.moduleName}
Path:        ${path}
Description: ${blueprint.description}

Include:
- Data formatting functions (dates, numbers, strings)
- Validation helpers
- API fetch wrappers for /api/${blueprint.slug}
- Constants (STATUS_OPTIONS, etc.)
- Type guards
- Error parsing helpers

Requirements:
- TypeScript strict mode
- No React imports (pure utility)
- Named exports only (no default export)
- JSDoc on all exported functions

Return ONLY the complete .ts file. No explanations.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate utils: ${blueprint.slug}`, prompt, "generation", false, false);
    task.routing.provider = "anthropic";
    task.routing.model    = "claude-sonnet-4-20250514";
    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { path }, timestamp: ts() });

    return { fileId, path, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path, content: "",
             agentRole: "engineer", durationMs: Date.now() - t0, success: false, error };
  }
}

// ── 6. Types Generator ────────────────────────────────────────────────────────

export async function typesGenerator(
  blueprint: ModuleBlueprint,
  emit: GeneratorEmit
): Promise<GeneratorResult> {
  const t0 = Date.now();
  const fileId = `types_${blueprint.slug}`;
  const path   = `lib/types/${blueprint.slug}.ts`;
  const pascal = toPascal(blueprint.slug);

  emit({ type: "generator_start", moduleId: blueprint.moduleId, fileId,
    meta: { generator: "typesGenerator", path }, timestamp: ts() });

  const dbTable = blueprint.database?.[0];
  const colTypes = dbTable?.columns.map((c) => {
    const tsType: Record<string, string> = {
      uuid: "string", text: "string", integer: "number",
      boolean: "boolean", timestamptz: "string", jsonb: "Record<string, unknown>",
      numeric: "number",
    };
    return `  ${c.name}${c.nullable ? "?" : ""}: ${tsType[c.type] ?? "unknown"};`;
  }).join("\n") ?? `  id: string;\n  name: string;\n  createdAt: string;`;

  const prompt = `
Generate complete TypeScript type definitions for:

Module:      ${blueprint.moduleName}
Path:        ${path}
Description: ${blueprint.description}

Generate these types:
1. ${pascal} — the main data model (database row shape)
2. ${pascal}CreateInput — shape for creating a new item
3. ${pascal}UpdateInput — partial shape for updating
4. ${pascal}ListResponse — API list response shape
5. ${pascal}Status — string union of possible statuses

Database columns for ${pascal}:
${colTypes}

API routes:
${blueprint.apis.map((a) => `- ${a.path} (${a.methods.join(",")})`).join("\n")}

Requirements:
- TypeScript strict mode
- Zod schemas for runtime validation (import { z } from "zod")
- Export type aliases AND Zod schemas
- Proper JSDoc on all types

Return ONLY the complete .ts file. No explanations.
`.trim();

  try {
    const task = makeSyntheticTask(fileId, `Generate types: ${blueprint.slug}`, prompt, "generation", false, false);
    // json_specialist for strict type output
    task.routing.requires_json = false; // types are TS not JSON
    task.routing.provider      = "anthropic";
    task.routing.model         = "claude-sonnet-4-20250514";

    const { text, agentRole } = await runGenerator(task, emit, blueprint.moduleId, fileId);

    emit({ type: "generator_done", moduleId: blueprint.moduleId, fileId,
      meta: { path }, timestamp: ts() });

    return { fileId, path, content: text,
             agentRole, durationMs: Date.now() - t0, success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emit({ type: "generator_failed", moduleId: blueprint.moduleId, fileId,
      meta: { error }, timestamp: ts() });
    return { fileId, path, content: "",
             agentRole: "engineer", durationMs: Date.now() - t0, success: false, error };
  }
}
