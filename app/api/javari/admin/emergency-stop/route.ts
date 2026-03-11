// app/api/javari/admin/emergency-stop/route.ts
// Purpose: Admin endpoint — reads VERCEL_TOKEN from vault, sets/clears
//          JAVARI_AUTOCOMMIT_DISABLED env var on this Vercel project.
//          Requires x-admin-secret header. Safe to call repeatedly.
// Date: 2026-03-11

import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";
const TEAM_ID    = "team_Z0yef7NlFu1coCJWz8UmUdI5";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminSecret = process.env.ADMIN_SETUP_SECRET ?? "";
  if (!adminSecret || req.headers.get("x-admin-secret") !== adminSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (body.action as string) ?? "disable";
  const value  = action === "enable" ? "false" : "true";
  const label  = action === "enable" ? "ENABLED" : "DISABLED";

  try {
    const token = await getSecret("VERCEL_TOKEN");
    if (!token) throw new Error("VERCEL_TOKEN not found in vault");

    const headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    };

    const listRes  = await fetch(
      "https://api.vercel.com/v9/projects/" + PROJECT_ID + "/env?teamId=" + TEAM_ID,
      { headers }
    );
    const listData = await listRes.json() as { envs?: Array<{ id: string; key: string }> };
    const existing = (listData.envs ?? []).find((e) => e.key === "JAVARI_AUTOCOMMIT_DISABLED");

    let result: Response;
    if (existing) {
      result = await fetch(
        "https://api.vercel.com/v9/projects/" + PROJECT_ID + "/env/" + existing.id + "?teamId=" + TEAM_ID,
        { method: "PATCH", headers, body: JSON.stringify({ value, target: ["production", "preview", "development"] }) }
      );
    } else {
      result = await fetch(
        "https://api.vercel.com/v9/projects/" + PROJECT_ID + "/env?teamId=" + TEAM_ID,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            key: "JAVARI_AUTOCOMMIT_DISABLED",
            value,
            type: "plain",
            target: ["production", "preview", "development"],
          }),
        }
      );
    }

    if (!result.ok) {
      const errText = await result.text();
      return NextResponse.json({ ok: false, error: "Vercel API " + result.status + ": " + errText.slice(0, 300) });
    }

    const data = await result.json();
    return NextResponse.json({
      ok: true,
      action,
      autocommit: label,
      envVarId: (data as Record<string, unknown>).id ?? "updated",
      message: "JAVARI_AUTOCOMMIT_DISABLED=" + value + " set on all environments",
      note: action === "disable"
        ? "Autonomous commits are BLOCKED. Re-enable: POST { action: 'enable' }"
        : "Autonomous commits are ENABLED.",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
