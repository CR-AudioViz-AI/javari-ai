import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "no" }, { status: 403 });
  }
  const dbUrl = process.env.DATABASE_URL ?? "UNSET";
  // Redact password
  const redacted = dbUrl.replace(/:[^@]+@/, ":***@");
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "UNSET";
  const sbKeyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length;
  const dbPass = (process.env.SUPABASE_DB_PASSWORD ?? "").length;
  return Response.json({
    db_url_redacted: redacted,
    sb_url: sbUrl,
    sb_key_len: sbKeyLen,
    db_pass_len: dbPass,
    has_db_url: dbUrl !== "UNSET",
  });
}
