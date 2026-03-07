// app/api/javari/memoryos/route.ts
// Purpose: MemoryOS learning cycle endpoint — writes learning records to
//          javari_knowledge (confirmed live table) via raw PostgREST fetch.
//          Also writes anti-patterns to javari_healing_history.
//          Bypasses supabase-js schema cache for tables not in generated types.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function postgrest(table: string, query = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
}

function headers() {
  return {
    "apikey"       : SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type" : "application/json",
    "Prefer"       : "return=representation",
  };
}

// ── POST /api/javari/memoryos ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const action = body.action as string;

    // ── write_learning ─────────────────────────────────────────────────────
    if (action === "write_learning") {
      const {
        question_pattern,
        answer,
        confidence_score = 0.8,
        source           = "admin_dashboard",
        phase_id         = "",
        task_id          = "",
        model_used       = "",
        execution_ms     = null,
        speed_class      = "",
        cost_class       = "",
        exec_status      = "",
      } = body;

      if (!question_pattern || !answer) {
        return NextResponse.json(
          { ok: false, error: "question_pattern and answer are required" },
          { status: 400 }
        );
      }

      // Map to javari_knowledge schema
      const payload = {
        category         : "roadmap_execution",
        subcategory      : phase_id || "general",
        title            : question_pattern.slice(0, 200),
        content          : answer,
        keywords         : [phase_id, task_id, model_used, exec_status].filter(Boolean),
        source_type      : source,
        source_url       : `task://${task_id}`,
        confidence_score,
        times_referenced : 0,
        created_at       : new Date().toISOString(),
        updated_at       : new Date().toISOString(),
      };

      const resp = await fetch(postgrest("javari_knowledge"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `PostgREST write failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => [{}]);
      return NextResponse.json({
        ok     : true,
        action : "write_learning",
        id     : Array.isArray(inserted) ? inserted[0]?.id : inserted?.id,
        table  : "javari_knowledge",
      });
    }

    // ── write_anti_pattern ─────────────────────────────────────────────────
    if (action === "write_anti_pattern") {
      const {
        error_type   = "routing_anti_pattern",
        description  = "",
        why_failed   = "",
        context      = {},
        auto_fixed   = false,
        escalated    = false,
      } = body;

      // Only error_type, error_message, error_context, created_at confirmed live
      const payload = {
        error_type,
        error_message : description,
        error_context : { ...context, why_failed },
        created_at    : new Date().toISOString(),
      };

      const resp = await fetch(postgrest("javari_healing_history"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `Anti-pattern write failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => [{}]);
      return NextResponse.json({
        ok    : true,
        action: "write_anti_pattern",
        id    : Array.isArray(inserted) ? inserted[0]?.id : inserted?.id,
        table : "javari_healing_history",
      });
    }

    // ── bulk_write ─────────────────────────────────────────────────────────
    if (action === "bulk_write") {
      const { records } = body as { records: Record<string, unknown>[] };
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ ok: false, error: "records array required" }, { status: 400 });
      }

      const now = new Date().toISOString();
      const enriched = records.map((r) => ({
        category         : "roadmap_execution",
        subcategory      : (r.phase_id as string) || "general",
        title            : ((r.question_pattern as string) || "").slice(0, 200),
        content          : (r.answer as string) || "",
        keywords         : [r.phase_id, r.task_id, r.model_used, r.exec_status].filter(Boolean),
        source_type      : (r.source as string) || "admin_dashboard",
        source_url       : `task://${r.task_id || "unknown"}`,
        confidence_score : (r.confidence_score as number) ?? 0.8,
        times_referenced : 0,
        created_at       : now,
        updated_at       : now,
      }));

      const resp = await fetch(postgrest("javari_knowledge"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(enriched),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `Bulk write failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => []);
      return NextResponse.json({
        ok     : true,
        action : "bulk_write",
        written: Array.isArray(inserted) ? inserted.length : 0,
        table  : "javari_knowledge",
        ids    : Array.isArray(inserted) ? inserted.map((r: { id: string }) => r.id) : [],
      });
    }

    // ── bulk_anti_patterns ─────────────────────────────────────────────────
    if (action === "bulk_anti_patterns") {
      const { records } = body as { records: Record<string, unknown>[] };
      if (!Array.isArray(records) || records.length === 0) {
        return NextResponse.json({ ok: false, error: "records array required" }, { status: 400 });
      }

      const now = new Date().toISOString();
      // Only error_type, error_message, error_context, created_at are confirmed live
      // Embed why_failed inside error_context to avoid schema cache miss on diagnosis column
      const enriched = records.map((r) => ({
        error_type    : (r.pattern_type as string) || "execution_anti_pattern",
        error_message : (r.description as string)  || "",
        error_context : {
          ...(r.context as Record<string, unknown> || {}),
          why_failed: r.why_failed || "",
          session   : "ROADMAP_EXECUTION_LESSONS_2026_03_07",
        },
        created_at    : now,
      }));

      const resp = await fetch(postgrest("javari_healing_history"), {
        method : "POST",
        headers: headers(),
        body   : JSON.stringify(enriched),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json(
          { ok: false, error: `Bulk anti-pattern write failed: ${err}` },
          { status: 500 }
        );
      }

      const inserted = await resp.json().catch(() => []);
      return NextResponse.json({
        ok     : true,
        action : "bulk_anti_patterns",
        written: Array.isArray(inserted) ? inserted.length : 0,
        table  : "javari_healing_history",
      });
    }

    // ── list ───────────────────────────────────────────────────────────────
    if (action === "list") {
      const limit = (body.limit as number) ?? 20;
      const resp  = await fetch(
        postgrest("javari_knowledge", `category=eq.roadmap_execution&order=created_at.desc&limit=${limit}`),
        { headers: headers() }
      );
      if (!resp.ok) {
        return NextResponse.json({ ok: false, error: await resp.text() }, { status: 500 });
      }
      const rows = await resp.json();
      return NextResponse.json({ ok: true, action: "list", count: rows.length, rows });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── GET: recent roadmap_execution records ─────────────────────────────────
export async function GET() {
  const resp = await fetch(
    postgrest("javari_knowledge", "category=eq.roadmap_execution&order=created_at.desc&limit=10"),
    { headers: headers() }
  );
  if (!resp.ok) {
    return NextResponse.json({ ok: false, error: await resp.text() }, { status: 500 });
  }
  const rows = await resp.json();
  return NextResponse.json({
    ok    : true,
    table : "javari_knowledge",
    count : rows.length,
    rows,
  });
}
