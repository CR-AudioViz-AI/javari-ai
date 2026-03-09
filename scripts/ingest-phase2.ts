// scripts/ingest-phase2.ts
// Purpose: Ingest CR AudioViz AI — CRAV_PHASE_2 roadmap tasks into roadmap_tasks table
// Roadmap ID: CRAV_PHASE_2
// Categories: AI Marketplace · Creator Monetization · Multi-AI Team Mode ·
//             Autonomous Deployment · CRAIverse Modules · Community Systems ·
//             Enterprise Integrations
// Date: 2026-03-10
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/ingest-phase2.ts
//
// Safety: Skips any task whose title already exists in roadmap_tasks (any source).
//         Existing completed tasks are never touched.

import { createClient } from "@supabase/supabase-js";

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[ingest-phase2] FATAL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("  Set them in .env.local or export before running.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoadmapRow {
  id:          string;
  roadmap_id:  string;
  phase_id:    string;
  title:       string;
  description: string;
  depends_on:  string[];
  status:      "pending";
  source:      "roadmap";
  updated_at:  number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROADMAP_ID = "CRAV_PHASE_2";
const ROADMAP_TITLE = "CR AudioViz AI — Phase 2: Marketplace, Monetization & CRAIverse";

// Phase execution order
const PHASE_ORDER = [
  "ai_marketplace",
  "creator_monetization",
  "multi_ai_team_mode",
  "autonomous_deployment",
  "craiverse_modules",
  "community_systems",
  "enterprise_integrations",
];

// ─── ID helpers (mirrors ingest-roadmap.ts exactly) ───────────────────────────
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

// ─── CRAV_PHASE_2 Task Definitions ────────────────────────────────────────────
const PHASE_2_ROADMAP: Array<{
  phase: string;
  label: string;
  tasks: Array<{ title: string; description: string; depends_on?: string[] }>;
}> = [

  // ── AI Marketplace ────────────────────────────────────────────────────────
  {
    phase: "ai_marketplace",
    label: "AI Marketplace — Model & Agent Trading",
    tasks: [
      {
        title: "Build AI Marketplace Storefront",
        description: "Implement the public-facing AI Marketplace: browsable catalog of AI models, agents, prompt packs, and automation workflows. Include category filters, search, featured listings, and preview-before-purchase flow.",
      },
      {
        title: "Build Marketplace Listing Creation Flow",
        description: "Enable sellers to create Marketplace listings: structured form for title, description, pricing, demo video, tags, and license type. AI-assisted description generator. Submit for review flow with status tracking.",
      },
      {
        title: "Implement Marketplace Review and Approval Workflow",
        description: "Build the admin review pipeline for Marketplace submissions: review queue, approve/reject actions, automated quality checks (content policy, pricing validation), and seller notification on status change.",
        depends_on: ["p2-ai_marketplace-build-marketplace-listing-creation-flow-01"],
      },
      {
        title: "Build AI Model Comparison Engine",
        description: "Implement side-by-side AI model comparison: run identical test prompts across selected models, display cost, latency, and quality scores, and generate a recommendation report for the user's use case.",
      },
      {
        title: "Build Marketplace Revenue Split Engine",
        description: "Implement commission calculation and revenue distribution: configurable platform split (default 20%), seller payout calculation, Stripe Connect disbursement scheduling, and per-listing revenue analytics.",
        depends_on: ["p2-ai_marketplace-build-marketplace-listing-creation-flow-01"],
      },
      {
        title: "Build Marketplace Search and Discovery Layer",
        description: "Implement semantic search across Marketplace listings: vector embeddings on listing descriptions, cosine similarity retrieval, trending algorithm based on sales velocity, and personalized recommendations via user history.",
      },
    ],
  },

  // ── Creator Monetization ─────────────────────────────────────────────────
  {
    phase: "creator_monetization",
    label: "Creator Monetization — Revenue Infrastructure",
    tasks: [
      {
        title: "Build Creator Earnings Dashboard",
        description: "Implement the Creator Earnings Dashboard: real-time revenue by product/listing, lifetime earnings, payout history, pending balance, tax document generation (1099-K), and earnings forecast based on trends.",
      },
      {
        title: "Implement Stripe Connect Onboarding for Creators",
        description: "Build Stripe Connect Express onboarding flow: identity verification, bank account linking, payout schedule configuration (daily/weekly/monthly), and compliance checks. Handle restricted account states gracefully.",
      },
      {
        title: "Build Subscription Product Builder",
        description: "Enable creators to build their own subscription products: recurring billing tiers, subscriber management dashboard, content access gating by tier, trial period configuration, and cancellation handling.",
        depends_on: ["p2-creator_monetization-implement-stripe-connect-onboarding-for-creat-01"],
      },
      {
        title: "Build Tip and Donation Flow",
        description: "Implement one-click tipping and donation on creator profiles and content pages: custom tip amounts, recurring donation option, thank-you automation, and donor leaderboard with privacy controls.",
      },
      {
        title: "Build Creator Analytics — Revenue Attribution",
        description: "Implement revenue attribution analytics: track which content, listing, or referral source drove each purchase. Build attribution model (first-touch / last-touch), funnel visualization, and conversion rate by channel.",
      },
      {
        title: "Build Affiliate Program Engine for Creators",
        description: "Build creator affiliate program: unique referral link generator, commission tracking per referral conversion, real-time affiliate dashboard, payout calculation, and fraud detection via IP and device fingerprinting.",
      },
    ],
  },

  // ── Multi-AI Team Mode ────────────────────────────────────────────────────
  {
    phase: "multi_ai_team_mode",
    label: "Multi-AI Team Mode — Collaborative Agent Workflows",
    tasks: [
      {
        title: "Build Team Mode Session Orchestrator",
        description: "Implement the Team Mode session orchestrator: session initialization with agent roster, role assignment (Planner / Builder / Reviewer / Documenter), task distribution algorithm, and session lifecycle management (start, pause, terminate).",
      },
      {
        title: "Build Agent Role Specialization System",
        description: "Implement specialized agent roles in Team Mode: unique system prompts per role, role-specific tool access permissions, inter-role handoff protocol, and role performance scoring for adaptive assignment.",
        depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"],
      },
      {
        title: "Build Real-Time Team Mode UI",
        description: "Build the Team Mode interface: agent swimlanes showing real-time output per agent, shared context panel, user steering controls (redirect agent, inject context, override decision), and session cost tracker.",
        depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"],
      },
      {
        title: "Build Team Mode Artifact Aggregator",
        description: "Implement artifact aggregation across Team Mode agents: collect outputs from all agents per session, deduplicate and merge, generate unified artifact with agent attribution, and store to R2 with session metadata.",
        depends_on: ["p2-multi_ai_team_mode-build-agent-role-specialization-system-01"],
      },
      {
        title: "Implement Team Mode Cost Allocation",
        description: "Build per-agent cost accounting in Team Mode: track tokens and cost by agent role per session, apply cost ceiling enforcement per-agent and per-session, generate itemized cost report at session close.",
        depends_on: ["p2-multi_ai_team_mode-build-team-mode-session-orchestrator-00"],
      },
      {
        title: "Build Team Mode Replay and Audit Log",
        description: "Implement session replay for Team Mode: store full message trace with timestamps per agent, replay interface with scrubbing, exportable audit log (JSON/PDF), and compliance annotation tools.",
        depends_on: ["p2-multi_ai_team_mode-build-team-mode-artifact-aggregator-03"],
      },
    ],
  },

  // ── Autonomous Deployment ─────────────────────────────────────────────────
  {
    phase: "autonomous_deployment",
    label: "Autonomous Deployment — Self-Deploying Platform",
    tasks: [
      {
        title: "Build Autonomous GitHub Push Pipeline",
        description: "Implement Javari's autonomous code deployment pipeline: generate code artifact, create feature branch, commit with structured message, open PR with test results attached, and auto-merge on green CI. Full audit trail to roadmap_tasks.",
      },
      {
        title: "Build Vercel Preview Deployment Validator",
        description: "Implement automated Vercel preview validation: trigger preview deploy after each autonomous commit, scrape preview URL for HTTP 200, run Lighthouse performance check, capture screenshot, and store results as task artifact.",
        depends_on: ["p2-autonomous_deployment-build-autonomous-github-push-pipeline-00"],
      },
      {
        title: "Build Autonomous Supabase Migration Runner",
        description: "Enable Javari to autonomously run Supabase migrations: generate migration SQL, validate against schema diff, execute via Supabase Management API, verify success, and roll back on failure. Log to javari_execution_logs.",
      },
      {
        title: "Build Self-Healing Deployment Monitor",
        description: "Implement continuous deployment health monitoring: watch Vercel deployment state, detect build failures, automatically retry or roll back to last good deployment, and send alert to NotificationOS on repeated failure.",
        depends_on: ["p2-autonomous_deployment-build-vercel-preview-deployment-validator-01"],
      },
      {
        title: "Build Autonomous Environment Variable Manager",
        description: "Implement autonomous env var management: read secrets from Platform Secret Authority, sync to Vercel project environment via API, detect missing variables before deployment, and trigger re-seed if vault key is missing.",
      },
      {
        title: "Build Deployment Cost Tracker",
        description: "Track compute costs for autonomous deployments: log Vercel build minutes, serverless function invocations, R2 bandwidth, and Supabase query counts per autonomous cycle. Surface in the Command Center dashboard.",
      },
    ],
  },

  // ── CRAIverse Modules ─────────────────────────────────────────────────────
  {
    phase: "craiverse_modules",
    label: "CRAIverse — Virtual World Infrastructure",
    tasks: [
      {
        title: "Build CRAIverse World Engine Foundation",
        description: "Implement the CRAIverse World Engine core: geographic zone registry (US cities, zip codes), zone-to-business mapping data model, world state persistence in Supabase, and REST API for zone queries and avatar placement.",
      },
      {
        title: "Build Avatar Creation and Customization System",
        description: "Build the CRAIverse avatar system: AI face generation via AvatarOS, body style selector, outfit customization, avatar metadata storage, and avatar-to-user binding. Export avatar as PNG and animated GIF loop.",
        depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"],
      },
      {
        title: "Build CRAIverse Virtual Real Estate System",
        description: "Implement virtual real estate: geographic zone parcels purchasable with credits, parcel ownership registry, business storefront builder on owned parcel, foot traffic analytics, and zone leaderboard by activity.",
        depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"],
      },
      {
        title: "Build Social Impact Module Registry",
        description: "Implement the 20 Social Impact Module registry in CRAIverse: module definitions for veterans, first responders, faith communities, animal rescues, and underserved populations. Module activation flow, content routing, and grant eligibility tagging.",
      },
      {
        title: "Build CRAIverse Discovery Feed",
        description: "Implement the CRAIverse social discovery feed: zone-based activity stream, trending avatars and storefronts, community event announcements, AI-curated highlights, and real-time update push via Supabase Realtime.",
        depends_on: ["p2-craiverse_modules-build-craiverse-world-engine-foundation-00"],
      },
      {
        title: "Build CRAIverse Mobile-Ready Interface",
        description: "Build the CRAIverse mobile-first UI: responsive zone map with pinch-zoom, avatar quick-actions, storefront browsing with swipe navigation, push notification integration, and offline-first state caching.",
        depends_on: ["p2-craiverse_modules-build-craiverse-discovery-feed-04"],
      },
    ],
  },

  // ── Community Systems ─────────────────────────────────────────────────────
  {
    phase: "community_systems",
    label: "Community Systems — Connection and Engagement",
    tasks: [
      {
        title: "Build Community Hub — Groups and Channels",
        description: "Implement Community Hub: group creation with avatar, topic-based channels within groups, member roles (owner/moderator/member), invite links, join requests, and content moderation queue with AI-assisted flagging.",
      },
      {
        title: "Build Real-Time Community Chat",
        description: "Implement real-time community chat: Supabase Realtime-backed message delivery, threaded replies, emoji reactions, file and image sharing, message pinning, and AI-powered conversation summarization.",
        depends_on: ["p2-community_systems-build-community-hub--groups-and-channels-00"],
      },
      {
        title: "Build Community Events System",
        description: "Build community events: event creation with date/time/zone, RSVP flow, calendar integration (iCal export), virtual event room with live AI moderation assistant, post-event recording and summary generation.",
      },
      {
        title: "Build Reputation and Badge System",
        description: "Implement community reputation: points earned per action (post, help, purchase, referral), badge taxonomy (contributor, mentor, veteran, founder), leaderboard per community, and badge display on profile and avatar.",
      },
      {
        title: "Build Community AI Moderator",
        description: "Deploy an AI moderation layer for community content: real-time content policy evaluation, confidence-scored flagging, human review queue for edge cases, appeal flow, and moderation action logging for compliance.",
        depends_on: ["p2-community_systems-build-real-time-community-chat-01"],
      },
      {
        title: "Build Peer-to-Peer Knowledge Exchange",
        description: "Build the Knowledge Exchange: structured Q&A with verified answers, skill-based expert matching, session booking with credits as payment, rating system post-session, and knowledge article archiving to vector memory.",
      },
    ],
  },

  // ── Enterprise Integrations ───────────────────────────────────────────────
  {
    phase: "enterprise_integrations",
    label: "Enterprise Integrations — White-Label and API",
    tasks: [
      {
        title: "Build White-Label Platform Packager",
        description: "Implement white-label packaging: custom domain support via Vercel edge config, brand token override system per tenant, logo/color/font injection at build time, and tenant isolation via Supabase RLS policies scoped to org_id.",
      },
      {
        title: "Build Enterprise API Gateway",
        description: "Build the Enterprise API Gateway: API key issuance and rotation, per-key rate limiting, usage metering with credit deduction, endpoint-level access control, and developer portal with interactive API explorer.",
      },
      {
        title: "Build Webhook Delivery Engine",
        description: "Implement outbound webhook delivery: event subscription management, signed payload delivery (HMAC-SHA256), retry with exponential backoff on failure, delivery log with resend capability, and latency SLA monitoring.",
        depends_on: ["p2-enterprise_integrations-build-enterprise-api-gateway-01"],
      },
      {
        title: "Build Enterprise SSO — SAML and OIDC",
        description: "Implement enterprise SSO: SAML 2.0 IdP integration (Okta, Azure AD, Google Workspace), OIDC flow with just-in-time provisioning, role mapping from IdP groups to platform roles, and SSO session management.",
      },
      {
        title: "Build Enterprise Usage and Billing Console",
        description: "Build the enterprise admin billing console: seat count management, monthly usage report (API calls, AI tokens, storage), invoice generation, custom contract pricing override, and budget alert configuration.",
        depends_on: ["p2-enterprise_integrations-build-enterprise-api-gateway-01"],
      },
      {
        title: "Build Enterprise Data Residency Controls",
        description: "Implement enterprise data residency: configurable storage region selection (US/EU), data isolation enforcement per tenant in R2 and Supabase, GDPR deletion workflow, data export package generator, and audit trail for all data access.",
      },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function ingestPhase2(): Promise<void> {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  CR AudioViz AI — CRAV_PHASE_2 Roadmap Ingestion");
  console.log("════════════════════════════════════════════════════════════\n");

  const now = Math.floor(Date.now() / 1000);

  // ── 1. Upsert the roadmaps parent row ─────────────────────────────────────
  console.log(`[phase2] Upserting roadmap record: ${ROADMAP_ID}`);
  const { error: roadmapErr } = await supabase
    .from("roadmaps")
    .upsert({
      id:         ROADMAP_ID,
      title:      ROADMAP_TITLE,
      created_at: now,
      updated_at: now,
    }, { onConflict: "id" });

  if (roadmapErr) {
    console.error("[phase2] ❌ Failed to upsert roadmap:", roadmapErr.message);
    process.exit(1);
  }
  console.log(`[phase2] ✅ Roadmap record ready: ${ROADMAP_ID}\n`);

  // ── 2. Build all task rows ─────────────────────────────────────────────────
  const allRows: RoadmapRow[] = [];
  let taskIndex = 0;

  for (const phaseSlug of PHASE_ORDER) {
    const phaseDefs = PHASE_2_ROADMAP.filter(p => p.phase === phaseSlug);
    for (const phaseDef of phaseDefs) {
      console.log(`[phase] ${phaseSlug} — ${phaseDef.label} (${phaseDef.tasks.length} tasks)`);
      for (const t of phaseDef.tasks) {
        const id = taskId(phaseSlug, t.title, taskIndex);
        taskIndex++;
        allRows.push({
          id,
          roadmap_id:  ROADMAP_ID,
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

  console.log(`\n[phase2] Total tasks prepared: ${allRows.length}`);
  console.log(`[phase2] Phases: ${PHASE_ORDER.join(" → ")}\n`);

  // ── 3. Fetch ALL existing titles (any source) to prevent any duplicate ─────
  const { data: existing, error: fetchErr } = await supabase
    .from("roadmap_tasks")
    .select("title");

  if (fetchErr) {
    console.error("[phase2] ❌ Failed to fetch existing task titles:", fetchErr.message);
    process.exit(1);
  }

  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  console.log(`[phase2] Existing tasks in DB (all sources): ${existingTitles.size}`);

  // ── 4. Insert new tasks, skip duplicates ──────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  const failed: string[] = [];

  for (const row of allRows) {
    if (existingTitles.has(row.title)) {
      console.log(`  ⏭  SKIP  [${row.phase_id}] ${row.title}`);
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase
      .from("roadmap_tasks")
      .insert(row);

    if (insertErr) {
      if (insertErr.message.includes("duplicate key") || insertErr.code === "23505") {
        console.log(`  ⏭  SKIP  (PK collision) [${row.phase_id}] ${row.title}`);
        skipped++;
      } else {
        console.error(`  ❌ FAIL  [${row.phase_id}] ${row.title} — ${insertErr.message}`);
        failed.push(row.title);
      }
    } else {
      console.log(`  ✅ INSERT [${row.phase_id}] ${row.title}`);
      inserted++;
    }
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  PHASE 2 INGESTION SUMMARY");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Roadmap ID:       ${ROADMAP_ID}`);
  console.log(`  Phases:           ${PHASE_ORDER.length}`);
  console.log(`  Tasks prepared:   ${allRows.length}`);
  console.log(`  ✅ Inserted:       ${inserted}`);
  console.log(`  ⏭  Skipped:        ${skipped}`);
  console.log(`  ❌ Failed:         ${failed.length}`);

  if (failed.length > 0) {
    console.error("\n  Failed tasks:");
    failed.forEach(t => console.error(`    - ${t}`));
    process.exit(1);
  }

  // ── 6. Verification query ──────────────────────────────────────────────────
  console.log("\n[phase2] Running verification query...\n");
  const { data: statusCounts, error: verifyErr } = await supabase
    .from("roadmap_tasks")
    .select("status");

  if (verifyErr) {
    console.error("[phase2] ❌ Verification query failed:", verifyErr.message);
    process.exit(1);
  }

  const byStatus: Record<string, number> = {};
  for (const row of (statusCounts ?? []) as { status: string }[]) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }

  console.log("  SELECT status, COUNT(*) FROM roadmap_tasks GROUP BY status;");
  console.log("  ──────────────────────────────────────────────────────────");
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(16)} ${String(count).padStart(5)}`);
  }
  console.log(`  ${"TOTAL".padEnd(16)} ${String(total).padStart(5)}`);
  console.log("\n  Phase 2 ingestion complete.\n");
}

ingestPhase2().catch(err => {
  console.error("[ingest-phase2] Unhandled error:", err);
  process.exit(1);
});
