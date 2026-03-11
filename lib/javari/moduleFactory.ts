// lib/javari/moduleFactory.ts
// Purpose: Autonomous Module Factory — reads the platform state, detects capability gaps,
//          and generates roadmap tasks to fill those gaps automatically.
//
// Capability categories:
//   auth, payments, notifications, analytics, ai_services, storage,
//   automation, search, messaging, content, marketplace
//
// Flow:
//   1. Read canonical_docs + knowledge_graph_nodes for platform context
//   2. Read module_registry to know what already exists
//   3. Read roadmap_tasks to know what is already planned
//   4. Classify which capabilities are missing or incomplete
//   5. Generate build_module tasks for gaps and insert into roadmap_tasks
//   6. Register modules in module_registry
//
// Trigger: called by autonomousPlanner when pending tasks < PLANNER_TRIGGER_THRESHOLD
//
// Date: 2026-03-11

import { createClient } from "@supabase/supabase-js";
import { JavariRouter }  from "@/lib/javari/router";

// ── Types ─────────────────────────────────────────────────────────────────────

export const CAPABILITY_CATEGORIES = [
  "auth",
  "payments",
  "notifications",
  "analytics",
  "ai_services",
  "storage",
  "automation",
  "search",
  "messaging",
  "content",
  "marketplace",
] as const;

export type CapabilityCategory = typeof CAPABILITY_CATEGORIES[number];

export type ModuleStatus = "planned" | "in_progress" | "complete" | "failed";

export interface ModuleRegistryEntry {
  id          : string;
  module_name : string;
  capability  : CapabilityCategory;
  status      : ModuleStatus;
  version     : string;
  created_at  : string;
  updated_at? : string;
}

export interface CapabilityGap {
  capability  : CapabilityCategory;
  module_name : string;
  reason      : string;
  priority    : "critical" | "high" | "medium" | "low";
}

export interface ModuleTask {
  id          : string;
  title       : string;
  description : string;
  type        : "build_module";
  phase_id    : string;
  source      : "module_factory";
  status      : "pending";
  metadata    : {
    module      : string;
    capability  : CapabilityCategory;
    dependencies: string[];
    factory_run : string;
  };
}

export interface FactoryResult {
  ok             : boolean;
  gapsFound      : number;
  tasksGenerated : number;
  modulesRegistered: number;
  gaps           : CapabilityGap[];
  errors         : string[];
  durationMs     : number;
}

// ── Capability → required modules mapping ────────────────────────────────────
// Defines the minimum module set the platform needs for each capability.
// If a module is absent from module_registry AND has no pending task, it's a gap.

const REQUIRED_MODULES: Record<CapabilityCategory, string[]> = {
  auth: [
    "user_authentication",
    "oauth_provider",
    "session_management",
    "role_based_access_control",
    "api_key_management",
  ],
  payments: [
    "stripe_integration",
    "paypal_integration",
    "subscription_billing",
    "credit_system",
    "payment_analytics",
  ],
  notifications: [
    "email_notifications",
    "push_notifications",
    "in_app_notifications",
    "notification_preferences",
    "webhook_dispatcher",
  ],
  analytics: [
    "user_analytics",
    "revenue_analytics",
    "ai_cost_analytics",
    "performance_monitoring",
    "audit_logging",
  ],
  ai_services: [
    "ai_router",
    "chat_controller",
    "model_registry",
    "ai_cost_optimizer",
    "autonomous_planner",
    "module_factory",
  ],
  storage: [
    "r2_file_storage",
    "supabase_storage",
    "media_processor",
    "cdn_manager",
    "backup_scheduler",
  ],
  automation: [
    "cron_scheduler",
    "worker_cycle_engine",
    "artifact_executor",
    "github_automation",
    "vercel_deploy_automation",
  ],
  search: [
    "vector_search",
    "full_text_search",
    "semantic_search",
    "knowledge_graph_query",
    "canonical_doc_search",
  ],
  messaging: [
    "real_time_chat",
    "message_queue",
    "event_bus",
    "webhook_receiver",
    "inter_service_messaging",
  ],
  content: [
    "content_generator",
    "media_transcoder",
    "template_engine",
    "asset_manager",
    "brand_kit_manager",
  ],
  marketplace: [
    "agent_marketplace",
    "creator_marketplace",
    "product_catalog",
    "review_system",
    "commission_engine",
  ],
};

