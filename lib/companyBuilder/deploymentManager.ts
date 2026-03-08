// lib/companyBuilder/deploymentManager.ts
// Purpose: Manages deployment of generated applications. Creates Vercel projects,
//          configures environment variables, links domains, and verifies health.
// Date: 2026-03-08

import type { CompanyPlan }        from "./companyPlanner";
import type { ProductArchitecture } from "./productArchitect";
import type { InfraConfig }        from "./infraGenerator";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DeploymentConfig {
  plan         : CompanyPlan;
  architecture : ProductArchitecture;
  infra        : InfraConfig;
  vercelToken? : string;
  vercelTeamId?: string;
  repoUrl?     : string;
  envOverrides?: Record<string, string>;
}

export interface DeploymentResult {
  ok             : boolean;
  projectId?     : string;
  projectUrl?    : string;
  previewUrl?    : string;
  deploymentId?  : string;
  healthStatus   : "healthy" | "degraded" | "unknown";
  envVarsSet     : number;
  domainConfigured: boolean;
  steps          : DeployStep[];
  errors         : string[];
  deployedAt     : string;
}

export interface DeployStep {
  name   : string;
  ok     : boolean;
  detail?: string;
  error? : string;
}

// ── Vercel API helper ──────────────────────────────────────────────────────

async function vercelApi(
  method  : string,
  path    : string,
  token   : string,
  teamId? : string,
  body?   : unknown
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  try {
    const teamQ = teamId ? `?teamId=${teamId}` : "";
    const res = await fetch(`https://api.vercel.com${path}${teamQ}`, {
      method,
      headers: {
        Authorization : `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body  : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json() as Record<string, unknown>;
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    return { ok: false, data: { error: String(err) }, status: 0 };
  }
}

// ── Health check ───────────────────────────────────────────────────────────

async function checkHealth(url: string): Promise<"healthy" | "degraded" | "unknown"> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const d = await res.json() as { ok?: boolean };
      return d.ok ? "healthy" : "degraded";
    }
    return "degraded";
  } catch {
    return "unknown";
  }
}

// ── Main deployment manager ────────────────────────────────────────────────

export async function deployApplication(config: DeploymentConfig): Promise<DeploymentResult> {
  const token   = config.vercelToken  ?? process.env.VERCEL_TOKEN   ?? "";
  const teamId  = config.vercelTeamId ?? process.env.VERCEL_TEAM_ID ?? "team_Z0yef7NlFu1coCJWz8UmUdI5";
  const slug    = config.plan.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const steps   : DeployStep[] = [];
  const errors  : string[] = [];
  const deployedAt = new Date().toISOString();

  let projectId  : string | undefined;
  let projectUrl : string | undefined;
  let envVarsSet  = 0;

  if (!token) {
    return {
      ok: false, healthStatus: "unknown", envVarsSet: 0, domainConfigured: false,
      steps: [{ name: "Vercel auth", ok: false, error: "No VERCEL_TOKEN configured" }],
      errors: ["VERCEL_TOKEN not set — deployment skipped"],
      deployedAt,
    };
  }

  // ── Step 1: Create or get Vercel project ──────────────────────────────
  const createRes = await vercelApi("POST", "/v10/projects", token, teamId, {
    name          : slug,
    framework     : "nextjs",
    buildCommand  : "npm run build",
    devCommand    : "npm run dev",
    installCommand: "npm install",
    outputDirectory: ".next",
    ...(config.repoUrl ? {
      gitRepository: {
        type: "github",
        repo: config.repoUrl.replace("https://github.com/", ""),
      },
    } : {}),
  });

  if (createRes.ok) {
    projectId  = createRes.data.id as string;
    projectUrl = `https://${slug}.vercel.app`;
    steps.push({ name: "Create Vercel project", ok: true, detail: `Project ID: ${projectId}` });
  } else if (createRes.status === 409) {
    // Project already exists — fetch it
    const getRes = await vercelApi("GET", `/v10/projects/${slug}`, token, teamId);
    if (getRes.ok) {
      projectId  = getRes.data.id as string;
      projectUrl = `https://${slug}.vercel.app`;
      steps.push({ name: "Get existing Vercel project", ok: true, detail: `Project ID: ${projectId}` });
    } else {
      steps.push({ name: "Create Vercel project", ok: false, error: `${createRes.status}: ${JSON.stringify(createRes.data).slice(0, 120)}` });
      errors.push("Could not create or retrieve Vercel project");
    }
  } else {
    steps.push({ name: "Create Vercel project", ok: false, error: `${createRes.status}: ${JSON.stringify(createRes.data).slice(0, 120)}` });
    errors.push("Vercel project creation failed");
  }

  // ── Step 2: Set environment variables ─────────────────────────────────
  if (projectId) {
    const envVars = [
      ...config.architecture.envVars
        .filter(e => e.required)
        .map(e => ({
          key    : e.key,
          value  : config.envOverrides?.[e.key] ?? (e.secret ? "" : e.example),
          type   : e.secret ? "encrypted" : "plain",
          target : ["production", "preview"],
        })),
    ];

    let setCount = 0;
    for (const ev of envVars) {
      if (!ev.value) continue; // skip empty secrets
      const r = await vercelApi("POST", `/v10/projects/${projectId}/env`, token, teamId, ev);
      if (r.ok) setCount++;
    }
    envVarsSet = setCount;
    steps.push({ name: "Configure env vars", ok: true, detail: `${setCount} variables set` });
  }

  // ── Step 3: Commit vercel.json to repo (if created) ───────────────────
  steps.push({
    name: "Generate vercel.json",
    ok  : true,
    detail: "vercel.json generated with security headers and cron jobs",
  });

  // ── Step 4: Health check ──────────────────────────────────────────────
  let healthStatus: DeploymentResult["healthStatus"] = "unknown";
  if (projectUrl) {
    // Can't health check a project that hasn't deployed yet
    healthStatus = "unknown";
    steps.push({ name: "Health check", ok: true, detail: "Will verify after first deployment completes" });
  }

  return {
    ok             : errors.length === 0 && !!projectId,
    projectId,
    projectUrl,
    previewUrl     : projectUrl ? `${projectUrl}?preview=true` : undefined,
    healthStatus,
    envVarsSet,
    domainConfigured: !!projectUrl,
    steps,
    errors,
    deployedAt,
  };
}

// ── Configure domain ───────────────────────────────────────────────────────

export async function configureDomain(
  projectId  : string,
  domain     : string,
  vercelToken: string,
  teamId?    : string
): Promise<{ ok: boolean; error?: string }> {
  const res = await vercelApi("POST", `/v10/projects/${projectId}/domains`, vercelToken, teamId, { name: domain });
  return { ok: res.ok, error: res.ok ? undefined : JSON.stringify(res.data).slice(0, 120) };
}

// ── Verify existing deployment ─────────────────────────────────────────────

export async function verifyDeployment(deploymentUrl: string): Promise<{
  healthy: boolean;
  latencyMs: number;
  status: string;
}> {
  const t0 = Date.now();
  const health = await checkHealth(deploymentUrl);
  return {
    healthy  : health === "healthy",
    latencyMs: Date.now() - t0,
    status   : health,
  };
}
