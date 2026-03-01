// app/api/admin/test-quarantine/route.ts
// TEMPORARY: Test endpoint to simulate provider failures for quarantine verification
// Delete after verification

import { NextRequest } from "next/server";
import { updateProviderHealth, getAllProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { applyHealthRanking } from "@/lib/javari/multi-ai/routing-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body.provider ?? "test_provider";
  const action = body.action ?? "fail"; // "fail" or "succeed"
  const count = Math.min(body.count ?? 1, 10); // Max 10 at once

  // Execute the requested action
  for (let i = 0; i < count; i++) {
    if (action === "fail") {
      updateProviderHealth(provider, false, 0, "simulated_failure");
    } else {
      updateProviderHealth(provider, true, 100);
    }
  }

  // Small delay for async DB writes
  await new Promise(r => setTimeout(r, 500));

  // Read back state
  const health = await getAllProviderHealth();
  const target = health.find(h => h.provider === provider);

  // Check routing scores
  const defaultChain = ["groq", "openai", "anthropic", "mistral", "openrouter", "xai", "perplexity"];
  if (!defaultChain.includes(provider)) defaultChain.push(provider);
  const { scores } = applyHealthRanking(defaultChain);
  const providerScore = scores.find(s => s.provider === provider);

  return Response.json({
    action,
    count,
    provider,
    health: target ?? null,
    routing_score: providerScore ?? null,
    all_providers: health.map(h => ({
      provider: h.provider,
      quarantined: h.quarantined,
      quarantine_until: h.quarantine_until,
      failure_burst_count: h.failure_burst_count,
      consecutive_failures: h.consecutive_failures,
    })),
  });
}
