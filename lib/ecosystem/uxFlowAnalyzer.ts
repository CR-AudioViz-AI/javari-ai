// lib/ecosystem/uxFlowAnalyzer.ts
// Purpose: UX / Product flow analyzer — simulates real user journeys through
//          the platform, detecting broken navigation, dead routes, missing
//          onboarding steps, and inconsistent UX flows.
// Date: 2026-03-07

import { createClient }   from "@supabase/supabase-js";
import { recordArtifact } from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export type FlowName =
  | "signup" | "login" | "dashboard" | "create_project"
  | "run_ai_task" | "view_results" | "billing_upgrade"
  | "onboarding" | "settings" | "creator_marketplace";

export interface FlowStep {
  step       : number;
  action     : string;
  expectedUrl: string;
  method     : "GET" | "POST";
  statusCode?: number;
  responseMs?: number;
  passed     : boolean;
  issue?     : string;
}

export interface FlowResult {
  flow      : FlowName;
  baseUrl   : string;
  steps     : FlowStep[];
  passed    : boolean;
  issueCount: number;
  issues    : string[];
}

export interface UxAnalysisResult {
  flows          : FlowResult[];
  brokenFlows    : FlowResult[];
  passedFlows    : FlowResult[];
  totalIssues    : number;
  recommendations: UxRecommendation[];
  tasksCreated   : number;
  taskIds        : string[];
}

