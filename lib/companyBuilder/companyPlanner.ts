// lib/companyBuilder/companyPlanner.ts
// Purpose: Analyzes an idea, defines product scope, identifies required systems,
//          generates a company name + product vision, and inserts roadmap tasks
//          into roadmap_tasks so the full Javari execution engine can build it.
// Date: 2026-03-08

import { createClient }        from "@supabase/supabase-js";
import { runOrchestrator }     from "@/lib/orchestrator/orchestrator";
import { ingestTechDiscovery } from "@/lib/memory/knowledgeNodeBuilder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompanyInput {
  idea            : string;
  industry        : string;
  target_users?   : string;
  monetization?   : string;
  mode?           : "internal" | "customer" | "saas" | "ai_service";  // default saas
  customer_name?  : string;
}

export interface ArchitectureOutline {
  frontend      : string;
  backend       : string;
  database      : string;
  auth          : string;
  payments      : string;
  ai_layer      : string;
  hosting       : string;
  cdn           : string;
  monitoring    : string;
}

export interface CompanyPlan {
  companyName       : string;
  productVision     : string;
  tagline           : string;
  industry          : string;
  target_users      : string;
  monetization      : string;
  mode              : string;
  architectureOutline: ArchitectureOutline;
  roadmap           : PlanRoadmapTask[];
  requiredSystems   : string[];
  marketOpportunity : string;
  differentiators   : string[];
  mvpFeatures       : string[];
  phase1Features    : string[];
  techStack         : string[];
  estimatedBuildDays: number;
  planId            : string;
  createdAt         : string;
}

export interface PlanRoadmapTask {
  id          : string;
  phase       : "mvp" | "v1" | "v2" | "growth";
  title       : string;
  description : string;
  task_type   : string;
  priority    : number;
  depends_on  : string[];
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Name generator ─────────────────────────────────────────────────────────

function generateCompanyName(idea: string, industry: string): string {
  const words = idea.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length > 3);
  const industryWords: Record<string, string[]> = {
    fintech    : ["Fio", "Vault", "Ledger", "Apex"],
    healthcare : ["Medi", "Vital", "Pulse", "Care"],
    education  : ["Edu", "Learn", "Klass", "Mentor"],
    ecommerce  : ["Shop", "Cart", "Forge", "Bazaar"],
    saas       : ["Layr", "Stack", "Flow", "Forge"],
    ai         : ["Synth", "Neural", "Nexus", "Apex"],
    "developer tools": ["Dev", "Forge", "Stack", "Build"],
    default    : ["Nova", "Arc", "Prism", "Apex"],
  };
  const prefixes = industryWords[industry.toLowerCase()] ?? industryWords.default;
  const prefix = prefixes[Math.abs(idea.length) % prefixes.length];
  const suffix = words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1, 5) : "AI";
  return `${prefix}${suffix}`;
}

// ── Default architecture by industry ──────────────────────────────────────

function defaultArchitecture(industry: string): ArchitectureOutline {
  const isAI = industry.toLowerCase().includes("ai") || industry.toLowerCase().includes("developer");
  return {
    frontend  : "Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui",
    backend   : "Next.js API Routes + tRPC" + (isAI ? " + Javari Orchestrator" : ""),
    database  : "Supabase PostgreSQL + pgvector + Row Level Security",
    auth      : "Supabase Auth + NextAuth.js (Google + GitHub OAuth)",
    payments  : "Stripe (subscriptions + one-time) + PayPal",
    ai_layer  : isAI ? "Javari Orchestration Engine (79 models, 14 providers)" : "OpenAI API + Anthropic Claude",
    hosting   : "Vercel (preview + production) + Cloudflare CDN",
    cdn       : "Cloudflare R2 for assets + Vercel Edge Network",
    monitoring: "Vercel Analytics + Supabase Logs + custom health endpoints",
  };
}

// ── Main planner ───────────────────────────────────────────────────────────

