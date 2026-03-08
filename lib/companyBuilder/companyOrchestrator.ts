// lib/companyBuilder/companyOrchestrator.ts
// Purpose: Main pipeline — orchestrates the full company build sequence:
//          idea → plan → architecture → repo → infra → deploy → docs → roadmap tasks
//          Integrates with memory graph, orchestrator, and artifact recorder.
//          Supports internal, customer, SaaS, and AI-service modes.
// Date: 2026-03-08

import { planCompany, insertPlanRoadmapTasks, CompanyInput, CompanyPlan } from "./companyPlanner";
import { designProductArchitecture }  from "./productArchitect";
import { generateRepository }         from "./repoGenerator";
import { generateInfrastructure }     from "./infraGenerator";
import { deployApplication }          from "./deploymentManager";
import { designBusinessModel }        from "./businessModelDesigner";
import { generateDocumentation }      from "./documentationGenerator";
import { recordArtifacts }            from "@/lib/roadmap/artifactRecorder";
import { ingestRepair, ingestTechDiscovery } from "@/lib/memory/knowledgeNodeBuilder";
import { searchMemoryGraph }          from "@/lib/memory/memorySearch";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompanyBuildRequest {
  idea           : string;
  industry       : string;
  target_users?  : string;
  monetization?  : string;
  mode?          : "internal" | "customer" | "saas" | "ai_service";
  customer_name? : string;
  // Options
  createRepo?    : boolean;
  deployToVercel?: boolean;
  insertRoadmap? : boolean;
  githubOrg?     : string;
  vercelTeamId?  : string;
  taskId?        : string;    // parent roadmap task for artifact recording
}

export interface BuildStep {
  step     : string;
  ok       : boolean;
  durationMs: number;
  detail?  : string;
  error?   : string;
}

export interface CompanyBlueprint {
  ok              : boolean;
  buildId         : string;
  mode            : string;
  plan            : CompanyPlan;
  architecture    : Awaited<ReturnType<typeof designProductArchitecture>>;
  businessModel   : Awaited<ReturnType<typeof designBusinessModel>>;
  infrastructure  : ReturnType<typeof generateInfrastructure>;
  documentation   : Awaited<ReturnType<typeof generateDocumentation>>;
  repo?           : Awaited<ReturnType<typeof generateRepository>>;
  deployment?     : Awaited<ReturnType<typeof deployApplication>>;
  roadmapInserted : number;
  memoryContext?  : string;
  steps           : BuildStep[];
  totalDurationMs : number;
  artifactIds     : string[];
  errors          : string[];
  createdAt       : string;
  // Summary
  summary         : BuildSummary;
}

export interface BuildSummary {
  companyName          : string;
  tagline              : string;
  industry             : string;
  techStack            : string[];
  totalRoadmapTasks    : number;
  estimatedBuildDays   : number;
  pricingTiers         : number;
  revenueStreamsCount  : number;
  projectedMRR12Month : number;
  repoUrl?             : string;
  deploymentUrl?       : string;
  filesGenerated       : number;
  docsGenerated        : number;
}

// ── Step runner helper ─────────────────────────────────────────────────────

async function runStep<T>(
  steps   : BuildStep[],
  name    : string,
  fn      : () => Promise<T>
): Promise<{ result: T | null; ok: boolean }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    steps.push({ step: name, ok: true, durationMs: Date.now() - t0 });
    return { result, ok: true };
  } catch (err) {
    const msg = String(err);
    steps.push({ step: name, ok: false, durationMs: Date.now() - t0, error: msg.slice(0, 200) });
    return { result: null, ok: false };
  }
}

// ── Main orchestrator ──────────────────────────────────────────────────────

