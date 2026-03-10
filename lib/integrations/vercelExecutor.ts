// lib/integrations/vercelExecutor.ts
// Purpose: Vercel Deployment Executor — trigger deployments, poll until READY/FAILED,
//          update artifact records. Vault-first credential resolution via getSecret().
// Date: 2026-03-10

import { getSecret } from "@/lib/platform-secrets/getSecret";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TriggerDeploymentResult {
  ok           : boolean;
  deploymentId?: string;
  url?         : string;
  state?       : string;
  error?       : string;
}

export interface DeploymentStatusResult {
  ok          : boolean;
  deploymentId: string;
  state       : "BUILDING" | "READY" | "ERROR" | "CANCELED" | "QUEUED" | string;
  url?        : string;
  readyAt?    : string;
  error?      : string;
}

export interface WaitForDeploymentResult {
  ok           : boolean;
  deploymentId : string;
  finalState   : string;
  url?         : string;
  elapsedMs    : number;
  attempts     : number;
  error?       : string;
}

// ── Credentials ───────────────────────────────────────────────────────────

async function getVercelToken(): Promise<string> {
  const t = await getSecret("VERCEL_TOKEN").catch(() => "")
         || process.env.VERCEL_TOKEN
         || "";
  if (!t) throw new Error("[vercelExecutor] VERCEL_TOKEN not found in vault or env");
  return t;
}

function getTeamId(): string {
  return process.env.VERCEL_TEAM_ID ?? "team_Z0yef7NlFu1coCJWz8UmUdI5";
}

// ── triggerDeployment ─────────────────────────────────────────────────────
// Triggers a new Vercel deployment from the main branch of a project.

export async function triggerDeployment(
  projectSlug: string = "javari-ai",
  repoId     : string = "1083842623"
): Promise<TriggerDeploymentResult> {
  try {
    const token  = await getVercelToken();
    const teamId = getTeamId();

    const res = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
      {
        method : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name     : projectSlug,
          target   : "preview",
          gitSource: { type: "github", ref: "main", repoId },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Vercel API ${res.status}: ${errText.slice(0, 300)}` };
    }

    const d = await res.json() as { id: string; url: string; readyState: string };
    const deployUrl = d.url.startsWith("http") ? d.url : `https://${d.url}`;

    console.log(`[vercelExecutor] 🚀 Deploy triggered: ${d.id} → ${deployUrl} (${d.readyState})`);
    return { ok: true, deploymentId: d.id, url: deployUrl, state: d.readyState ?? "QUEUED" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── getDeploymentStatus ───────────────────────────────────────────────────

export async function getDeploymentStatus(
  deploymentId: string
): Promise<DeploymentStatusResult> {
  try {
    const token  = await getVercelToken();
    const teamId = getTeamId();

    const res = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${teamId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, deploymentId, state: "ERROR", error: `Status check ${res.status}: ${errText.slice(0, 200)}` };
    }

    const d = await res.json() as { id: string; readyState: string; url?: string; ready?: number };
    const deployUrl = d.url ? (d.url.startsWith("http") ? d.url : `https://${d.url}`) : undefined;

    return {
      ok          : true,
      deploymentId: d.id,
      state       : d.readyState ?? "BUILDING",
      url         : deployUrl,
      readyAt     : d.ready ? new Date(d.ready).toISOString() : undefined,
    };
  } catch (err) {
    return { ok: false, deploymentId, state: "ERROR", error: String(err) };
  }
}

// ── waitForDeployment ─────────────────────────────────────────────────────
// Polls until state is READY or ERROR/CANCELED, or until timeout.
// Max wait: 5 minutes (300s). Poll interval: 10s.

export async function waitForDeployment(
  deploymentId: string,
  timeoutMs   : number = 300_000
): Promise<WaitForDeploymentResult> {
  const start   = Date.now();
  const POLL_MS = 10_000;
  let attempts  = 0;

  while (Date.now() - start < timeoutMs) {
    attempts++;
    const status = await getDeploymentStatus(deploymentId);

    console.log(`[vercelExecutor] 📊 ${deploymentId.slice(0, 12)}... state=${status.state} attempt=${attempts}`);

    if (status.state === "READY") {
      return {
        ok          : true,
        deploymentId,
        finalState  : "READY",
        url         : status.url,
        elapsedMs   : Date.now() - start,
        attempts,
      };
    }

    if (status.state === "ERROR" || status.state === "CANCELED") {
      return {
        ok          : false,
        deploymentId,
        finalState  : status.state,
        url         : status.url,
        elapsedMs   : Date.now() - start,
        attempts,
        error       : `Deployment ${status.state}`,
      };
    }

    // Still building — wait before next poll
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  return {
    ok          : false,
    deploymentId,
    finalState  : "TIMEOUT",
    elapsedMs   : Date.now() - start,
    attempts,
    error       : `Deployment timed out after ${timeoutMs}ms`,
  };
}

// ── Full deploy + verify workflow ─────────────────────────────────────────

export async function deployAndVerify(
  projectSlug    : string = "javari-ai",
  waitForReady   : boolean = false,   // set true if you have 5+ min budget
  timeoutMs      : number = 180_000
): Promise<{
  ok            : boolean;
  deploymentId? : string;
  url?          : string;
  finalState    : string;
  error?        : string;
}> {
  const triggerResult = await triggerDeployment(projectSlug);
  if (!triggerResult.ok || !triggerResult.deploymentId) {
    return { ok: false, finalState: "TRIGGER_FAILED", error: triggerResult.error };
  }

  if (!waitForReady) {
    // Return immediately with BUILDING state — async deploy
    return {
      ok          : true,
      deploymentId: triggerResult.deploymentId,
      url         : triggerResult.url,
      finalState  : triggerResult.state ?? "BUILDING",
    };
  }

  // Wait for completion
  const waitResult = await waitForDeployment(triggerResult.deploymentId, timeoutMs);
  return {
    ok          : waitResult.ok,
    deploymentId: triggerResult.deploymentId,
    url         : waitResult.url ?? triggerResult.url,
    finalState  : waitResult.finalState,
    error       : waitResult.error,
  };
}
