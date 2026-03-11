// lib/javari/appFactory.ts
// Purpose: Javari Ecosystem App Factory — detects platform gaps and generates
//          build_app tasks that produce complete Next.js services.
//
// Sources read:
//   - app_registry (what apps already exist or are queued)
//   - module_registry (which capabilities are built → enables which apps)
//   - roadmap_tasks (avoid duplicating in-progress build_app tasks)
//   - canonical_docs (platform context for AI-generated descriptions)
//
// App categories and required capability prerequisites:
//   Realtor Platform     → payments, auth, storage, search
//   Investor Platform    → payments, auth, analytics
//   Creator Studio       → auth, storage, content, marketplace
//   Collector Tools      → auth, payments, storage, marketplace
//   Business Builder     → auth, payments, analytics, automation
//   Learning Platform    → auth, content, notifications
//   Social Community     → auth, messaging, notifications
//   Event Manager        → auth, payments, notifications, analytics
//
// Date: 2026-03-11

import { createClient } from "@supabase/supabase-js";
import { JavariRouter }  from "@/lib/javari/router";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppDefinition {
  id              : string;
  name            : string;
  category        : string;
  description     : string;
  requiredCapabilities: string[];
  priority        : "critical" | "high" | "medium" | "low";
  techStack       : string[];
  targetUsers     : string;
}

export interface AppFactoryResult {
  gapsFound       : number;
  appsRegistered  : number;
  tasksGenerated  : number;
  errors          : string[];
}

// ── All apps the CR AudioViz AI platform should have ─────────────────────────

const PLATFORM_APPS: AppDefinition[] = [
  {
    id: "realtor-platform",
    name: "Realtor Platform",
    category: "real-estate",
    description: "AI-powered real estate platform with property listings, virtual tours, market analytics, and agent tools.",
    requiredCapabilities: ["payments", "auth", "storage", "search"],
    priority: "high",
    techStack: ["Next.js 14", "Supabase", "Stripe", "Mapbox", "OpenAI"],
    targetUsers: "Real estate agents, buyers, sellers",
  },
  {
    id: "investor-platform",
    name: "Investor Platform",
    category: "finance",
    description: "Investment portfolio management with AI analysis, deal flow tracking, cap table management, and ROI projections.",
    requiredCapabilities: ["payments", "auth", "analytics"],
    priority: "high",
    techStack: ["Next.js 14", "Supabase", "Stripe", "Recharts", "OpenAI"],
    targetUsers: "Investors, fund managers, startups seeking capital",
  },
  {
    id: "creator-studio",
    name: "Creator Studio",
    category: "creative",
    description: "Full-stack creator platform with audio/video production tools, AI generation, asset management, and monetization.",
    requiredCapabilities: ["auth", "storage", "content", "marketplace"],
    priority: "critical",
    techStack: ["Next.js 14", "Supabase", "Cloudflare R2", "Stripe", "FFmpeg"],
    targetUsers: "Content creators, musicians, video producers, designers",
  },
  {
    id: "collector-tools",
    name: "Collector Tools",
    category: "marketplace",
    description: "Collectibles marketplace with authentication, provenance tracking, valuation AI, and secure peer-to-peer trading.",
    requiredCapabilities: ["auth", "payments", "storage", "marketplace"],
    priority: "medium",
    techStack: ["Next.js 14", "Supabase", "Stripe", "OpenAI", "IPFS"],
    targetUsers: "Collectors, dealers, auction houses",
  },
  {
    id: "business-builder",
    name: "Business Builder",
    category: "business",
    description: "AI business creation suite with entity formation, branding, website generation, marketing automation, and CRM.",
    requiredCapabilities: ["auth", "payments", "analytics", "automation"],
    priority: "critical",
    techStack: ["Next.js 14", "Supabase", "Stripe", "OpenAI", "SendGrid"],
    targetUsers: "Entrepreneurs, small business owners, startups",
  },
  {
    id: "learning-platform",
    name: "Learning Platform",
    category: "education",
    description: "Adaptive learning platform with AI tutors, certification programs, progress tracking, and community cohorts.",
    requiredCapabilities: ["auth", "content", "notifications"],
    priority: "high",
    techStack: ["Next.js 14", "Supabase", "Stripe", "OpenAI", "WebRTC"],
    targetUsers: "Students, professionals, trainers, certification seekers",
  },
  {
    id: "social-community",
    name: "Social Community Hub",
    category: "social",
    description: "Avatar-based social platform with community spaces, events, groups, live streaming, and AI-moderated discussions.",
    requiredCapabilities: ["auth", "messaging", "notifications"],
    priority: "medium",
    techStack: ["Next.js 14", "Supabase", "WebRTC", "Socket.io", "OpenAI"],
    targetUsers: "Communities, veterans, first responders, faith organizations",
  },
  {
    id: "event-manager",
    name: "Event Manager",
    category: "events",
    description: "End-to-end event management with ticketing, virtual/hybrid events, sponsorship, and post-event analytics.",
    requiredCapabilities: ["auth", "payments", "notifications", "analytics"],
    priority: "medium",
    techStack: ["Next.js 14", "Supabase", "Stripe", "Twilio", "Zoom SDK"],
    targetUsers: "Event organizers, venues, attendees, sponsors",
  },
];

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Get built capabilities from module_registry ───────────────────────────────

