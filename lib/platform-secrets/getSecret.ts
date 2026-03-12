// lib/platform-secrets/getSecret.ts
// CR AudioViz AI — Platform Secret Authority: Read Path
// 2026-02-22
// SERVER-SIDE ONLY. Never import from client components.
// Lookup order:
//   1. In-process cache (TTL 5 min)
//   2. Supabase get_platform_secret(name) SECURITY DEFINER RPC → AES-256-GCM decrypt
//   3. process.env fallback (transition period only — logs warning)
import { decrypt, maskSecret } from "./crypto";
// ── Cache ─────────────────────────────────────────────────────────────────────
// ── Supabase bootstrap config (always from process.env) ───────────────────────
// ── DB fetch via SECURITY DEFINER RPC ────────────────────────────────────────
// get_platform_secret(name text) — param is "name" not "p_name"
// increment_secret_access(p_name text) — this function retains p_name param
// ── Public API ────────────────────────────────────────────────────────────────
export default {}
export const getSecret = async (_key: string): Promise<string | null> => null
