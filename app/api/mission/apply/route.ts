// app/api/mission/apply/route.ts
// Javari AI — Social Impact Application Endpoint
// Purpose: Accepts mission module applications, stores in DB, sends notification.
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_TYPES = ["veteran", "first_responder", "faith", "animal_rescue"];

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { module_type, org_name, contact_name, contact_email, description, org_type } = body;

  if (!module_type || !VALID_TYPES.includes(module_type)) {
    return Response.json({ error: "Invalid organization type." }, { status: 400 });
  }
  if (!org_name?.trim())      return Response.json({ error: "Organization name required." }, { status: 400 });
  if (!contact_name?.trim())  return Response.json({ error: "Contact name required." }, { status: 400 });
  if (!contact_email?.trim()) return Response.json({ error: "Contact email required." }, { status: 400 });

  // Get current user if authenticated (optional)
  let userId: string | null = null;
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* public endpoint — user may not be logged in */ }

  const db = createAdminClient();

  const { data, error } = await db
    .from("social_impact_applications")
    .insert({
      user_id:       userId,
      module_type,
      org_name:      org_name.trim(),
      org_type:      org_type ?? module_type,
      contact_name:  contact_name.trim(),
      contact_email: contact_email.trim().toLowerCase(),
      description:   description?.trim() ?? null,
      status:        "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[mission/apply] DB error:", error);
    return Response.json({ error: "Failed to submit application." }, { status: 500 });
  }

  // Log for admin notification
  console.log(`[mission/apply] New application: ${module_type} — ${org_name} (${contact_email}) — id: ${data.id}`);

  return Response.json({
    success:       true,
    applicationId: data.id,
    message:       "Application submitted. Expect a response within 48 hours.",
  });
}