// Priority rules — some capabilities block others
const CAPABILITY_PRIORITY: Record<CapabilityCategory, "critical" | "high" | "medium" | "low"> = {
  auth          : "critical",
  payments      : "critical",
  ai_services   : "critical",
  automation    : "high",
  storage       : "high",
  notifications : "high",
  analytics     : "medium",
  search        : "medium",
  messaging     : "medium",
  content       : "low",
  marketplace   : "low",
};

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Gap detection ─────────────────────────────────────────────────────────────

async function detectGaps(): Promise<CapabilityGap[]> {
  const client = db();

  // Load what's already registered
  const { data: registryRows } = await client
    .from("module_registry")
    .select("module_name, capability, status");

  const existingModules = new Set<string>(
    (registryRows ?? []).map((r: { module_name: string }) => r.module_name)
  );

  const completedModules = new Set<string>(
    (registryRows ?? [])
      .filter((r: { status: string }) => r.status === "complete" || r.status === "in_progress")
      .map((r: { module_name: string }) => r.module_name)
  );

  // Load pending roadmap tasks to avoid re-planning already-queued work
  const { data: pendingTasks } = await client
    .from("roadmap_tasks")
    .select("title, metadata")
    .in("status", ["pending", "in_progress", "verifying"])
    .limit(500);

  const plannedModules = new Set<string>();
  for (const task of pendingTasks ?? []) {
    const meta = task.metadata as { module?: string } | null;
    if (meta?.module) plannedModules.add(meta.module);
    // Also check title for module name
    const titleSlug = task.title?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ?? "";
    plannedModules.add(titleSlug);
  }

  const gaps: CapabilityGap[] = [];

  for (const [capability, modules] of Object.entries(REQUIRED_MODULES)) {
    const cap = capability as CapabilityCategory;
    for (const module_name of modules) {
      const isRegistered = existingModules.has(module_name);
      const isComplete   = completedModules.has(module_name);
      const isPlanned    = plannedModules.has(module_name);

      if (!isComplete && !isPlanned) {
        gaps.push({
          capability: cap,
          module_name,
          reason    : isRegistered ? "registered but incomplete" : "not yet built",
          priority  : CAPABILITY_PRIORITY[cap],
        });
      }
    }
  }

  // Sort by priority: critical → high → medium → low
  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return gaps;
}

// ── Task generation via AI ─────────────────────────────────────────────────────

async function generateModuleTaskDescription(
  module_name: string,
  capability : CapabilityCategory
): Promise<string> {
  const result = await JavariRouter.generate({
    taskType : "simple_task",
    prompt   : `Generate a concise 2-sentence technical task description for building the "${module_name}" module for the ${capability} capability of the CR AudioViz AI platform.
Platform: Next.js 14, TypeScript strict mode, Supabase PostgreSQL, shadcn/ui.
Return only the 2-sentence description. No preamble.`,
    maxTokens: 200,
  });

  if (result.ok && result.content.trim()) return result.content.trim();

  // Fallback: deterministic description
  return `Build the ${module_name} module to provide ${capability} capability for the CR AudioViz AI platform. ` +
    `Implement using Next.js 14, TypeScript strict mode, and Supabase with complete error handling and OWASP compliance.`;
}

// ── Module registration ───────────────────────────────────────────────────────

async function registerModule(
  module_name : string,
  capability  : CapabilityCategory,
  status      : ModuleStatus = "planned"
): Promise<void> {
  const client = db();
  await client.from("module_registry").upsert({
    module_name,
    capability,
    status,
    version   : "0.1.0",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "module_name" });
}

// ── Main factory function ─────────────────────────────────────────────────────

