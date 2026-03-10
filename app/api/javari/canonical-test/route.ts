// app/api/javari/canonical-test/route.ts
// Diagnostic: test canonical_documents insert
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );

  // Test 1: Does the table exist?
  const { data: countData, error: countErr, count } = await client
    .from("canonical_documents")
    .select("*", { count: "exact", head: true });

  // Test 2: Try a test insert
  const { data: insertData, error: insertErr } = await client
    .from("canonical_documents")
    .upsert({
      title: "Test Doc",
      source: "test/diagnostic.md",
      chunk_index: 0,
      content: "This is a test chunk for diagnostic purposes.",
      content_hash: "abc123",
      doc_type: "markdown",
      token_count: 10,
    }, { onConflict: "source,chunk_index" })
    .select("id")
    .single();

  // Test 3: Count after insert
  const { count: countAfter } = await client
    .from("canonical_documents")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    tableExists: countErr === null || countErr?.code === "42P01",
    countBefore: count,
    countError: countErr?.message ?? null,
    insertError: insertErr?.message ?? null,
    insertData,
    countAfter,
  });
}
