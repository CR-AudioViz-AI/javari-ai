// app/api/javari/migrate/route.ts
// Purpose: DDL runner + test seeder + canonical roadmap ingestion
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function taskId(phase: string, title: string, index: number): string {
  return `rm-${phase}-${slugify(title)}-${String(index).padStart(2, "0")}`;
}

// ─── Phase priority order ─────────────────────────────────────────────────────
const PHASE_ORDER = [
  "core_platform",
  "autonomy_engine",
  "multi_ai_chat",
  "payments",
  "creator_tools",
  "ecosystem_modules",
];

// ─── Canonical Roadmap — derived from MASTER_ROADMAP_v3.1 ────────────────────
const ROADMAP: Array<{
  phase: string;
  tasks: Array<{ title: string; description: string; depends_on?: string[] }>;
}> = [
  {
    phase: "core_platform",
    tasks: [
      { title: "Reinforce Execution Kernel Safety Gates", description: "Audit and harden the execution kernel with explicit safety gates: input validation, output sanitization, cost circuit breakers, and timeout enforcement on all AI task execution paths." },
      { title: "Implement Self-Repair Loop", description: "Build an active self-healing loop that monitors task failures, retries with exponential backoff, escalates to human review after threshold, and logs all repair actions to javari_self_healing_log." },
      { title: "Build MemoryOS Long-Term Reasoning Layer", description: "Implement persistent long-term memory for Javari: vector store integration, memory tagging by topic/user/session, retrieval-augmented generation, and memory pruning on a rolling window.", depends_on: ["rm-core_platform-reinforce-execution-kernel-safety-gates-00"] },
      { title: "Implement Multi-Agent Router", description: "Build the Architect / Builder / Reviewer / Documenter agent router: task classification, agent assignment, inter-agent messaging channel, and result aggregation back to the primary response stream.", depends_on: ["rm-core_platform-reinforce-execution-kernel-safety-gates-00"] },
      { title: "Add Task Persistence Background Execution", description: "Enable tasks to continue running after user disconnect: persistent job queue, progress checkpointing, resume-on-reconnect, and completion notification via NotificationOS." },
      { title: "Universal File Export Engine", description: "Implement universal file export across all formats: PDF, PPTX, DOCX, XLSX, ZIP. Verify and test all existing export routes; fill gaps for any unsupported format." },
      { title: "File Extraction Engine zip tar rar", description: "Build server-side file extraction supporting .zip, .tar, .tar.gz, and .rar archives. Expose via API route with virus scanning hook and size limits enforced." },
      { title: "Complete IdentityOS RBAC and MFA", description: "Implement full Role-Based Access Control across all API routes: define role taxonomy viewer/editor/admin/super_admin, enforce at middleware level, and add TOTP-based MFA for admin accounts." },
      { title: "Build PolicyOS Permissions and Super Admin Logic", description: "Create a standalone PolicyOS layer: permission definitions, policy evaluation engine, super_admin override system, and API routes for policy CRUD and enforcement audit." },
      { title: "Complete NotificationOS SMS and Push Channels", description: "Extend NotificationOS Phase 1 MVP: add SMS delivery via Twilio, browser push notifications via Web Push API, and production email via SendGrid or Resend. Preserve existing console-mode as dev fallback." },
      { title: "Build BackupOS Daily Restore Points", description: "Implement automated daily database backups: Supabase pg_dump schedule, encrypted backup storage to R2, restore procedure documentation, and 30-day retention with integrity verification." },
      { title: "Complete AuditOS Compliance Framework", description: "Extend existing audit logging to full compliance framework: structured event taxonomy, GDPR data retention policies, export endpoint for compliance audits, and integration with AuditOS telemetry dashboard." },
    ],
  },
  {
    phase: "autonomy_engine",
    tasks: [
      { title: "Complete Canonical Vector Memory Ingest Pipeline", description: "Finish Step 11 of Canonical Vector Memory: ingest all 34 platform markdown docs from R2 cold-storage/consolidation-docs/, generate embeddings via OpenAI text-embedding-3-small, store in canonical_memories table with source metadata." },
      { title: "Build Vector Search API for Javari Context Retrieval", description: "Implement GET /api/canonical/search: cosine similarity search over canonical_memories, top-k retrieval, relevance scoring, and inject results as context into Javari AI responses.", depends_on: ["rm-autonomy_engine-complete-canonical-vector-memory-ingest-pipeline-12"] },
      { title: "Implement Autonomy Cycle Budget Controls", description: "Add per-cycle spend limits to the autonomy loop: configurable daily and per-cycle cost caps, automatic pause when threshold reached, cost summary in cycle response, and admin override endpoint." },
      { title: "Build Roadmap Progress Dashboard API", description: "Create GET /api/javari/roadmap/progress: aggregate roadmap_tasks by phase and status, return completion percentages, estimated cost to date, and pending task count per phase_id." },
    ],
  },
  {
    phase: "multi_ai_chat",
    tasks: [
      { title: "Implement AEC Streams Real-Time Agent Activity", description: "Build Agent Execution Channel (AEC) streaming: server-sent events for real-time agent status, parallel agent activity display in UI, stream multiplexing for simultaneous agent outputs." },
      { title: "Build Shared Memory Buffer for Multi-Agent Sessions", description: "Implement a shared memory buffer scoped to a multi-agent session: write/read API, conflict resolution via last-write-wins with timestamp, expiry after session completion.", depends_on: ["rm-multi_ai_chat-implement-aec-streams-real-time-agent-activity-16"] },
      { title: "Implement Thread Fork and Merge Logic", description: "Enable branching conversation threads: fork a thread from any message, run parallel exploration, merge results back to main thread with diff view and user-controlled resolution." },
      { title: "Build AI-to-AI Messaging Channel", description: "Create a structured AI-to-AI messaging protocol: message schema with sender/recipient/task context, routing layer, and logging to roadmap_costs for cost attribution per agent.", depends_on: ["rm-multi_ai_chat-build-shared-memory-buffer-for-multi-agent-sessions-17"] },
      { title: "Implement Safe Parallel Execution Engine", description: "Build parallel task execution with safety isolation: execution sandboxing, resource limits per parallel branch, deadlock detection, and automatic abort on cost threshold breach.", depends_on: ["rm-multi_ai_chat-build-ai-to-ai-messaging-channel-19"] },
    ],
  },
  {
    phase: "payments",
    tasks: [
      { title: "Complete CreditsOS Global Billing Currency Layer", description: "Implement the full CreditsOS specification: dollar-to-credit mapping table, credit purchase flow Stripe plus PayPal, usage deduction per AI action, low-balance alerts, and admin credit grant endpoint." },
      { title: "Build Subscription Tier Management", description: "Implement subscription tier CRUD: free/starter/pro/enterprise plan definitions, plan enforcement middleware, upgrade/downgrade flow, proration calculation, and Stripe webhook handlers for lifecycle events.", depends_on: ["rm-payments-complete-creditos-global-billing-currency-layer-21"] },
      { title: "Build Team Accounts and Multi-Seat Billing", description: "Add team account support: organization creation, seat-based pricing, member invite flow, shared credit pool, team admin controls, and per-seat usage reporting.", depends_on: ["rm-payments-build-subscription-tier-management-22"] },
      { title: "Implement Enterprise SSO and SCIM Provisioning", description: "Add enterprise identity integration: SAML 2.0 and OIDC SSO, SCIM user provisioning from enterprise IdP, just-in-time account creation, and enterprise admin console for seat management.", depends_on: ["rm-payments-build-team-accounts-and-multi-seat-billing-23"] },
    ],
  },
  {
    phase: "creator_tools",
    tasks: [
      { title: "Build CreatorOS Unified Dashboard", description: "Build the primary CreatorOS interface: project workspace list, asset pipeline view, recent activity feed, quick-create actions, and navigation to all creator sub-systems." },
      { title: "Build Asset Pipeline Upload Process Version", description: "Implement creator asset pipeline: multi-format upload images/video/audio/documents, AI processing queue, versioning with diff view, and R2 storage with CDN delivery.", depends_on: ["rm-creator_tools-build-creatos-unified-dashboard-25"] },
      { title: "Build Marketplace Publishing Flow", description: "Enable creators to publish to MarketplaceOS: listing creation with AI-assisted description, pricing tiers, review submission flow, approval workflow, and sales analytics dashboard.", depends_on: ["rm-creator_tools-build-asset-pipeline-upload-process-version-26"] },
      { title: "Build AvatarOS Face and Voice Generation", description: "Implement AvatarOS core: AI face generation with style controls, voice cloning and synthesis, character memory persistence, branding package export PNG/SVG/video loop, and behavioral tuning sliders." },
      { title: "Build StudioOS Video and Audiobook Engine", description: "Build StudioOS production suite: AI video generation with presenter avatars, audiobook narration engine, podcast episode builder, and multi-format exporter MP4/MP3/WAV/PDF.", depends_on: ["rm-creator_tools-build-avatatos-face-and-voice-generation-28"] },
    ],
  },
  {
    phase: "ecosystem_modules",
    tasks: [
      { title: "Build Javari Spirits Recommendation Engine", description: "Implement Javari Spirits full product: ingredient database with legal compliance metadata, taste map attribute model, AI recommendation engine, photo extraction with AI tagging, and marketplace integration." },
      { title: "Build Javari Books Chapter Planner and Export", description: "Implement Javari Books: chapter planner with AI outline generation, voiceover export via StudioOS, PDF and ePub generator, AI cover designer, and marketplace publishing integration." },
      { title: "Build Javari Cards Tarot and Vision System", description: "Build Javari Cards product: tarot system with AI interpretation engine, life maps, vision decks, and daily influence engine that sends personalized agent messages to users." },
      { title: "Build LIFELINE OS Daily Life Planner", description: "Implement LIFELINE OS: 60-second daily life planning interface, streak tracking with accountability system, personal narrative engine, and AI reflection with course-correction recommendations." },
      { title: "Build Market Crawler Competitive Intelligence Engine", description: "Build the Market Crawler: automated competitor crawling pipeline, pricing intelligence extraction, feature diff engine, opportunity detection algorithm, and trend ingestion from RSS and social feeds." },
      { title: "Build PitchCraft Investor Pitch Generator", description: "Implement PitchCraft: AI investor pitch generator with CR AudioViz AI narrative, market sizing engine with TAM/SAM/SOM calculators, competitive matrix builder, and PDF/PPTX export." },
      { title: "Build MarketplaceOS Listings Commissions Payouts", description: "Build full MarketplaceOS: item/service/avatar/agent listings, seller onboarding, commission calculation engine, Stripe Connect payout flow, reviews and ratings system, and growth loop analytics." },
    ],
  },
];

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── Ingest canonical roadmap into roadmap_tasks ───────────────────────────
  if (action === "ingest-roadmap") {
    const now = Math.floor(Date.now() / 1000);

    // Build all rows in priority order
    const allRows: Array<{
      id: string; phase_id: string; title: string; description: string;
      depends_on: string[]; status: string; source: string; updated_at: number;
    }> = [];
    let idx = 0;

    for (const phaseSlug of PHASE_ORDER) {
      const phaseDef = ROADMAP.find((p) => p.phase === phaseSlug);
      if (!phaseDef) continue;
      for (const t of phaseDef.tasks) {
        allRows.push({
          id: taskId(phaseSlug, t.title, idx),
          phase_id: phaseSlug,
          title: t.title,
          description: t.description,
          depends_on: t.depends_on ?? [],
          status: "pending",
          source: "roadmap",
          updated_at: now,
        });
        idx++;
      }
    }

    // Fetch existing roadmap titles for dedup
    const { data: existing, error: fetchErr } = await supabase
      .from("roadmap_tasks")
      .select("title")
      .eq("source", "roadmap");

    if (fetchErr) {
      return NextResponse.json({ ok: false, error: `Fetch failed: ${fetchErr.message}` });
    }

    const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
    const toInsert = allRows.filter((r) => !existingTitles.has(r.title));
    const skipped  = allRows.length - toInsert.length;

    const inserted: string[] = [];
    const failed: string[]   = [];

    for (const row of toInsert) {
      const { error: insertErr } = await supabase.from("roadmap_tasks").insert(row);
      if (insertErr) {
        if (insertErr.message.includes("duplicate key") || insertErr.code === "23505") {
          // race — treat as skip
        } else {
          failed.push(`${row.id}: ${insertErr.message}`);
        }
      } else {
        inserted.push(row.id);
        console.log(`[ingest-roadmap] INSERT [${row.phase_id}] ${row.title}`);
      }
    }

    const phases = [...new Set(allRows.map((r) => r.phase_id))];
    console.log(`[ingest-roadmap] phases=${phases.length} inserted=${inserted.length} skipped=${skipped} failed=${failed.length}`);

    return NextResponse.json({
      ok: failed.length === 0,
      summary: {
        phases_detected: phases.length,
        phases,
        tasks_prepared: allRows.length,
        inserted: inserted.length,
        skipped,
        failed: failed.length,
      },
      inserted,
      errors: failed,
    });
  }

  // ── Seed a test roadmap task ───────────────────────────────────────────────
  if (action === "seed-roadmap-test") {
    const now = Math.floor(Date.now() / 1000);
    const { error } = await supabase
      .from("roadmap_tasks")
      .upsert({
        id: "roadmap-test-seed-001",
        phase_id: "planner",
        title: "Seed test: Human-authored roadmap task",
        description: "This task was seeded to verify the hybrid planner roadmap path works correctly.",
        depends_on: [],
        source: "roadmap",
        status: "pending",
        updated_at: now,
      }, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }
    return NextResponse.json({ ok: true, seeded: "roadmap-test-seed-001" });
  }

  // ── Mark roadmap test task complete (cleanup) ─────────────────────────────
  if (action === "cleanup-roadmap-test") {
    const { error } = await supabase
      .from("roadmap_tasks")
      .update({ status: "completed" })
      .eq("id", "roadmap-test-seed-001");

    return NextResponse.json({ ok: !error, error: error?.message });
  }

  // ── Default: apply DDL ─────────────────────────────────────────────────────
  const steps: Array<{ sql: string; ok: boolean; error?: string }> = [];
  const ddl = [
    "ALTER TABLE roadmap_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_source ON roadmap_tasks (source) WHERE source IS NOT NULL",
  ];

  for (const sql of ddl) {
    const { error } = await supabase.rpc("exec_sql", { sql }) as { error: { message: string } | null };
    steps.push({ sql: sql.slice(0, 80), ok: !error, error: error?.message });
  }

  const { error: verifyErr } = await supabase
    .from("roadmap_tasks")
    .select("source")
    .limit(1);

  return NextResponse.json({
    ok: !verifyErr,
    column_accessible: !verifyErr,
    verify_error: verifyErr?.message ?? null,
    steps,
  });

  // ── Create guardrail_audit_log table ─────────────────────────────────────
  if (action === "create-guardrail-table") {
    const steps: string[] = [];
    const errs: string[] = [];

    // guardrail_audit_log — one row per guardrail check per task execution
    const ddl = `
      CREATE TABLE IF NOT EXISTS guardrail_audit_log (
        id            BIGSERIAL PRIMARY KEY,
        execution_id  TEXT        NOT NULL,
        task_id       TEXT        NOT NULL,
        guardrail_check TEXT      NOT NULL,
        outcome       TEXT        NOT NULL CHECK (outcome IN ('pass','block','rollback')),
        reason        TEXT        NOT NULL,
        meta          JSONB       NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_task_id
        ON guardrail_audit_log (task_id);
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_execution_id
        ON guardrail_audit_log (execution_id);
      CREATE INDEX IF NOT EXISTS idx_guardrail_audit_outcome
        ON guardrail_audit_log (outcome);
    `;

    // Execute via rpc exec_sql if available, else insert a no-op row to verify connectivity
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: ddl });
      if (error) {
        // exec_sql may not exist — try raw insert to detect table existence
        const { error: checkErr } = await supabase
          .from("guardrail_audit_log")
          .select("id")
          .limit(1);
        if (checkErr && checkErr.message.includes("does not exist")) {
          errs.push(`Table does not exist and exec_sql unavailable: ${error.message}`);
          steps.push("MANUAL ACTION REQUIRED: run CREATE TABLE guardrail_audit_log via Supabase SQL editor");
        } else {
          steps.push("Table already exists or is accessible");
        }
      } else {
        steps.push("guardrail_audit_log table created via exec_sql");
      }
    } catch (e: unknown) {
      // Try select to check if table exists already
      const { error: checkErr } = await supabase
        .from("guardrail_audit_log")
        .select("id")
        .limit(1);
      if (!checkErr) {
        steps.push("Table already exists — connectivity confirmed");
      } else {
        errs.push(`DDL failed: ${(e as Error).message}`);
        steps.push("MANUAL ACTION REQUIRED: see report");
      }
    }

    return NextResponse.json({ ok: errs.length === 0, steps, errors: errs });
  }

}
