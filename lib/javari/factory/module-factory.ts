// lib/javari/factory/module-factory.ts
// Javari Module Factory — Main Entrypoint
// 2026-02-20 — STEP 4 implementation
//
// Orchestrates the full module generation pipeline:
//   1. buildBlueprint()        — parse description → blueprint
//   2. planGoal()              — blueprint.generationGoal → TaskGraph
//   3. executeGraph()          — multi-agent execution per task
//   4. [parallel] generators   — 6 specialized pipelines
//   5. assembleModule()        — conflict resolve + normalize
//   6. emit SSE events throughout
//
// SSE Event Map:
//   factory_plan_created     → blueprint summary, task count
//   factory_generator_start  → which file + which agent
//   factory_agent_start      → (forwarded from orchestrator)
//   factory_agent_complete   → agent finished one file
//   factory_generator_done   → file content ready
//   factory_generator_failed → file failed, will skip
//   factory_assemble_start   → collecting outputs
//   factory_assemble_done    → bundle ready, file count
//   factory_done             → full module package summary
//   factory_error            → fatal error

import { buildBlueprint, blueprintToPlanningSummary } from "./blueprint";
import {
  createModuleFileTree,
  createFileNode,
  updateFileNode,
  buildTreeView,
} from "./file-tree";
import {
  reactPageGenerator,
  apiRouteGenerator,
  supabaseSchemaGenerator,
  uiComponentGenerator,
  utilityModuleGenerator,
  typesGenerator,
  type GeneratorResult,
  type GeneratorEmit,
} from "./generators/index";
import { assembleModule, bundleSummary } from "./assemble";
import type { ModuleBlueprint, BlueprintOptions } from "./blueprint";
import type { ModuleBundle } from "./assemble";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FactoryOptions extends BlueprintOptions {
  /** Skip generators that would produce very large files. Default: false */
  skipHeavyGenerators?: boolean;
  /** Run generators in parallel (faster, more API calls). Default: true */
  allowParallelism?: boolean;
  /** Generate utility module. Default: true */
  includeUtils?: boolean;
  /** Generate types file. Default: true */
  includeTypes?: boolean;
}

export type FactoryEventType =
  | "factory_plan_created"
  | "factory_generator_start"
  | "factory_agent_start"
  | "factory_agent_output"
  | "factory_agent_complete"
  | "factory_agent_failed"
  | "factory_generator_done"
  | "factory_generator_failed"
  | "factory_assemble_start"
  | "factory_assemble_done"
  | "factory_done"
  | "factory_error";

export interface FactoryEvent {
  type:       FactoryEventType;
  moduleId:   string;
  moduleName: string;
  fileId?:    string;
  content?:   string;
  meta?:      Record<string, unknown>;
  timestamp:  string;
}

export interface FactoryResult {
  success:   boolean;
  bundle?:   ModuleBundle;
  error?:    string;
  durationMs: number;
}

// ── Factory runner ────────────────────────────────────────────────────────────

/**
 * runModuleFactory — full end-to-end module generation.
 * Streams events via emit(). Returns final bundle.
 */
