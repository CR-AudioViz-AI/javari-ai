// instrumentation.ts
// CR AudioViz AI — Next.js Server Instrumentation
// 2026-02-22
//
// Called once at server startup by Next.js App Router (Node.js runtime only).
// 1. Installs the process.env shim so all existing code transparently reads vault values.
// 2. Warms the Secret Authority cache to eliminate cold-path DB latency.
//
// next.config.js must have: experimental: { instrumentationHook: true }
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register(): Promise<void> {
  // Edge runtime has no Node.js crypto — skip entirely
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { installEnvShim, warmEnvShim } = await import("@/lib/platform-secrets/env-shim");

    // Step 1 — Install the Proxy shim over process.env
    installEnvShim();

    // Step 2 — Pre-populate cache for critical secrets
    const { ok, failed } = await warmEnvShim();

    if (failed > 0) {
      console.warn(
        `[secret-authority] Startup: ${ok} secrets loaded, ${failed} falling back to env`
      );
    } else {
      console.info(`[secret-authority] Startup: ${ok} secrets ready, shim active`);
    }
  } catch (err) {
    // Never crash the server — fall back to process.env for everything
    console.error(
      "[secret-authority] Startup failed — using process.env fallback:",
      (err as Error).message
    );
  }
}