export async function runModuleFactory(options?: {
  maxGapsToFill? : number;
  dryRun?        : boolean;
  capabilities?  : CapabilityCategory[];
}): Promise<FactoryResult> {
  const t0      = Date.now();
  const errors  : string[] = [];
  const {
    maxGapsToFill = 10,
    dryRun        = false,
    capabilities,
  } = options ?? {};

  let gapsFound       = 0;
  let tasksGenerated  = 0;
  let modulesRegistered = 0;
  const processedGaps: CapabilityGap[] = [];

  try {
    // Detect capability gaps
    let gaps = await detectGaps();

    // Filter to requested capabilities if specified
    if (capabilities && capabilities.length > 0) {
      gaps = gaps.filter(g => capabilities.includes(g.capability));
    }

    gapsFound = gaps.length;
    console.log(`[module-factory] Found ${gapsFound} capability gaps`);

    if (dryRun) {
      return { ok: true, gapsFound, tasksGenerated: 0, modulesRegistered: 0, gaps, errors, durationMs: Date.now() - t0 };
    }

    // Fill up to maxGapsToFill gaps
    const client    = db();
    const factoryRun = `mf-${Date.now()}`;
    const toFill    = gaps.slice(0, maxGapsToFill);

    for (const gap of toFill) {
      try {
        // Check if we already have this exact task title to prevent duplicates
        const taskTitle = `Build ${gap.module_name.replace(/_/g, " ")} module`;
        const { data: existing } = await client
          .from("roadmap_tasks")
          .select("id")
          .ilike("title", `%${gap.module_name.replace(/_/g, " ")}%`)
          .not("status", "in", '("completed","blocked","failed")')
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[module-factory] Skipping ${gap.module_name} — task already exists`);
          continue;
        }

        // Generate AI description (with cost-efficient simple_task routing)
        const description = await generateModuleTaskDescription(gap.module_name, gap.capability);

        const taskId = `mf-${gap.capability.slice(0, 8)}-${gap.module_name.slice(0, 20).replace(/_/g, "-")}-${Date.now().toString(36)}`;

        const task: Omit<ModuleTask, "id"> & { id: string } = {
          id         : taskId,
          title      : taskTitle,
          description,
          type       : "build_module",
          phase_id   : gap.capability,
          source     : "module_factory",
          status     : "pending",
          metadata   : {
            module      : gap.module_name,
            capability  : gap.capability,
            dependencies: [],
            factory_run: factoryRun,
          },
        };

        const { error: insertError } = await client.from("roadmap_tasks").insert(task);

        if (insertError) {
          console.warn(`[module-factory] Insert failed for ${gap.module_name}: ${insertError.message}`);
          errors.push(`${gap.module_name}: ${insertError.message}`);
          continue;
        }

        // Register the module as planned
        await registerModule(gap.module_name, gap.capability, "planned");

        tasksGenerated++;
        modulesRegistered++;
        processedGaps.push(gap);

        console.log(`[module-factory] ✅ Generated task for ${gap.module_name} (${gap.capability}/${gap.priority})`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${gap.module_name}: ${msg}`);
        console.warn(`[module-factory] ⚠️ Failed ${gap.module_name}: ${msg}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`factory_run: ${msg}`);
    console.error(`[module-factory] ❌ Fatal: ${msg}`);
    return { ok: false, gapsFound, tasksGenerated, modulesRegistered, gaps: processedGaps, errors, durationMs: Date.now() - t0 };
  }

  const durationMs = Date.now() - t0;
  console.log(`[module-factory] Done — ${tasksGenerated} tasks in ${durationMs}ms`);

  return { ok: true, gapsFound, tasksGenerated, modulesRegistered, gaps: processedGaps, errors, durationMs };
}

// ── Module metrics for dashboard ──────────────────────────────────────────────

export async function getModuleMetrics(): Promise<{
  modules_total    : number;
  modules_complete : number;
  modules_in_progress: number;
  modules_planned  : number;
  modules_missing  : number;
  by_capability    : Record<string, { total: number; complete: number; missing: number }>;
}> {
  const client = db();

  const { data: rows } = await client
    .from("module_registry")
    .select("module_name, capability, status");

  const registeredByCapability: Record<string, { complete: number; total: number }> = {};
  let modules_total       = 0;
  let modules_complete    = 0;
  let modules_in_progress = 0;
  let modules_planned     = 0;

  for (const row of rows ?? []) {
    const r = row as { module_name: string; capability: string; status: string };
    modules_total++;
    if (!registeredByCapability[r.capability]) {
      registeredByCapability[r.capability] = { complete: 0, total: 0 };
    }
    registeredByCapability[r.capability].total++;
    if (r.status === "complete")     { modules_complete++;    registeredByCapability[r.capability].complete++; }
    if (r.status === "in_progress")  modules_in_progress++;
    if (r.status === "planned")      modules_planned++;
  }

  // Count required modules not yet registered
  let modules_missing = 0;
  const by_capability: Record<string, { total: number; complete: number; missing: number }> = {};

  for (const [cap, required] of Object.entries(REQUIRED_MODULES)) {
    const reg    = registeredByCapability[cap] ?? { complete: 0, total: 0 };
    const missing = required.length - reg.total;
    modules_missing += Math.max(0, missing);
    by_capability[cap] = {
      total   : required.length,
      complete: reg.complete,
      missing : Math.max(0, missing),
    };
  }

  return {
    modules_total,
    modules_complete,
    modules_in_progress,
    modules_planned,
    modules_missing,
    by_capability,
  };
}