export async function runModuleFactory(
  moduleName:  string,
  description: string,
  emit:        (e: FactoryEvent) => void,
  options:     FactoryOptions = {}
): Promise<FactoryResult> {
  const t0 = Date.now();

  const ts = () => new Date().toISOString();

  const emitEv = (
    type:      FactoryEventType,
    moduleId:  string,
    partial:   Partial<Omit<FactoryEvent, "type" | "moduleId" | "moduleName" | "timestamp">> = {}
  ) => emit({ type, moduleId, moduleName, timestamp: ts(), ...partial });

  // ── 1. Build blueprint ─────────────────────────────────────────────────────
  let blueprint: ModuleBlueprint;
  try {
    blueprint = buildBlueprint(moduleName, description, {
      complexity:     options.complexity,
      auth:           options.auth,
      includeTests:   options.includeTests,
      includeSchema:  options.includeSchema,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emitEv("factory_error", "init", { meta: { error, phase: "blueprint" } });
    return { success: false, error, durationMs: Date.now() - t0 };
  }

  emitEv("factory_plan_created", blueprint.moduleId, {
    meta: {
      summary:        blueprintToPlanningSummary(blueprint),
      routes:         blueprint.routes.length,
      apis:           blueprint.apis.length,
      components:     blueprint.components.length,
      hasDatabase:    !!blueprint.database,
      complexity:     blueprint.complexity,
      auth:           blueprint.auth,
      estimatedTasks: blueprint.estimatedTasks,
    },
  });

  // ── 2. Build file tree (planning manifest) ─────────────────────────────────
  const fileNodes = [
    ...blueprint.routes.map((r) =>
      createFileNode(`page_${r.path.replace(/\//g,"_")}`, `app${r.path}/page.tsx`, "page")
    ),
    ...blueprint.apis.map((a) =>
      createFileNode(`api_${a.path.replace(/\//g,"_").replace(/\[|\]/g,"")}`,
        `app${a.path}/route.ts`, "api_route")
    ),
    ...blueprint.components.map((c) =>
      createFileNode(`comp_${c.name.toLowerCase()}`, c.path, "component")
    ),
    ...(blueprint.database?.map((db) =>
      createFileNode(`schema_${db.tableName}`,
        `supabase/migrations/${Date.now()}_${db.tableName}.sql`, "schema")
    ) ?? []),
    ...(options.includeUtils !== false
      ? [createFileNode(`util_${blueprint.slug}`, `lib/utils/${blueprint.slug}.ts`, "util")]
      : []),
    ...(options.includeTypes !== false
      ? [createFileNode(`types_${blueprint.slug}`, `lib/types/${blueprint.slug}.ts`, "type")]
      : []),
  ];

  const tree = createModuleFileTree(blueprint.moduleId, moduleName, fileNodes);

  // ── 3. Generator emit wrapper ──────────────────────────────────────────────
  const genEmit: GeneratorEmit = (e) => {
    emit({
      type:       (e.type.startsWith("factory_") ? e.type : `factory_${e.type}`) as FactoryEventType,
      moduleId:   blueprint.moduleId,
      moduleName,
      fileId:     e.fileId,
      content:    e.content,
      meta:       e.meta,
      timestamp:  e.timestamp,
    });
  };

  // ── 4. Run generators ──────────────────────────────────────────────────────
  const allResults: GeneratorResult[] = [];
  const allowParallel = options.allowParallelism ?? true;

  // Helper: run single generator with error wrapper
  async function safeRun(fn: () => Promise<GeneratorResult>): Promise<void> {
    try {
      const r = await fn();
      allResults.push(r);
    } catch (err) {
      console.error("[Factory] Generator threw:", err instanceof Error ? err.message : err);
    }
  }

  if (allowParallel) {
    // Phase A: Pages + APIs + Types in parallel (independent)
    const phaseA: Array<() => Promise<GeneratorResult>> = [
      ...blueprint.routes.map((r) => () => reactPageGenerator(blueprint, r, genEmit)),
      ...blueprint.apis.map((a)   => () => apiRouteGenerator(blueprint, a, genEmit)),
      ...(blueprint.database?.map((db) => () => supabaseSchemaGenerator(blueprint, db, genEmit)) ?? []),
      ...(options.includeTypes !== false ? [() => typesGenerator(blueprint, genEmit)] : []),
    ];

    await Promise.allSettled(phaseA.map((fn) => safeRun(fn)));

    // Phase B: Components + utils (may depend on types)
    const phaseB: Array<() => Promise<GeneratorResult>> = [
      ...blueprint.components.map((c) => () => uiComponentGenerator(blueprint, c, genEmit)),
      ...(options.includeUtils !== false ? [() => utilityModuleGenerator(blueprint, genEmit)] : []),
    ];

    await Promise.allSettled(phaseB.map((fn) => safeRun(fn)));
  } else {
    // Sequential — one at a time
    for (const route of blueprint.routes) {
      await safeRun(() => reactPageGenerator(blueprint, route, genEmit));
    }
    for (const api of blueprint.apis) {
      await safeRun(() => apiRouteGenerator(blueprint, api, genEmit));
    }
    for (const comp of blueprint.components) {
      await safeRun(() => uiComponentGenerator(blueprint, comp, genEmit));
    }
    for (const db of blueprint.database ?? []) {
      await safeRun(() => supabaseSchemaGenerator(blueprint, db, genEmit));
    }
    if (options.includeUtils !== false) {
      await safeRun(() => utilityModuleGenerator(blueprint, genEmit));
    }
    if (options.includeTypes !== false) {
      await safeRun(() => typesGenerator(blueprint, genEmit));
    }
  }

  // ── 5. Assemble ────────────────────────────────────────────────────────────
  emitEv("factory_assemble_start", blueprint.moduleId, {
    meta: { fileCount: allResults.filter((r) => r.success).length },
  });

  const bundle = assembleModule(blueprint, allResults, tree, t0);

  emitEv("factory_assemble_done", blueprint.moduleId, {
    meta: {
      successFiles:  bundle.successFiles,
      failedFiles:   bundle.failedFiles,
      warnings:      bundle.warnings,
      readyToCommit: bundle.readyToCommit,
      summary:       bundleSummary(bundle),
    },
  });

  emitEv("factory_done", blueprint.moduleId, {
    meta: {
      summary:       bundleSummary(bundle),
      durationMs:    Date.now() - t0,
      files:         bundle.files.map((f) => ({
        path:      f.path,
        category:  f.category,
        lineCount: f.lineCount,
        agentRole: f.agentRole,
      })),
    },
  });

  return {
    success:   bundle.successFiles > 0,
    bundle,
    durationMs: Date.now() - t0,
  };
}