export async function planCompany(input: CompanyInput): Promise<CompanyPlan> {
  const planId   = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const mode     = input.mode ?? "saas";
  const createdAt = new Date().toISOString();

  // Use orchestrator for AI-driven market analysis
  let aiAnalysis = "";
  try {
    const r = await runOrchestrator({
      task_type: "architecture_design",
      priority : "balanced",
      prompt   : `You are a senior product architect. Analyze this business idea and return ONLY a JSON object (no markdown, no explanation):
{
  "companyName": "short brandable name",
  "tagline": "10 word value proposition",
  "productVision": "2 sentence vision",
  "marketOpportunity": "1 sentence TAM/SAM insight",
  "differentiators": ["d1", "d2", "d3"],
  "mvpFeatures": ["f1", "f2", "f3", "f4", "f5"],
  "phase1Features": ["f1", "f2", "f3"],
  "requiredSystems": ["system1", "system2"],
  "techStack": ["tech1", "tech2"],
  "estimatedBuildDays": 30,
  "monetization": "describe monetization"
}

Idea: ${input.idea}
Industry: ${input.industry}
Target users: ${input.target_users ?? "B2B SaaS"}
Monetization: ${input.monetization ?? "subscription"}`,
      max_models: 1,
    });
    aiAnalysis = r.final_answer ?? "";
  } catch { /* fallback to defaults */ }

  // Parse AI response
  let parsed: Record<string, unknown> = {};
  try {
    const clean = aiAnalysis.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start > -1 && end > start) {
      parsed = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    }
  } catch { /* use defaults */ }

  const companyName  = (parsed.companyName as string) || generateCompanyName(input.idea, input.industry);
  const productVision = (parsed.productVision as string) || `${companyName} is a next-generation ${input.industry} platform powered by AI, designed for ${input.target_users ?? "modern teams"}.`;
  const tagline       = (parsed.tagline as string) || `AI-powered ${input.industry} for the modern era`;
  const marketOpp     = (parsed.marketOpportunity as string) || `The global ${input.industry} market is growing rapidly with strong demand for AI-native solutions.`;
  const differentiators = (parsed.differentiators as string[]) || ["AI-native architecture", "Zero-config deployment", "Enterprise-grade security"];
  const mvpFeatures     = (parsed.mvpFeatures as string[]) || ["User auth", "Core dashboard", "API layer", "Payments", "Analytics"];
  const phase1Features  = (parsed.phase1Features as string[]) || ["Team workspaces", "API keys", "Webhook system"];
  const requiredSystems = (parsed.requiredSystems as string[]) || ["auth", "payments", "api", "database", "dashboard"];
  const techStack       = (parsed.techStack as string[]) || ["Next.js", "TypeScript", "Supabase", "Stripe", "Vercel"];
  const buildDays       = (parsed.estimatedBuildDays as number) || 45;
  const monetization    = (parsed.monetization as string) || input.monetization || "subscription tiers";
  const arch            = defaultArchitecture(input.industry);

  // Generate phased roadmap tasks
  const roadmap: PlanRoadmapTask[] = buildRoadmapTasks(planId, companyName, mvpFeatures, phase1Features, arch);

  // Ingest tech stack into memory graph
  for (const tech of techStack) {
    try {
      await ingestTechDiscovery({ technology: tech, domain: "backend", context: `Used in ${companyName} build`, source: "company_builder" });
    } catch { /* non-fatal */ }
  }

  return {
    companyName, productVision, tagline, industry: input.industry,
    target_users: input.target_users ?? "B2B SaaS teams",
    monetization, mode, architectureOutline: arch, roadmap,
    requiredSystems, marketOpportunity: marketOpp, differentiators,
    mvpFeatures, phase1Features, techStack,
    estimatedBuildDays: buildDays, planId, createdAt,
  };
}

// ── Insert roadmap tasks into Supabase ────────────────────────────────────

export async function insertPlanRoadmapTasks(
  plan   : CompanyPlan,
  roadmapId: string = "company-builder"
): Promise<{ inserted: number; errors: number }> {
  const client = db();
  const now    = Date.now();
  let inserted = 0, errors = 0;

  for (const task of plan.roadmap) {
    try {
      const { error } = await client.from("roadmap_tasks").insert({
        id          : task.id,
        roadmap_id  : roadmapId,
        phase_id    : `phase-${task.phase}`,
        title       : task.title,
        description : task.description,
        depends_on  : task.depends_on,
        status      : "pending",
        result      : null,
        error       : null,
        cost        : 0,
        updated_at  : now,
        source      : "company_builder",
      });
      if (error) { errors++; } else { inserted++; }
    } catch { errors++; }
  }
  return { inserted, errors };
}

