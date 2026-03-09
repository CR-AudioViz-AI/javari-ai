// app/api/avatar/route.ts
// Javari AI — Avatar System API
// Purpose: Create, read, and update user avatars. Part of CRAIverse identity system.
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AVATAR_STYLES   = ["professional", "casual", "creative", "mission", "gamer", "builder"] as const;
const PERSONALITY_OPTIONS = ["helpful", "bold", "calm", "energetic", "wise", "playful"] as const;
const VOICE_STYLES    = ["warm", "direct", "formal", "friendly", "inspirational"] as const;

export async function GET() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: avatar } = await admin
    .from("user_avatars")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!avatar) {
    // Auto-create on first fetch
    const { data: created } = await admin
      .from("user_avatars")
      .insert({ user_id: user.id })
      .select("*")
      .single();
    return Response.json({ avatar: created });
  }

  return Response.json({ avatar });
}

export async function PATCH(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Validate allowed fields
  const allowed: Record<string, unknown> = {};
  if (body.name)            allowed.name            = body.name.slice(0, 50);
  if (body.style && AVATAR_STYLES.includes(body.style as typeof AVATAR_STYLES[number]))
    allowed.style = body.style;
  if (body.color_primary   && /^#[0-9a-f]{6}$/i.test(body.color_primary))
    allowed.color_primary = body.color_primary;
  if (body.color_secondary && /^#[0-9a-f]{6}$/i.test(body.color_secondary))
    allowed.color_secondary = body.color_secondary;
  if (body.emoji)           allowed.emoji       = body.emoji.slice(0, 4);
  if (body.personality && PERSONALITY_OPTIONS.includes(body.personality as typeof PERSONALITY_OPTIONS[number]))
    allowed.personality = body.personality;
  if (body.voice_style && VOICE_STYLES.includes(body.voice_style as typeof VOICE_STYLES[number]))
    allowed.voice_style = body.voice_style;

  allowed.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data: avatar, error } = await admin
    .from("user_avatars")
    .upsert({ user_id: user.id, ...allowed })
    .select("*")
    .single();

  if (error) {
    console.error("[avatar] Update error:", error);
    return Response.json({ error: "Failed to update avatar." }, { status: 500 });
  }

  return Response.json({ success: true, avatar });
}