export interface UxRecommendation {
  priority   : "critical" | "high" | "medium" | "low";
  flow       : FlowName;
  title      : string;
  detail     : string;
  remediation: string;
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Flow definitions ───────────────────────────────────────────────────────

interface FlowDefinition {
  name : FlowName;
  steps: Array<{
    action     : string;
    path       : string;
    method     : "GET" | "POST";
    expectCode?: number[];   // acceptable status codes
  }>;
}

const FLOW_DEFINITIONS: FlowDefinition[] = [
  {
    name: "signup",
    steps: [
      { action: "Visit homepage",       path: "/",           method: "GET", expectCode: [200] },
      { action: "Navigate to signup",   path: "/signup",     method: "GET", expectCode: [200, 301, 302] },
      { action: "Submit registration",  path: "/api/auth/signup", method: "POST", expectCode: [200, 201, 422] },
    ],
  },
  {
    name: "login",
    steps: [
      { action: "Visit homepage",     path: "/",        method: "GET", expectCode: [200] },
      { action: "Navigate to login",  path: "/login",   method: "GET", expectCode: [200, 301, 302] },
      { action: "API auth endpoint",  path: "/api/auth/signin", method: "GET", expectCode: [200, 302, 404] },
    ],
  },
  {
    name: "dashboard",
    steps: [
      { action: "Visit dashboard",      path: "/dashboard",      method: "GET", expectCode: [200, 302, 401] },
      { action: "Visit admin",          path: "/admin",          method: "GET", expectCode: [200, 302, 401, 403, 404] },
      { action: "Visit admin/javari",   path: "/admin/javari",   method: "GET", expectCode: [200, 302, 401, 403, 404] },
    ],
  },
  {
    name: "run_ai_task",
    steps: [
      { action: "Visit Javari chat",   path: "/javari",        method: "GET", expectCode: [200, 302] },
      { action: "API chat endpoint",   path: "/api/javari/chat", method: "GET", expectCode: [200, 405] },
      { action: "API execute endpoint", path: "/api/javari/execute", method: "GET", expectCode: [200, 405] },
    ],
  },
  {
    name: "billing_upgrade",
    steps: [
      { action: "Visit pricing page",  path: "/pricing",        method: "GET", expectCode: [200, 302] },
      { action: "Visit billing",       path: "/billing",        method: "GET", expectCode: [200, 302, 401, 404] },
      { action: "Visit subscribe",     path: "/subscribe",      method: "GET", expectCode: [200, 302, 401, 404] },
    ],
  },
  {
    name: "onboarding",
    steps: [
      { action: "Visit onboarding",    path: "/onboarding",     method: "GET", expectCode: [200, 302, 404] },
      { action: "Visit getting-started", path: "/getting-started", method: "GET", expectCode: [200, 302, 404] },
      { action: "Visit docs",          path: "/docs",           method: "GET", expectCode: [200, 302, 404] },
    ],
  },
  {
    name: "creator_marketplace",
    steps: [
      { action: "Visit marketplace",   path: "/marketplace",    method: "GET", expectCode: [200, 302, 404] },
      { action: "Visit apps gallery",  path: "/apps",           method: "GET", expectCode: [200, 302, 404] },
      { action: "Visit games",         path: "/games",          method: "GET", expectCode: [200, 302, 404] },
    ],
  },
];

// ── Flow runner ────────────────────────────────────────────────────────────

async function runFlow(
  flow   : FlowDefinition,
  baseUrl: string,
  ua     : string = "JavariBot/1.0 (ux-audit)"
): Promise<FlowResult> {
  const steps: FlowStep[] = [];
  const issues: string[] = [];

  for (let i = 0; i < flow.steps.length; i++) {
    const def       = flow.steps[i];
    const url       = baseUrl + def.path;
    const expected  = def.expectCode ?? [200];
    const t0        = Date.now();

    let statusCode  = 0;
    let responseMs  = 0;
    let passed      = false;
    let issue: string | undefined;

    try {
      const res = await fetch(url, {
        method  : def.method,
        redirect: "manual",   // don't follow — track redirects
        headers : { "User-Agent": ua, "Content-Type": "application/json" },
        signal  : AbortSignal.timeout(8_000),
      });
      statusCode = res.status;
      responseMs = Date.now() - t0;
      passed     = expected.includes(statusCode);

      if (!passed) {
        issue = `Expected ${expected.join(" or ")} but got HTTP ${statusCode}`;
        issues.push(`${def.action} [${def.path}]: ${issue}`);
      } else if (responseMs > 3000) {
        issue = `Slow response: ${responseMs}ms`;
        issues.push(`${def.action} [${def.path}]: slow (${responseMs}ms)`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      issue      = `Request failed: ${msg.slice(0, 80)}`;
      issues.push(`${def.action} [${def.path}]: ${issue}`);
      responseMs = Date.now() - t0;
    }

    steps.push({
      step      : i + 1,
      action    : def.action,
      expectedUrl: url,
      method    : def.method,
      statusCode,
      responseMs,
      passed,
      issue,
    });
  }

  const allPassed = steps.every(s => s.passed);
  return { flow: flow.name, baseUrl, steps, passed: allPassed, issueCount: issues.length, issues };
}

// ── Recommendation generator ───────────────────────────────────────────────

function generateRecommendations(flows: FlowResult[]): UxRecommendation[] {
  const recs: UxRecommendation[] = [];

  for (const flow of flows) {
    for (const step of flow.steps) {
      if (step.passed) continue;

      const priority: UxRecommendation["priority"] =
        flow.flow === "signup" || flow.flow === "login" ? "critical"
        : flow.flow === "run_ai_task" || flow.flow === "billing_upgrade" ? "high"
        : "medium";

      const is404 = step.statusCode === 404;
      const is500 = step.statusCode && step.statusCode >= 500;

      recs.push({
        priority,
        flow   : flow.flow,
        title  : is404 ? `Missing route: ${step.expectedUrl}`
          : is500 ? `Server error on ${step.action}`
          : step.issue?.includes("slow") ? `Performance issue: ${step.action}`
          : `Unexpected response on ${step.action}`,
        detail : step.issue ?? `HTTP ${step.statusCode} at ${step.expectedUrl}`,
        remediation: is404
          ? `Create or fix route at ${step.expectedUrl.replace(flow.baseUrl,"")}. Verify Next.js page/app router file exists.`
          : is500
          ? `Fix server error at ${step.expectedUrl}. Check Vercel function logs.`
          : step.issue?.includes("slow")
          ? `Optimize server response for ${step.expectedUrl}. Target <1s.`
          : `Review expected status codes for ${step.expectedUrl}.`,
      });
    }
  }

  return recs
    .sort((a, b) => {
      const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return o[a.priority] - o[b.priority];
    })
    .slice(0, 20);
}

// ── Task seeder ────────────────────────────────────────────────────────────

async function seedUxTasks(
  recs   : UxRecommendation[],
  baseUrl: string
): Promise<{ count: number; ids: string[] }> {
  const actionable = recs.filter(r => r.priority === "critical" || r.priority === "high").slice(0, 8);
  if (actionable.length === 0) return { count: 0, ids: [] };

  const ts   = Date.now();
  const rows = actionable.map((r, i) => {
    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 35);
    const id   = `ux-${r.flow}-${slug}-${ts + i}`.slice(0, 80);
    return {
      id,
      phase_id   : r.priority === "critical" ? "foundation" : "ux",
      title      : `[UX][${r.priority.toUpperCase()}] ${r.title.slice(0, 80)}`,
      description: `[type:ai_task] executor:repair_code\n` +
        `UX flow: ${r.flow}\nTarget: ${baseUrl}\n` +
        `Issue: ${r.detail}\nRemediation: ${r.remediation}\n\n` +
        `\`\`\`json\n${JSON.stringify([{
          severity: r.priority,
          type: "ux_flow",
          file: baseUrl,
          description: r.detail,
          suggested_fix: r.remediation,
          rule: `UX_FLOW_${r.flow.toUpperCase()}`,
        }], null, 2)}\n\`\`\``,
      depends_on : [],
      status     : "pending",
      source     : "ux_analyzer",
      updated_at : ts + i,
    };
  });

  const { data: existing } = await db()
    .from("roadmap_tasks").select("id").in("id", rows.map(r => r.id));
  const existingSet = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const toInsert = rows.filter(r => !existingSet.has(r.id));
  if (toInsert.length === 0) return { count: 0, ids: [] };

  const { error } = await db().from("roadmap_tasks").insert(toInsert);
  if (error) return { count: 0, ids: [] };
  return { count: toInsert.length, ids: toInsert.map(r => r.id) };
}

// ── Main function ──────────────────────────────────────────────────────────

export async function runUxFlowAnalyzer(
  targetUrls: string[],
  taskId?   : string,
  seedTasks : boolean = true
): Promise<UxAnalysisResult> {
  const allFlows: FlowResult[] = [];

  for (const baseUrl of targetUrls) {
    const url = baseUrl.replace(/\/$/, "");
    // Run flows concurrently per target
    const results = await Promise.allSettled(
      FLOW_DEFINITIONS.map(def => runFlow(def, url))
    );
    results.forEach(r => {
      if (r.status === "fulfilled") allFlows.push(r.value);
    });
  }

  const brokenFlows = allFlows.filter(f => !f.passed);
  const passedFlows = allFlows.filter(f => f.passed);
  const recs        = generateRecommendations(allFlows);
  const totalIssues = allFlows.reduce((s, f) => s + f.issueCount, 0);

  let tasksCreated = 0;
  let taskIds: string[] = [];

  if (seedTasks && recs.length > 0) {
    for (const url of targetUrls) {
      const result = await seedUxTasks(recs, url);
      tasksCreated += result.count;
      taskIds.push(...result.ids);
    }
  }

  if (taskId && allFlows.length > 0) {
    await recordArtifact({
      task_id         : taskId,
      artifact_type   : "ux_analysis" as never,
      artifact_location: "supabase/roadmap_task_artifacts",
      artifact_data   : { flows: allFlows, recommendations: recs, totalIssues },
    });
  }

  return { flows: allFlows, brokenFlows, passedFlows, totalIssues, recommendations: recs, tasksCreated, taskIds };
}