// ── Roadmap task generator ─────────────────────────────────────────────────

function buildRoadmapTasks(
  planId     : string,
  company    : string,
  mvp        : string[],
  phase1     : string[],
  arch       : ArchitectureOutline
): PlanRoadmapTask[] {
  const t = (phase: PlanRoadmapTask["phase"], i: number, title: string, desc: string, type: string, deps: string[] = []): PlanRoadmapTask => ({
    id: `cb-${planId.slice(-6)}-${phase}-${i.toString().padStart(2, "0")}`,
    phase, title, description: desc, task_type: type, priority: i, depends_on: deps,
  });

  const tasks: PlanRoadmapTask[] = [
    // MVP phase
    t("mvp", 1, `[${company}] Initialize repository`, `Create GitHub repository with Next.js 14 + TypeScript + Tailwind starter. Tech: ${arch.frontend}. [type:build_module]`, "build_module"),
    t("mvp", 2, `[${company}] Database schema`, `Create Supabase schema: users, subscriptions, audit_logs, api_keys. Enable RLS. Tech: ${arch.database}. [type:update_schema]`, "update_schema", [`cb-${planId.slice(-6)}-mvp-01`]),
    t("mvp", 3, `[${company}] Authentication system`, `Implement Supabase Auth + NextAuth. Google + GitHub OAuth. Protected routes middleware. Tech: ${arch.auth}. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-mvp-02`]),
    t("mvp", 4, `[${company}] Payment integration`, `Stripe subscription tiers + webhooks. PayPal fallback. Customer portal. Tech: ${arch.payments}. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-mvp-03`]),
    t("mvp", 5, `[${company}] Core dashboard`, `Build main dashboard: overview stats, user profile, subscription status. Tech: ${arch.frontend}. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-mvp-03`]),
    t("mvp", 6, `[${company}] REST API layer`, `Create versioned /api/v1 routes with auth middleware, rate limiting, error handling. [type:create_api]`, "create_api", [`cb-${planId.slice(-6)}-mvp-02`]),
    t("mvp", 7, `[${company}] Deploy MVP`, `Configure Vercel project, env vars, preview + production branches. Verify health. [type:deploy_feature]`, "deploy_feature", [`cb-${planId.slice(-6)}-mvp-05`, `cb-${planId.slice(-6)}-mvp-06`]),
    // V1 phase
    ...mvp.slice(0, 3).map((f, i) => t("v1", i + 1, `[${company}] ${f}`, `Implement ${f} for ${company}. Fortune 50 quality, TypeScript strict, WCAG 2.2 AA. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-mvp-07`])),
    ...phase1.slice(0, 3).map((f, i) => t("v1", i + 4, `[${company}] ${f}`, `Build ${f}. Full error handling, tests, documentation. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-mvp-07`])),
    // V2 phase
    t("v2", 1, `[${company}] Analytics dashboard`, `Real-time analytics: MRR, DAU, feature usage, conversion funnels. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-v1-01`]),
    t("v2", 2, `[${company}] API documentation`, `Generate OpenAPI spec, Swagger UI, SDK generation, usage examples. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-v1-01`]),
    t("v2", 3, `[${company}] Admin panel`, `Super-admin dashboard: user management, billing overrides, feature flags, audit logs. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-v2-01`]),
    // Growth phase
    t("growth", 1, `[${company}] Growth automation`, `Referral system, affiliate program, usage-based pricing expansion. [type:ai_task]`, "ai_task", [`cb-${planId.slice(-6)}-v2-03`]),
    t("growth", 2, `[${company}] Enterprise tier`, `SSO/SAML, audit logs export, SLA guarantees, custom contracts. [type:build_module]`, "build_module", [`cb-${planId.slice(-6)}-v2-03`]),
  ];
  return tasks;
}
