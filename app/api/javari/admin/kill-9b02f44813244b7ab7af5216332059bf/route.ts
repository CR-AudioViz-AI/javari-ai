// app/api/javari/admin/kill-9b02f44813244b7ab7af5216332059bf/route.ts
// Purpose: One-time emergency stop — sets JAVARI_AUTOCOMMIT_DISABLED via vault VERCEL_TOKEN.
//          Security: path token is the auth. Delete after use.
// Date: 2026-03-11

import { NextResponse } from "next/server";
import { getSecret } from "@/lib/platform-secrets/getSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_zxjzE2qvMWFWqV0AspGvago6aPV5";
const TEAM_ID    = "team_Z0yef7NlFu1coCJWz8UmUdI5";

export async function GET(): Promise<NextResponse> {
  try {
    const token = await getSecret("VERCEL_TOKEN");
    if (!token) throw new Error("VERCEL_TOKEN not in vault");

    const headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    };

    // Check if var exists
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
        { method: "PATCH", headers, body: JSON.stringify({ value: "true", target: ["production", "preview", "development"] }) }
      );
    } else {
      result = await fetch(
        "https://api.vercel.com/v9/projects/" + PROJECT_ID + "/env?teamId=" + TEAM_ID,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            key: "JAVARI_AUTOCOMMIT_DISABLED",
            value: "true",
            type: "plain",
            target: ["production", "preview", "development"],
          }),
        }
      );
    }

    if (!result.ok) {
      const errText = await result.text();
      return NextResponse.json({ ok: false, error: "Vercel " + result.status + ": " + errText.slice(0, 300) });
    }

    const data = await result.json() as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      message: "JAVARI_AUTOCOMMIT_DISABLED=true set on all Vercel environments",
      envVarId: data.id ?? "updated",
      action: "Autonomous commits are now BLOCKED.",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
