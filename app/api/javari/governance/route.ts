// app/api/javari/governance/route.ts
// Purpose: REST API for the Javari Ecosystem Governance Engine.
//          Exposes capability registry, architecture validation, duplication
//          detection, and pre-build checks for autonomous executor use.
// Date: 2026-03-09

import { NextResponse }         from "next/server";
import { runGovernanceCheck }   from "@/lib/governance/governanceEngine";
import { registryStats }        from "@/lib/governance/capabilityRegistry";
import { SYSTEM_REGISTRY }      from "@/lib/governance/systemOwnership";

export const maxDuration = 60;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as Record<string, unknown>;
    const type = (body.type as string) ?? "full_scan";

    const result = await runGovernanceCheck({
      type                    : type as never,
      proposedCapabilityId    : body.proposedCapabilityId    as string | undefined,
      proposedCapabilityLabel : body.proposedCapabilityLabel as string | undefined,
      requestingSystem        : body.requestingSystem        as string | undefined,
      description             : body.description             as string | undefined,
      task_id                 : body.task_id                 as string | undefined,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  const stats = registryStats();
  return NextResponse.json({
    ok       : true,
    endpoint : "POST /api/javari/governance",
    version  : "1.0.0",
    registry : stats,
    systems  : SYSTEM_REGISTRY.length,
    modes    : {
      pre_build          : "{ type:'pre_build', proposedCapabilityId, proposedCapabilityLabel, requestingSystem, description? }",
      full_scan          : "{ type:'full_scan' } — full ecosystem duplication + architecture validation",
      architecture       : "{ type:'architecture' } — architecture validation only",
      capability_lookup  : "{ type:'capability_lookup' } — full capability registry + ownership report",
    },
  });
}
