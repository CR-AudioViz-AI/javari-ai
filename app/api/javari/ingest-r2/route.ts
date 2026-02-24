// app/api/javari/ingest-r2/route.ts
// One-time R2 Canonical document ingestion endpoint
// Reads javari-documentation GitHub repo → chunks → embeds → stores in javari_knowledge
// Call: POST /api/javari/ingest-r2 with { "secret": "INGEST_SECRET" }
// Idempotent: uses source_id to deduplicate

import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min — large ingestion job
export const dynamic = "force-dynamic";

const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_PAT || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

// R2 docs to ingest — 70 FINAL documents from the inventory
const R2_INGEST_LIST = [
  { id: "R2-000", path: "README.md" },
  { id: "R2-001", path: "COMPLETE_INDEX.md" },
  { id: "R2-010", path: "owner-docs/MASTER_BIBLE_CONSOLIDATED_V7.md" },
  { id: "R2-012", path: "owner-docs/MASTER_SUMMARY.md" },
  { id: "R2-013", path: "owner-docs/REVENUE_OPERATIONS.md" },
  { id: "R2-014", path: "owner-docs/SCALING_ROADMAP.md" },
  { id: "R2-015", path: "owner-docs/PLATFORM_ROADMAP_2026.md" },
  { id: "R2-016", path: "owner-docs/WHITE_LABEL_SOLUTIONS.md" },
  { id: "R2-017", path: "owner-docs/PARTNERSHIP_STRATEGY.md" },
  { id: "R2-018", path: "owner-docs/EXECUTIVE_SUMMARY.md" },
  { id: "R2-019", path: "owner-docs/NEXT_STEPS_ROADMAP.md" },
  { id: "R2-020", path: "owner-docs/ECOSYSTEM_COMPLETE.md" },
  { id: "R2-021", path: "owner-docs/ECOSYSTEM_STATUS.md" },
  { id: "R2-022", path: "owner-docs/ALL_REPOSITORIES.md" },
  { id: "R2-023", path: "owner-docs/FINANCIAL_SUMMARY.md" },
  { id: "R2-024", path: "owner-docs/REALTOR_ECOSYSTEM_PLAN.md" },
  { id: "R2-025", path: "owner-docs/EXECUTIVE_DASHBOARD.md" },
  { id: "R2-031", path: "blueprints/CR-REALTOR-PLATFORM-BLUEPRINT.md" },
  { id: "R2-032", path: "blueprints/CRAVBARRELS-BLUEPRINT.md" },
  { id: "R2-033", path: "blueprints/CRAVCARDS-BLUEPRINT.md" },
  { id: "R2-034", path: "business/javari/EXECUTIVE_SUMMARY.md" },
  { id: "R2-035", path: "business/javari-ai/EXECUTIVE_SUMMARY.md" },
  { id: "R2-036", path: "business/market-oracle/EXECUTIVE_SUMMARY.md" },
  { id: "R2-040", path: "technical/javari/ARCHITECTURE.md" },
  { id: "R2-041", path: "technical/javari-ai/ARCHITECTURE.md" },
  { id: "R2-042", path: "technical/market-oracle/ARCHITECTURE.md" },
  { id: "R2-043", path: "technical/JAVARI_SDK_API_COMPLETE.md" },
  { id: "R2-044", path: "technical/CREDENTIALS_GUIDE.md" },
  { id: "R2-046", path: "technical-docs/API_INTEGRATION_GUIDE.md" },
  { id: "R2-047", path: "technical-docs/DEVELOPER_ONBOARDING.md" },
  { id: "R2-050", path: "admin-docs/API_DOCUMENTATION_COMPLETE.md" },
  { id: "R2-051", path: "admin-docs/BOT_SYSTEM_COMPLETE.md" },
  { id: "R2-052", path: "admin-docs/DATABASE_SCHEMA_COMPLETE.md" },
  { id: "R2-053", path: "admin-docs/DEPLOYMENT_PROCEDURES_COMPLETE.md" },
  { id: "R2-054", path: "admin-docs/JAVARI_AI_COMPLETE_GUIDE.md" },
  { id: "R2-055", path: "admin-docs/TROUBLESHOOTING_GUIDE.md" },
  { id: "R2-056", path: "admin-docs/MONITORING_SETUP.md" },
  { id: "R2-057", path: "admin-docs/INTEGRATION_GUIDES.md" },
  { id: "R2-058", path: "admin-docs/SECURITY_BACKUP.md" },
  { id: "R2-070", path: "ai-learning/javari/AI_CONTEXT.md" },
  { id: "R2-071", path: "ai-learning/javari-ai/AI_CONTEXT.md" },
  { id: "R2-072", path: "ai-learning/PLATFORM_CONTEXT.md" },
  { id: "R2-073", path: "ai-learning/market-oracle/AI_CONTEXT.md" },
  { id: "R2-080", path: "customer/javari/USER_GUIDE.md" },
  { id: "R2-081", path: "customer/javari-ai/USER_GUIDE.md" },
  { id: "R2-082", path: "customer/market-oracle/USER_GUIDE.md" },
  { id: "R2-084", path: "customer-docs/PLATFORM_USER_GUIDE.md" },
  { id: "R2-085", path: "customer-docs/CRAIVERSE_USER_GUIDE.md" },
  { id: "R2-086", path: "customer-docs/GAMES_PLATFORM_GUIDE.md" },
  { id: "R2-087", path: "customer-docs/MARKETPLACE_SELLER_GUIDE.md" },
  { id: "R2-088", path: "customer-docs/GETTING_STARTED_GUIDE.md" },
  { id: "R2-089", path: "customer-docs/TOOL_TUTORIALS_OVERVIEW.md" },
  { id: "R2-090", path: "customer-docs/FAQ_COMPREHENSIVE.md" },
  { id: "R2-091", path: "customer-docs/API_DOCUMENTATION.md" },
  { id: "R2-092", path: "customer-docs/AFFILIATE_PROGRAM_GUIDE.md" },
  { id: "R2-093", path: "customer-docs/CONTENT_CREATOR_GUIDE.md" },
  { id: "R2-094", path: "customer-docs/TROUBLESHOOTING_GUIDE.md" },
  { id: "R2-100", path: "helpdesk-docs/SUPPORT_PROCEDURES.md" },
  { id: "R2-101", path: "helpdesk-docs/TROUBLESHOOTING_GUIDE.md" },
  { id: "R2-102", path: "helpdesk-docs/CUSTOMER_SERVICE_SCRIPTS.md" },
  { id: "R2-103", path: "helpdesk-docs/ESCALATION_WORKFLOWS.md" },
  { id: "R2-104", path: "helpdesk-docs/SUPPORT_TEAM_GUIDE.md" },
  { id: "R2-105", path: "helpdesk-docs/COMMON_ISSUES.md" },
  { id: "R2-110", path: "operations/javari/RUNBOOK.md" },
  { id: "R2-111", path: "operations/javari-ai/OPERATIONS_GUIDE.md" },
  { id: "R2-120", path: "reference/REPOSITORY_INVENTORY.md" },
  { id: "R2-121", path: "reference/DOCUMENTATION_INVENTORY.md" },
  { id: "R2-137", path: "sessions/SESSION_SUMMARY_DEC22_2025.md" },
  { id: "R2-140", path: "status/100_PERCENT_INTEGRATION_COMPLETE.md" },
  { id: "R2-150", path: "workflows/SACRED_WORKFLOW.md" },
];

