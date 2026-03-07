// app/api/javari/memoryos/route.ts
// Purpose: MemoryOS learning cycle endpoint — writes learning records directly to
//          javari_self_answers and javari_anti_patterns via raw PostgREST fetch,
//          bypassing supabase-js schema cache misses on recently-created tables.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function postgrest(table: string) {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

function headers(extra: Record<string, string> = {}) {
  return {
    "apikey"       : SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type" : "application/json",
    "Prefer"       : "return=representation",
    ...extra,
  };
}

// ── POST /api/javari/memoryos ─────────────────────────────────────────────
// Body: { action: "write_learning" | "write_anti_pattern" | "list" | "session_summary", ...payload }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── write_learning: insert one record into javari_self_answers ─────────
    if (action === "write_learning") {
      const {
        question_pattern,
        answer,
        confidence_score = 0.8,
        usage_count      = 0,
        success_rate     = 1.0,
        source           = "admin_dashboard",
        metadata         = {},
      } = body;

      if (!question_pattern || !answer) {
        return NextResponse.json(
          { ok: false, error: "question_pattern and answer are required" },
          { status: 400 }
        );
      }

      const payload = {
        question_pattern,
        answer,
        confidence_score,
        usage_count,
        success_rate,
        source,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const resp = await fetch(postgrest("javari_self_answers"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `PostgREST insert failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => [{}]);
      return NextResponse.json({
        ok     : true,
        action : "write_learning",
        id     : Array.isArray(inserted) ? inserted[0]?.id : inserted?.id,
        record : payload,
      });
    }

    // ── write_anti_pattern: insert into javari_anti_patterns ──────────────
    if (action === "write_anti_pattern") {
      const {
        pattern_type,
        description,
        why_failed,
        context = {},
      } = body;

      if (!pattern_type || !description || !why_failed) {
        return NextResponse.json(
          { ok: false, error: "pattern_type, description, and why_failed are required" },
          { status: 400 }
        );
      }

      const payload = {
        pattern_type,
        description,
        why_failed,
        context,
        created_at: new Date().toISOString(),
      };

      const resp = await fetch(postgrest("javari_anti_patterns"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `PostgREST insert failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => [{}]);
      return NextResponse.json({
        ok     : true,
        action : "write_anti_pattern",
        id     : Array.isArray(inserted) ? inserted[0]?.id : inserted?.id,
        record : payload,
      });
    }

    // ── list: read recent learning records ─────────────────────────────────
    if (action === "list") {
      const limit  = body.limit  ?? 20;
      const source = body.source ?? null;

      let url = `${postgrest("javari_self_answers")}?order=created_at.desc&limit=${limit}`;
      if (source) url += `&source=eq.${source}`;

      const resp = await fetch(url, { headers: headers() });
      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json({ ok: false, error: err }, { status: 500 });
      }

      const rows = await resp.json();
      return NextResponse.json({ ok: true, action: "list", count: rows.length, rows });
    }

    // ── bulk_write: insert array of learning records ───────────────────────
    if (action === "bulk_write") {
      const { records } = body;
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json(
          { ok: false, error: "records array required" },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const enriched = records.map((r: Record<string, unknown>) => ({
        ...r,
        created_at: now,
        updated_at: now,
      }));

      const resp = await fetch(postgrest("javari_self_answers"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(enriched),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `Bulk insert failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => []);
      return NextResponse.json({
        ok      : true,
        action  : "bulk_write",
        written : Array.isArray(inserted) ? inserted.length : 1,
        ids     : Array.isArray(inserted) ? inserted.map((r: Record<string, string>) => r.id) : [],
      });
    }

    // ── bulk_anti_patterns: insert array of anti-patterns ─────────────────
    if (action === "bulk_anti_patterns") {
      const { records } = body;
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json(
          { ok: false, error: "records array required" },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const enriched = records.map((r: Record<string, unknown>) => ({
        ...r,
        created_at: now,
      }));

      const resp = await fetch(postgrest("javari_anti_patterns"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(enriched),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `Bulk anti-pattern insert failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => []);
      return NextResponse.json({
        ok      : true,
        action  : "bulk_anti_patterns",
        written : Array.isArray(inserted) ? inserted.length : 1,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}. Available: write_learning, write_anti_pattern, list, bulk_write, bulk_anti_patterns` },
      { status: 400 }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── GET /api/javari/memoryos ──────────────────────────────────────────────
export async function GET() {
  const resp = await fetch(
    `${postgrest("javari_self_answers")}?order=created_at.desc&limit=10`,
    { headers: headers() }
  );

  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: await resp.text() }, { status: 500 });
  }

  const rows = await resp.json();
  return NextResponse.json({
    ok: true,
    endpoint: "/api/javari/memoryos",
    table: "javari_self_answers",
    recent_count: rows.length,
    rows,
  });
}
