// app/api/javari/ingest-phase2/route.ts
// Purpose: One-shot server-side execution of CRAV_PHASE_2 roadmap task ingestion.
//          POST → runs full ingest, returns summary + verification query results.
//          DELETE to self after confirmation (admin only — use once).
// Date: 2026-03-10

import { NextResponse }   from "next/server";
import { createClient }   from "@supabase/supabase-js";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoadmapRow {
  id:          string;
  roadmap_id:  string | null;
  phase_id:    string;
  title:       string;
  description: string;
  depends_on:  string[];
  status:      "pending";
  source:      "roadmap";
  updated_at:  number;
}

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
  return `p2-${phase}-${slugify(title)}-${String(index).padStart(2, "0")}`;
}

// ─── CRAV_PHASE_2 Task Definitions (inline — mirrors scripts/ingest-phase2.ts) ──
const ROADMAP_ID    = "CRAV_PHASE_2";
const ROADMAP_TITLE = "CR AudioViz AI — Phase 2: Marketplace, Monetization & CRAIverse";

const PHASE_ORDER = [
  "ai_marketplace", "creator_monetization", "multi_ai_team_mode",
  "autonomous_deployment", "craiverse_modules", "community_systems",
  "enterprise_integrations",
];

const PHASE_2_ROADMAP: Array<{
  phase: string;
  tasks: Array<{ title: string; description: string; depends_on?: string[] }>;
}> = [
  {
    phase: "ai_marketplace",
    tasks: [
      { title: "Build AI Marketplace Storefront", description: "Implement the public-facing AI Marketplace: browsable catalog of AI models, agents, prompt packs, and automation workflows. Include category filters, search, featured listings, and preview-before-purchase flow." },
      { title: "Build Marketplace Listing Creation Flow", description: "Enable sellers to create Marketplace listings: structured form for title, description, pricing, demo video, tags, and license type. AI-assisted description generator. Submit for review flow with status tracking." },
      { title: "Implement Marketplace Review and Approval Workflow", description: "Build the admin review pipeline for Marketplace submissions: review queue, approve/reject actions, automated quality checks (content policy, pricing validation), and seller notification on status change.", depends_on: ["p2-ai_marketplace-build-marketplace-listing-creation-flow-01"] },
      { title: "Build AI Model Comparison Engine", description: "Implement side-by-side AI model comparison: run identical test prompts across selected models, display cost, latency, and quality scores, and generate a recommendation report for the user's use case." },
      { title: "Build Marketplace Revenue Split Engine", description: "Implement commission calculation and revenue distribution: configurable platform split (default 20%), seller payout calculation, Stripe Connect disbursement scheduling, and per-listing revenue analytics.", depends_on: ["p2-ai_marketplace-build-marketplace-listing-creation-flow-01"] },
      { title: "Build Marketplace Search and Discovery Layer", description: "Implement semantic search across Marketplace listings: vector embeddings on listing descriptions, cosine similarity retrieval, trending algorithm based on sales velocity, and personalized recommendations via user history." },
    ],
  },
  {
    phase: "creator_monetization",
    tasks: [
      { title: "Build Creator Earnings Dashboard", description: "Implement the Creator Earnings Dashboard: real-time revenue by product/listing, lifetime earnings, payout history, pending balance, tax document generation (1099-K), and earnings forecast based on trends." },
      { title: "Implement Stripe Connect Onboarding for Creators", description: "Build Stripe Connect Express onboarding flow: identity verification, bank account linking, payout schedule configuration (daily/weekly/monthly), and compliance checks. Handle restricted account states gracefully." },
      { title: "Build Subscription Product Builder", description: "Enable creators to build their own subscription products: recurring billing tiers, subscriber management dashboard, content access gating by tier, trial period configuration, and cancellation handling.", depends_on: ["p2-creator_monetization-implement-stripe-connect-onboarding-for-creat-01"] },
      { title: "Build Tip and Donation Flow", description: "Implement one-click tipping and donation on creator profiles and content pages: custom tip amounts, recurring donation option, thank-you automation, and donor leaderboard with privacy controls." },
      { title: "Build Creator Analytics — Revenue Attribution", description: "Implement revenue attribution analytics: track which content, listing, or referral source drove each purchase. Build attribution model (first-touch / last-touch), funnel visualization, and conversion rate by channel." },
      { title: "Build Affiliate Program Engine for Creators", description: "Build creator affiliate program: unique referral link generator, commission tracking per referral conversion, real-time affiliate dashboard, payout calculation, and fraud detection via IP and device fingerprinting." },
    ],
  },
  {
    phase: "multi_ai_team_mode",
    tasks: [
      { title: "Build Team Mode Session Orchestrator", description: "Implement the Team Mode session orchestrator: session initialization with agent roster, role assignment (Planner / Builder / Reviewer / Documenter), task distribution algorithm, and session lifecycle management (start, pause, terminate)." },
      { title: "Build Agent Role Specialization System", description: "Implement specialized agent roles in Team Mode: unique system prompts per role, role-specific tool access permissions, inter-role handoff protocol, and role performance scoring for adaptive assignment.", depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"] },
      { title: "Build Real-Time Team Mode UI", description: "Build the Team Mode interface: agent swimlanes showing real-time output per agent, shared context panel, user steering controls (redirect agent, inject context, override decision), and session cost tracker.", depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"] },
      { title: "Build Team Mode Artifact Aggregator", description: "Implement artifact aggregation across Team Mode agents: collect outputs from all agents per session, deduplicate and merge, generate unified artifact with agent attribution, and store to R2 with session metadata.", depends_on: ["p2-multi_ai_team_mode-build-agent-role-specialization-system-01"] },
      { title: "Implement Team Mode Cost Allocation", description: "Build per-agent cost accounting in Team Mode: track tokens and cost by agent role per session, apply cost ceiling enforcement per-agent and per-session, generate itemized cost report at session close.", depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"] },
      { title: "Build Team Mode Replay and Audit Log", description: "Implement session replay for Team Mode: store full message trace with timestamps per agent, replay interface with scrubbing, exportable audit log (JSON/PDF), and compliance annotation tools.", depends_on: ["p2-multi_ai_team_mode-build-team-mode-artifact-aggregator-03"] },
    ],
  },
  {
    phase: "autonomous_deployment",
    tasks: [
      { title: "Build Autonomous GitHub Push Pipeline", description: "Implement Javari's autonomous code deployment pipeline: generate code artifact, create feature branch, commit with structured message, open PR with test results attached, and auto-merge on green CI. Full audit trail to roadmap_tasks." },
      { title: "Build Vercel Preview Deployment Validator", description: "Implement automated Vercel preview validation: trigger preview deploy after each autonomous commit, scrape preview URL for HTTP 200, run Lighthouse performance check, capture screenshot, and store results as task artifact.", depends_on: ["p2-autonomous_deployment-build-autonomous-github-push-pipeline-00"] },
      { title: "Build Autonomous Supabase Migration Runner", description: "Enable Javari to autonomously run Supabase migrations: generate migration SQL, validate against schema diff, execute via Supabase Management API, verify success, and roll back on failure. Log to javari_execution_logs." },
      { title: "Build Self-Healing Deployment Monitor", description: "Implement continuous deployment health monitoring: watch Vercel deployment state, detect build failures, automatically retry or roll back to last good deployment, and send alert to NotificationOS on repeated failure.", depends_on: ["p2-autonomous_deployment-build-vercel-preview-deployment-validator-01"] },
      { title: "Build Autonomous Environment Variable Manager", description: "Implement autonomous env var management: read secrets from Platform Secret Authority, sync to Vercel project environment via API, detect missing variables before deployment, and trigger re-seed if vault key is missing." },
      { title: "Build Deployment Cost Tracker", description: "Track compute costs for autonomous deployments: log Vercel build minutes, serverless function invocations, R2 bandwidth, and Supabase query counts per autonomous cycle. Surface in the Command Center dashboard." },
    ],
  },
  {
    phase: "craiverse_modules",
    tasks: [
      { title: "Build CRAIverse World Engine Foundation", description: "Implement the CRAIverse World Engine core: geographic zone registry (US cities, zip codes), zone-to-business mapping data model, world state persistence in Supabase, and REST API for zone queries and avatar placement." },
      { title: "Build Avatar Creation and Customization System", description: "Build the CRAIverse avatar system: AI face generation via AvatarOS, body style selector, outfit customization, avatar metadata storage, and avatar-to-user binding. Export avatar as PNG and animated GIF loop.", depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"] },
      { title: "Build CRAIverse Virtual Real Estate System", description: "Implement virtual real estate: geographic zone parcels purchasable with credits, parcel ownership registry, business storefront builder on owned parcel, foot traffic analytics, and zone leaderboard by activity.", depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"] },
      { title: "Build Social Impact Module Registry", description: "Implement the 20 Social Impact Module registry in CRAIverse: module definitions for veterans, first responders, faith communities, animal rescues, and underserved populations. Module activation flow, content routing, and grant eligibility tagging." },
      { title: "Build CRAIverse Discovery Feed", description: "Implement the CRAIverse social discovery feed: zone-based activity stream, trending avatars and storefronts, community event announcements, AI-curated highlights, and real-time update push via Supabase Realtime.", depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"] },
      { title: "Build CRAIverse Mobile-Ready Interface", description: "Build the CRAIverse mobile-first UI: responsive zone map with pinch-zoom, avatar quick-actions, storefront browsing with swipe navigation, push notification integration, and offline-first state caching.", depends_on: ["p2-craiverse_modules-build-craiverse-discovery-feed-04"] },
    ],
  },
  {
    phase: "community_systems",
    tasks: [
      { title: "Build Community Hub — Groups and Channels", description: "Implement Community Hub: group creation with avatar, topic-based channels within groups, member roles (owner/moderator/member), invite links, join requests, and content moderation queue with AI-assisted flagging." },
      { title: "Build Real-Time Community Chat", description: "Implement real-time community chat: Supabase Realtime-backed message delivery, threaded replies, emoji reactions, file and image sharing, message pinning, and AI-powered conversation summarization.", depends_on: ["p2-community_systems-build-community-hub--groups-and-channels-00"] },
      { title: "Build Community Events System", description: "Build community events: event creation with date/time/zone, RSVP flow, calendar integration (iCal export), virtual event room with live AI moderation assistant, post-event recording and summary generation." },
      { title: "Build Reputation and Badge System", description: "Implement community reputation: points earned per action (post, help, purchase, referral), badge taxonomy (contributor, mentor, veteran, founder), leaderboard per community, and badge display on profile and avatar." },
      { title: "Build Community AI Moderator", description: "Deploy an AI moderation layer for community content: real-time content policy evaluation, confidence-scored flagging, human review queue for edge cases, appeal flow, and moderation action logging for compliance.", depends_on: ["p2-community_systems-build-real-time-community-chat-01"] },
      { title: "Build Peer-to-Peer Knowledge Exchange", description: "Build the Knowledge Exchange: structured Q&A with verified answers, skill-based expert matching, session booking with credits as payment, rating system post-session, and knowledge article archiving to vector memory." },
    ],
  },
  {
    phase: "enterprise_integrations",
    tasks: [
      { title: "Build White-Label Platform Packager", description: "Implement white-label packaging: custom domain support via Vercel edge config, brand token override system per tenant, logo/color/font injection at build time, and tenant isolation via Supabase RLS policies scoped to org_id." },
      { title: "Build Enterprise API Gateway", description: "Build the Enterprise API Gateway: API key issuance and rotation, per-key rate limiting, usage metering with credit deduction, endpoint-level access control, and developer portal with interactive API explorer." },
      { title: "Build Webhook Delivery Engine", description: "Implement outbound webhook delivery: event subscription management, signed payload delivery (HMAC-SHA256), retry with exponential backoff on failure, delivery log with resend capability, and latency SLA monitoring.", depends_on: ["p2-enterprise_integrations-build-enterprise-api-gateway-01"] },
      { title: "Build Enterprise SSO — SAML and OIDC", description: "Implement enterprise SSO: SAML 2.0 IdP integration (Okta, Azure AD, Google Workspace), OIDC flow with just-in-time provisioning, role mapping from IdP groups to platform roles, and SSO session management." },
      { title: "Build Enterprise Usage and Billing Console", description: "Build the enterprise admin billing console: seat count management, monthly usage report (API calls, AI tokens, storage), invoice generation, custom contract pricing override, and budget alert configuration.", depends_on: ["p2-enterprise_integrations-build-enterprise-api-gateway-01"] },
      { title: "Build Enterprise Data Residency Controls", description: "Implement enterprise data residency: configurable storage region selection (US/EU), data isolation enforcement per tenant in R2 and Supabase, GDPR deletion workflow, data export package generator, and audit trail for all data access." },
    ],
  },
];

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(): Promise<NextResponse> {
  const log: string[] = [];
  const emit = (msg: string) => { log.push(msg); console.log(msg); };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );

  emit("════ CRAV_PHASE_2 Ingestion ════");
  const now = Math.floor(Date.now() / 1000);

  // 1. Roadmap parent row
  // roadmap_id is nullable on roadmap_tasks — tasks can be inserted without it.
  // The roadmaps table requires a separate GRANT in Supabase before FK writes work.
  // Tasks are tagged source="roadmap" and phase_id for full orchestrator compatibility.
  // Run supabase/migrations/20260310_grant_roadmaps_table.sql to enable FK binding later.
  emit(`⏭ Skipping roadmaps FK upsert — roadmap_id nullable, inserting tasks directly`);

  // 2. Build rows
  const allRows: RoadmapRow[] = [];
  let taskIndex = 0;
  for (const phaseSlug of PHASE_ORDER) {
    const defs = PHASE_2_ROADMAP.filter(p => p.phase === phaseSlug);
    for (const def of defs) {
      for (const t of def.tasks) {
        allRows.push({
          id:          taskId(phaseSlug, t.title, taskIndex++),
          roadmap_id:  null,   // FK skipped until migration grants roadmaps table
          phase_id:    phaseSlug,
          title:       t.title,
          description: t.description,
          depends_on:  t.depends_on ?? [],
          status:      "pending",
          source:      "roadmap",
          updated_at:  now,
        });
      }
    }
  }
  emit(`Prepared ${allRows.length} tasks across ${PHASE_ORDER.length} phases`);

  // 3. Fetch all existing titles (any source)
  const { data: existing, error: fetchErr } = await db
    .from("roadmap_tasks")
    .select("title");

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: `title fetch: ${fetchErr.message}`, log }, { status: 500 });
  }

  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  emit(`Existing tasks in DB: ${existingTitles.size}`);

  // 4. Insert, skip duplicates
  let inserted = 0, skipped = 0;
  const failed: string[] = [];

  for (const row of allRows) {
    if (existingTitles.has(row.title)) {
      emit(`⏭ SKIP  [${row.phase_id}] ${row.title}`);
      skipped++;
      continue;
    }
    const { error: insertErr } = await db.from("roadmap_tasks").insert(row);
    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message.includes("duplicate key")) {
        emit(`⏭ SKIP  (PK) [${row.phase_id}] ${row.title}`);
        skipped++;
      } else {
        emit(`❌ FAIL [${row.phase_id}] ${row.title} — ${insertErr.message}`);
        failed.push(row.title);
      }
    } else {
      emit(`✅ INSERT [${row.phase_id}] ${row.title}`);
      inserted++;
    }
  }

  if (failed.length > 0) {
    return NextResponse.json({ ok: false, inserted, skipped, failed, log }, { status: 500 });
  }

  // 5. Verification: SELECT status, COUNT(*) FROM roadmap_tasks GROUP BY status
  const { data: statusRows, error: verifyErr } = await db
    .from("roadmap_tasks")
    .select("status");

  const byStatus: Record<string, number> = {};
  for (const r of (statusRows ?? []) as { status: string }[]) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  emit("─── SELECT status, COUNT(*) FROM roadmap_tasks GROUP BY status ───");
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    emit(`  ${status.padEnd(20)} ${count}`);
  }
  emit(`  ${"TOTAL".padEnd(20)} ${total}`);

  return NextResponse.json({
    ok:        true,
    roadmap_id: ROADMAP_ID,
    inserted,
    skipped,
    failed:    0,
    verification: { byStatus, total, verifyError: verifyErr?.message ?? null },
    log,
  });
}
