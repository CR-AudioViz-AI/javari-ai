// app/api/debug/router/route.ts
// Runtime verification endpoint for Javari Multi-AI routing system
// Returns: registry status, model list, last routing decision

import { NextRequest } from "next/server";
import { initRegistry, getAllModels, getRegistryVersion } from "@/lib/javari/multi-ai/model-registry";
import { globalRouterLogger } from "@/app/api/chat/route";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Initialize registry
    await initRegistry();
    
    // Get all models
    const allModels = getAllModels();
    
    // Sample 5 models
    const sampleModels = allModels.slice(0, 5).map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      tier: m.tier,
      capabilities: m.capabilities,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        registry: {
          initialized: true,
          version: getRegistryVersion(),
          totalModels: allModels.length,
          sampleModels,
        },
        lastRoutingDecision: globalRouterLogger.lastDecision,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        registry: {
          initialized: false,
          version: null,
          totalModels: 0,
          sampleModels: [],
        },
        lastRoutingDecision: globalRouterLogger.lastDecision,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
