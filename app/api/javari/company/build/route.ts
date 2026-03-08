// app/api/javari/company/build/route.ts
// Purpose: Javari Autonomous Company Builder — REST API endpoint.
//          POST  { idea, industry, ... } → full company blueprint
//          GET   → schema documentation
// Date: 2026-03-08

import { NextRequest, NextResponse } from "next/server";
import { buildCompany }              from "@/lib/companyBuilder/companyOrchestrator";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;   // Company builds can take up to 5 minutes

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const idea     = (body.idea     as string | undefined)?.trim();
  const industry = (body.industry as string | undefined)?.trim();

  if (!idea || !industry) {
    return NextResponse.json(
      { ok: false, error: "Both 'idea' and 'industry' are required fields" },
      { status: 400 }
    );
  }

  try {
    const blueprint = await buildCompany({
      idea,
      industry,
      target_users  : body.target_users   as string | undefined,
      monetization  : body.monetization   as string | undefined,
      mode          : (body.mode          as "internal" | "customer" | "saas" | "ai_service") ?? "saas",
      customer_name : body.customer_name  as string | undefined,
      createRepo    : body.create_repo    !== false,
      deployToVercel: body.deploy         === true,
      insertRoadmap : body.insert_roadmap !== false,
      githubOrg     : body.github_org     as string | undefined,
      taskId        : body.task_id        as string | undefined,
    });

    // Return full blueprint
    return NextResponse.json({
      ok             : blueprint.ok,
      buildId        : blueprint.buildId,
      mode           : blueprint.mode,
      durationMs     : Date.now() - t0,
      // Company identity
      companyName    : blueprint.plan?.companyName,
      tagline        : blueprint.plan?.tagline,
      productVision  : blueprint.plan?.productVision,
      // Summary (fast overview)
      summary        : blueprint.summary,
      // Full plan
      plan: {
        companyName        : blueprint.plan?.companyName,
        productVision      : blueprint.plan?.productVision,
        tagline            : blueprint.plan?.tagline,
        industry           : blueprint.plan?.industry,
        target_users       : blueprint.plan?.target_users,
        monetization       : blueprint.plan?.monetization,
        marketOpportunity  : blueprint.plan?.marketOpportunity,
        differentiators    : blueprint.plan?.differentiators,
        mvpFeatures        : blueprint.plan?.mvpFeatures,
        phase1Features     : blueprint.plan?.phase1Features,
        techStack          : blueprint.plan?.techStack,
        estimatedBuildDays : blueprint.plan?.estimatedBuildDays,
        architectureOutline: blueprint.plan?.architectureOutline,
        roadmapTaskCount   : blueprint.plan?.roadmap?.length ?? 0,
      },
      // Architecture
      architecture: blueprint.architecture ? {
        frontend     : blueprint.architecture.frontend,
        backend      : blueprint.architecture.backend,
        database     : {
          engine: blueprint.architecture.database.engine,
          tables: blueprint.architecture.database.tables.map(t => t.name),
          orm   : blueprint.architecture.database.orm,
        },
        auth         : blueprint.architecture.auth,
        payments     : {
          provider: blueprint.architecture.payments.provider,
          tiers   : blueprint.architecture.payments.tiers,
        },
        ai_layer     : blueprint.architecture.ai_layer,
        infrastructure: blueprint.architecture.infrastructure,
        security     : blueprint.architecture.security,
        monitoring   : blueprint.architecture.monitoring,
        folderStructure: blueprint.architecture.folderStructure,
        envVarsCount : blueprint.architecture.envVars.length,
        servicesCount: blueprint.architecture.services.length,
        integrationsCount: blueprint.architecture.integrations.length,
      } : null,
      // Business model
      businessModel: blueprint.businessModel ? {
        pricing          : blueprint.businessModel.pricing,
        revenueStreams    : blueprint.businessModel.revenueStreams,
        unitEconomics    : blueprint.businessModel.unitEconomics,
        growthStrategy   : blueprint.businessModel.growthStrategy.slice(0, 3),
        totalMRR12Month  : blueprint.businessModel.totalMRR12Month,
        totalARR12Month  : blueprint.businessModel.totalARR12Month,
        breakEvenMonth   : blueprint.businessModel.breakEvenMonth,
        tokenSystem      : blueprint.businessModel.tokenSystem,
        affiliateProgram : blueprint.businessModel.affiliateProgram,
      } : null,
      // Infrastructure
      infrastructure: blueprint.infrastructure ? {
        vercelConfig: JSON.parse(blueprint.infrastructure.vercel.vercelJson),
        crons       : blueprint.infrastructure.vercel.crons,
        hasDocker   : true,
        hasTerraform: true,
        hasCICD     : true,
      } : null,
      // Documentation
      documentation: blueprint.documentation ? {
        generated: ["ARCHITECTURE.md", "API.md", "USER_GUIDE.md", "INVESTOR_SUMMARY.md", "ONBOARDING.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md"],
        investorSummary: blueprint.documentation.investorSummary,
      } : null,
      // Repo
      repo: blueprint.repo ? {
        repoName      : blueprint.repo.repoName,
        repoUrl       : blueprint.repo.repoUrl,
        created       : blueprint.repo.created,
        filesGenerated: blueprint.repo.filesGenerated,
        errors        : blueprint.repo.errors,
      } : null,
      // Deployment
      deployment: blueprint.deployment ? {
        ok          : blueprint.deployment.ok,
        projectUrl  : blueprint.deployment.projectUrl,
        projectId   : blueprint.deployment.projectId,
        healthStatus: blueprint.deployment.healthStatus,
        envVarsSet  : blueprint.deployment.envVarsSet,
        steps       : blueprint.deployment.steps,
      } : null,
      // Build metadata
      roadmapInserted: blueprint.roadmapInserted,
      steps          : blueprint.steps,
      errors         : blueprint.errors,
    });

  } catch (err) {
    console.error("[company/build] Fatal error:", err);
    return NextResponse.json(
      { ok: false, error: String(err), durationMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok      : true,
    endpoint: "POST /api/javari/company/build",
    version : "1.0.0",
    description: "Javari Autonomous Company Builder — generates complete company blueprints",
    inputs: {
      required: { idea: "string", industry: "string" },
      optional: {
        target_users  : "string — who the product serves",
        monetization  : "string — revenue model",
        mode          : "saas | customer | internal | ai_service",
        customer_name : "string — for customer mode",
        create_repo   : "boolean — create GitHub repo (default true)",
        deploy        : "boolean — deploy to Vercel (default false)",
        insert_roadmap: "boolean — insert roadmap tasks (default true)",
        github_org    : "string — GitHub org for repo",
        task_id       : "string — parent task for artifact recording",
      },
    },
    outputs: ["plan", "architecture", "businessModel", "infrastructure", "documentation", "repo", "deployment"],
    integrations: ["Javari Orchestrator", "Memory Graph", "Roadmap Tasks", "GitHub API", "Vercel API", "Artifact Recorder"],
    example: {
      idea    : "AI platform for autonomous software engineering",
      industry: "developer tools",
      mode    : "saas",
    },
  });
}