export async function buildCompany(req: CompanyBuildRequest): Promise<CompanyBlueprint> {
  const buildId  = `build-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();
  const wallStart = Date.now();
  const steps    : BuildStep[] = [];
  const errors   : string[] = [];
  const artifactIds: string[] = [];
  const mode     = req.mode ?? "saas";

  // ── 0. Memory graph — fetch prior knowledge ───────────────────────────
  let memoryContext = "";
  try {
    const mem = await searchMemoryGraph({
      query      : `${req.industry} ${req.idea}`,
      node_types : ["pattern", "fix", "technology"],
      limit      : 10,
    });
    memoryContext = mem.context_text;
  } catch { /* non-fatal */ }

  // ── 1. Plan ───────────────────────────────────────────────────────────
  const { result: plan } = await runStep(steps, "Company Planning (AI market analysis)", async () => {
    const p = await planCompany({
      idea: req.idea, industry: req.industry,
      target_users: req.target_users, monetization: req.monetization,
      mode, customer_name: req.customer_name,
    });
    return p;
  });
  if (!plan) {
    errors.push("Company planning failed — aborting");
    return buildFailure(buildId, mode, steps, errors, wallStart, createdAt);
  }

  // ── 2. Architecture ───────────────────────────────────────────────────
  const { result: architecture } = await runStep(steps, "Product Architecture Design", async () =>
    designProductArchitecture(plan)
  );
  if (!architecture) { errors.push("Architecture design failed"); }

  // ── 3. Business model ─────────────────────────────────────────────────
  const { result: businessModel } = await runStep(steps, "Business Model Design", async () =>
    designBusinessModel(plan)
  );
  if (!businessModel) { errors.push("Business model design failed"); }

  // ── 4. Infrastructure config ──────────────────────────────────────────
  const { result: infrastructure } = await runStep(steps, "Infrastructure Generation", async () => {
    if (!architecture) throw new Error("Architecture required");
    return generateInfrastructure(plan, architecture);
  });

  // ── 5. Repository ─────────────────────────────────────────────────────
  let repo: Awaited<ReturnType<typeof generateRepository>> | undefined;
  if (req.createRepo !== false) {
    const { result: repoResult } = await runStep(steps, "Repository Generation", async () => {
      if (!architecture) throw new Error("Architecture required");
      return generateRepository({
        plan, architecture, githubOrg: req.githubOrg ?? "CR-AudioViz-AI",
        private: true,
      });
    });
    repo = repoResult ?? undefined;
    if (repo?.errors.length) errors.push(...repo.errors);
  }

  // ── 6. Documentation ──────────────────────────────────────────────────
  const { result: documentation } = await runStep(steps, "Documentation Generation", async () => {
    if (!architecture || !businessModel) throw new Error("Architecture + business model required");
    return generateDocumentation(plan, architecture, businessModel);
  });

  // ── 7. Deploy (optional) ──────────────────────────────────────────────
  let deployment: Awaited<ReturnType<typeof deployApplication>> | undefined;
  if (req.deployToVercel && architecture) {
    const { result: depResult } = await runStep(steps, "Vercel Deployment", async () => {
      return deployApplication({
        plan, architecture: architecture!, infra: infrastructure!,
        vercelTeamId: req.vercelTeamId ?? "team_Z0yef7NlFu1coCJWz8UmUdI5",
        repoUrl: repo?.repoUrl,
      });
    });
    deployment = depResult ?? undefined;
    if (deployment?.errors.length) errors.push(...deployment.errors);
  }

  // ── 8. Insert roadmap tasks ───────────────────────────────────────────
  let roadmapInserted = 0;
  if (req.insertRoadmap !== false) {
    const { result: inserted } = await runStep(steps, "Roadmap Task Insertion", async () =>
      insertPlanRoadmapTasks(plan, `company-${buildId.slice(-8)}`)
    );
    roadmapInserted = inserted?.inserted ?? 0;
  }

  // ── 9. Memory graph — ingest tech stack ──────────────────────────────
  await runStep(steps, "Memory Graph Ingestion", async () => {
    for (const tech of plan.techStack.slice(0, 5)) {
      await ingestTechDiscovery({
        technology: tech, domain: "backend",
        context: `${plan.companyName} tech stack — ${req.industry}`, source: "company_builder",
      }).catch(() => {});
    }
  });

  // ── 10. Record artifacts ──────────────────────────────────────────────
  if (req.taskId) {
    const { inserted } = await recordArtifacts([
      {
        task_id          : req.taskId,
        artifact_type    : "company_blueprint" as "commit",
        artifact_location: buildId,
        artifact_data    : { companyName: plan.companyName, industry: req.industry, buildId },
      },
      {
        task_id          : req.taskId,
        artifact_type    : "product_architecture" as "commit",
        artifact_location: architecture?.architectId ?? buildId,
        artifact_data    : { tables: architecture?.database.tables.length, services: architecture?.services.length },
      },
      ...(repo?.created ? [{
        task_id          : req.taskId,
        artifact_type    : "generated_repo" as "commit",
        artifact_location: repo.repoUrl ?? repo.repoName,
        artifact_data    : { repoName: repo.repoName, filesGenerated: repo.filesGenerated },
      }] : []),
      ...(deployment?.ok ? [{
        task_id          : req.taskId,
        artifact_type    : "deployment_report" as "commit",
        artifact_location: deployment.projectUrl ?? buildId,
        artifact_data    : { projectId: deployment.projectId, envVarsSet: deployment.envVarsSet },
      }] : []),
    ]);
    artifactIds.push(...Array.from({ length: inserted }, (_, i) => `artifact-${i}`));
  }

  const totalDurationMs = Date.now() - wallStart;

  return {
    ok: errors.length === 0,
    buildId, mode, plan,
    architecture    : architecture!,
    businessModel   : businessModel!,
    infrastructure  : infrastructure!,
    documentation   : documentation!,
    repo,
    deployment,
    roadmapInserted,
    memoryContext   : memoryContext || undefined,
    steps,
    totalDurationMs,
    artifactIds,
    errors,
    createdAt,
    summary: {
      companyName         : plan.companyName,
      tagline             : plan.tagline,
      industry            : plan.industry,
      techStack           : plan.techStack,
      totalRoadmapTasks   : plan.roadmap.length,
      estimatedBuildDays  : plan.estimatedBuildDays,
      pricingTiers        : businessModel?.pricing.length ?? 0,
      revenueStreamsCount : businessModel?.revenueStreams.length ?? 0,
      projectedMRR12Month: businessModel?.totalMRR12Month ?? 0,
      repoUrl             : repo?.repoUrl,
      deploymentUrl       : deployment?.projectUrl,
      filesGenerated      : repo?.filesGenerated ?? 0,
      docsGenerated       : documentation ? 8 : 0,
    },
  };
}

// ── Failure helper ─────────────────────────────────────────────────────────

function buildFailure(
  buildId: string, mode: string, steps: BuildStep[],
  errors: string[], wallStart: number, createdAt: string
): CompanyBlueprint {
  return {
    ok: false, buildId, mode,
    plan: null as unknown as CompanyPlan,
    architecture: null as never,
    businessModel: null as never,
    infrastructure: null as never,
    documentation: null as never,
    roadmapInserted: 0, steps,
    totalDurationMs: Date.now() - wallStart,
    artifactIds: [], errors, createdAt,
    summary: {
      companyName: "", tagline: "", industry: "", techStack: [],
      totalRoadmapTasks: 0, estimatedBuildDays: 0,
      pricingTiers: 0, revenueStreamsCount: 0, projectedMRR12Month: 0,
      filesGenerated: 0, docsGenerated: 0,
    },
  };
}
