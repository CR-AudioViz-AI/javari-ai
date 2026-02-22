// instrumentation.ts
// CR AudioViz AI — Next.js Server Instrumentation
// 2026-02-21
//
// Called once at server startup by Next.js App Router.
// Warms the Secret Authority cache so first requests have zero DB latency.
//
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Edge runtime has no Node crypto — skip shim there
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { warmSecrets } = await import("@/lib/platform-secrets/getSecret");

    // Critical secrets warmed at startup — all other secrets fetch on first use
    const CRITICAL = [
      // AI routing — hit immediately on first user message
      "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY",
      "MISTRAL_API_KEY",   "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY",
      // Payments — needed on any billing route
      "STRIPE_SECRET_KEY",  "STRIPE_WEBHOOK_SECRET",
      "PAYPAL_CLIENT_ID",   "PAYPAL_CLIENT_SECRET",
      // Auth
      "NEXTAUTH_SECRET", "JWT_SECRET",
      // Infrastructure
      "GITHUB_TOKEN",  "VERCEL_API_TOKEN",
      "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
      // Internal
      "CRON_SECRET", "INTERNAL_API_SECRET", "ADMIN_SETUP_SECRET",
      "CANONICAL_ADMIN_SECRET", "AUTONOMOUS_CORE_ADMIN_SECRET",
    ];

    const { ok, failed } = await warmSecrets(CRITICAL);
    if (failed > 0) {
      console.warn(
        `[secret-authority] Startup warm: ${ok}/${CRITICAL.length} ok, ${failed} falling back to env`
      );
    } else {
      console.info(`[secret-authority] Startup warm: ${ok}/${CRITICAL.length} secrets ready`);
    }
  } catch (err) {
    // Never crash the server — fall back to process.env for everything
    console.error("[secret-authority] Warm failed — using process.env fallback:", (err as Error).message);
  }
}