async function getBuiltCapabilities(): Promise<Set<string>> {
  try {
    const { data } = await db()
      .from("module_registry")
      .select("capability, status")
      .in("status", ["complete", "in_progress"]);
    return new Set((data ?? []).map((r: { capability: string }) => r.capability));
  } catch {
    // If module_registry doesn't exist yet, treat all capabilities as available
    // so app factory can still generate tasks (modules will be built alongside)
    return new Set(PLATFORM_APPS.flatMap(a => a.requiredCapabilities));
  }
}

// ── Get existing app registry entries ────────────────────────────────────────

async function getExistingApps(): Promise<Set<string>> {
  try {
    const { data } = await db()
      .from("app_registry")
      .select("id");
    return new Set((data ?? []).map((r: { id: string }) => r.id));
  } catch {
    return new Set();
  }
}

// ── Get in-progress build_app tasks ──────────────────────────────────────────

async function getQueuedAppTasks(): Promise<Set<string>> {
  try {
    const { data } = await db()
      .from("roadmap_tasks")
      .select("metadata")
      .eq("type", "build_app")
      .in("status", ["pending", "in_progress", "verifying"]);
    const ids = new Set<string>();
    for (const row of data ?? []) {
      if (row.metadata?.app_id) ids.add(row.metadata.app_id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

// ── Generate AI task description ──────────────────────────────────────────────

async function generateTaskDescription(app: AppDefinition): Promise<string> {
  try {
    const result = await JavariRouter.simple_task(`
Generate a detailed technical task description for building the following platform app.

App Name: ${app.name}
Category: ${app.category}
Description: ${app.description}
Tech Stack: ${app.techStack.join(", ")}
Target Users: ${app.targetUsers}

Write a 3-4 sentence technical specification describing:
1. Core features and user flows to implement
2. Key technical components (API routes, UI, DB schema)
3. Integration requirements
Be specific and actionable. No marketing language.
    `.trim());
    return result.output ?? app.description;
  } catch {
    return app.description;
  }
}

// ── Register app in app_registry ──────────────────────────────────────────────

async function registerApp(
  app   : AppDefinition,
  taskId: string,
): Promise<void> {
  try {
    await db().from("app_registry").upsert({
      id         : app.id,
      name       : app.name,
      category   : app.category,
      status     : "planned",
      task_id    : taskId,
      description: app.description,
      metadata   : {
        tech_stack          : app.techStack,
        target_users        : app.targetUsers,
        required_capabilities: app.requiredCapabilities,
        priority            : app.priority,
      },
      created_at : new Date().toISOString(),
      updated_at : new Date().toISOString(),
    });
  } catch {
    // Non-fatal — table may not exist yet
  }
}

// ── Insert roadmap task ───────────────────────────────────────────────────────

async function insertAppTask(
  app        : AppDefinition,
  description: string,
): Promise<string | null> {
  const taskId = `app-${app.id}-${Date.now()}`;
  try {
    const { error } = await db().from("roadmap_tasks").insert({
      id         : taskId,
      title      : `Build ${app.name}`,
      description,
      status     : "pending",
      source     : "app_factory",
      metadata   : {
        type                : "build_app",
        app_id              : app.id,
        app_name            : app.name,
        category            : app.category,
        priority            : app.priority,
        tech_stack          : app.techStack,
        target_users        : app.targetUsers,
        required_capabilities: app.requiredCapabilities,
        source              : "app_factory",
      },
      created_at : new Date().toISOString(),
    });
    if (error) {
      console.error(`[appFactory] Insert task error: ${error.message}`);
      return null;
    }
    return taskId;
  } catch (err) {
    console.error(`[appFactory] Insert task threw: ${err}`);
    return null;
  }
}

// ── Main factory function ─────────────────────────────────────────────────────

export async function runAppFactory(options?: {
  maxAppsToQueue?     : number;
  dryRun?             : boolean;
  forcedCategories?   : string[];
}): Promise<AppFactoryResult> {
  const maxApps  = options?.maxAppsToQueue ?? 3;
  const dryRun   = options?.dryRun ?? false;
  const errors   : string[] = [];

  let gapsFound      = 0;
  let appsRegistered = 0;
  let tasksGenerated = 0;

  console.log(`[appFactory] Starting — maxApps=${maxApps} dryRun=${dryRun}`);

  // Read state in parallel
  const [builtCapabilities, existingApps, queuedTasks] = await Promise.all([
    getBuiltCapabilities(),
    getExistingApps(),
    getQueuedAppTasks(),
  ]);

  // Find apps not yet registered or queued
  const gaps: AppDefinition[] = [];
  for (const app of PLATFORM_APPS) {
    const alreadyExists = existingApps.has(app.id);
    const alreadyQueued = queuedTasks.has(app.id);

    if (alreadyExists || alreadyQueued) continue;

    // Filter by forced categories if specified
    if (options?.forcedCategories && !options.forcedCategories.includes(app.category)) continue;

    gaps.push(app);
  }

  // Sort: critical first, then high, then medium, then low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  gapsFound = gaps.length;
  console.log(`[appFactory] ${gapsFound} app gaps found, processing up to ${maxApps}`);

  if (dryRun) {
    return {
      gapsFound, appsRegistered: 0, tasksGenerated: 0,
      errors: [`dryRun=true — ${gapsFound} apps would be queued`],
    };
  }

  // Queue top N apps
  for (const app of gaps.slice(0, maxApps)) {
    try {
      const description = await generateTaskDescription(app);
      const taskId      = await insertAppTask(app, description);

      if (!taskId) {
        errors.push(`Failed to insert task for ${app.name}`);
        continue;
      }

      tasksGenerated++;
      await registerApp(app, taskId);
      appsRegistered++;

      console.log(`[appFactory] ✅ Queued: ${app.name} (${app.priority}) → ${taskId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${app.name}: ${msg}`);
      console.error(`[appFactory] Error on ${app.name}: ${msg}`);
    }
  }

  console.log(`[appFactory] Done: ${tasksGenerated} tasks generated, ${appsRegistered} registered`);
  return { gapsFound, appsRegistered, tasksGenerated, errors };
}

// ── App metrics ───────────────────────────────────────────────────────────────

export async function getAppMetrics(): Promise<{
  apps_total    : number;
  apps_complete : number;
  apps_building : number;
  apps_planned  : number;
  apps_missing  : number;
  by_category   : Record<string, number>;
}> {
  try {
    const { data } = await db().from("app_registry").select("category, status");
    const rows     = data ?? [];
    const by_category: Record<string, number> = {};

    let apps_complete = 0;
    let apps_building = 0;
    let apps_planned  = 0;

    for (const r of rows as { category: string; status: string }[]) {
      by_category[r.category] = (by_category[r.category] ?? 0) + 1;
      if (r.status === "complete")    apps_complete++;
      else if (r.status === "in_progress") apps_building++;
      else                             apps_planned++;
    }

    return {
      apps_total   : rows.length,
      apps_complete,
      apps_building,
      apps_planned,
      apps_missing : PLATFORM_APPS.length - rows.length,
      by_category,
    };
  } catch {
    return {
      apps_total: 0, apps_complete: 0, apps_building: 0,
      apps_planned: 0, apps_missing: PLATFORM_APPS.length, by_category: {},
    };
  }
}
