// instrumentation.ts
// CR AudioViz AI — Next.js Server Instrumentation
// 2026-02-22
// Called once at server startup by Next.js App Router (Node.js runtime only).
// 1. Installs the process.env shim so all existing code transparently reads vault values.
// 2. Warms the Secret Authority cache to eliminate cold-path DB latency.
// next.config.js must have: experimental: { instrumentationHook: true }
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
  // Edge runtime has no Node.js crypto — skip entirely
    // Step 1 — Install the Proxy shim over process.env
    // Step 2 — Pre-populate cache for critical secrets
    // Never crash the server — fall back to process.env for everything
export default {}