// Chunk a long document into overlapping segments
function chunkText(text: string, maxChunk = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChunk, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks.filter((c) => c.length > 50);
}

async function getFileFromGitHub(path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/CR-AudioViz-AI/javari-documentation/contents/${path}?ref=main`;
  const headers: HeadersInit = { "User-Agent": "JavariIngest/1.0" };
  if (GH_TOKEN) headers["Authorization"] = `token ${GH_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json() as { content?: string };
  if (!data.content) return null;
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data?.data?.[0]?.embedding ?? null;
}

async function upsertKnowledge(
  docId: string,
  chunkIndex: number,
  text: string,
  embedding: number[]
): Promise<boolean> {
  const sourceId = `${docId}-chunk-${chunkIndex}`;
  const body = JSON.stringify({
    category: "r2_canonical",
    subcategory: docId,
    title: `${docId} (chunk ${chunkIndex + 1})`,
    content: text,
    keywords: [docId, "r2_canonical", "canonical"],
    source_type: "r2_document",
    source_id: sourceId,
    source_url: `https://github.com/CR-AudioViz-AI/javari-documentation`,
    confidence_score: 1.0,
    embedding: JSON.stringify(embedding),
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/javari_knowledge`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body,
  });

  return res.ok || res.status === 409; // 409 = duplicate, that\'s fine
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body?.secret ?? "";

    // Simple secret gate — set INGEST_SECRET env var in Vercel
    const expectedSecret = process.env.INGEST_SECRET || "javari-r2-ingest-2026";
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: Array<{ id: string; chunks: number; status: string }> = [];
    let totalChunks = 0;
    let totalErrors = 0;

    for (const doc of R2_INGEST_LIST) {
      try {
        // Fetch document from GitHub
        const content = await getFileFromGitHub(doc.path);
        if (!content) {
          results.push({ id: doc.id, chunks: 0, status: "fetch_failed" });
          totalErrors++;
          continue;
        }

        // Chunk the document
        const chunks = chunkText(content);
        let chunksSaved = 0;

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i]);
          if (!embedding) {
            totalErrors++;
            continue;
          }
          const saved = await upsertKnowledge(doc.id, i, chunks[i], embedding);
          if (saved) chunksSaved++;
          // Rate limit — OpenAI embeddings is 3000 RPM, we\'re well under
          await new Promise((r) => setTimeout(r, 50));
        }

        results.push({ id: doc.id, chunks: chunksSaved, status: "ok" });
        totalChunks += chunksSaved;
      } catch (err) {
        results.push({
          id: doc.id,
          chunks: 0,
          status: `error: ${err instanceof Error ? err.message : "unknown"}`,
        });
        totalErrors++;
      }
    }

    return NextResponse.json({
      success: true,
      docs_processed: R2_INGEST_LIST.length,
      total_chunks: totalChunks,
      errors: totalErrors,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET — check status
export async function GET(): Promise<Response> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/javari_knowledge?select=id&category=eq.r2_canonical`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "count=exact",
        },
      }
    );
    const countHeader = res.headers.get("content-range") || "0";
    const count = parseInt(countHeader.split("/")[1] || "0", 10);
    return NextResponse.json({
      r2_chunks_ingested: count,
      ready: count > 0,
      message: count > 0
        ? `${count} R2 chunks available for semantic retrieval`
        : "No R2 chunks ingested yet — POST with secret to ingest",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
