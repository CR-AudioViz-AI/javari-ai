// lib/branding/loadBrandTokens.ts
// CR AudioViz AI — Canonical Brand Token Loader
// Created: 2026-03-10
//
// Loads branding tokens from R2 canonical docs at:
//   cold-storage/canonical/branding/crav-brand-tokens.json
//
// Execution model:
//   - Server-side only (uses getSecret / R2 SigV4 signing)
//   - Module-level singleton cache — loaded once per serverless instance
//   - Falls back to hardcoded defaults if R2 is unavailable
//   - Never throws — callers always receive a valid token set
//
// Usage:
//   import { getBrandTokens } from "@/lib/branding/loadBrandTokens"
//   const brand = await getBrandTokens()
//   brand.colors.primary  // "#E30B17"

import crypto from "crypto"
import { getSecret } from "@/lib/platform-secrets"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandColors {
  primary:        string
  primary_hover:  string
  primary_dim:    string
  primary_glow:   string
  bg:             string
  panel_dark:     string
  panel_deeper:   string
  panel_mid:      string
  border:         string
  border_light:   string
  text_primary:   string
  text_secondary: string
  text_dim:       string
  text_muted:     string
  green:          string
  green_dim:      string
  blue:           string
  blue_dim:       string
  orange:         string
  red_error:      string
  btn_primary:    string
  btn_secondary:  string
}

export interface BrandTypography {
  font_display: string
  font_mono:    string
  font_body:    string
}

export interface BrandIdentity {
  name:    string
  tagline: string
  javari:  string
}

export interface BrandTokens {
  colors:     BrandColors
  typography: BrandTypography
  brand:      BrandIdentity
  _source:    "r2" | "fallback"
  _loadedAt:  number
}

// ─── Fallback (hardcoded canonical values) ────────────────────────────────────
// These mirror crav-brand-tokens.json exactly.
// If R2 is unreachable this is what ships — no invisible degradation.

const FALLBACK_TOKENS: BrandTokens = {
  colors: {
    primary:        "#E30B17",
    primary_hover:  "#FF1E2A",
    primary_dim:    "rgba(227,11,23,0.15)",
    primary_glow:   "rgba(227,11,23,0.35)",
    bg:             "#0E0E12",
    panel_dark:     "#141419",
    panel_deeper:   "#0F0F14",
    panel_mid:      "#1C1C24",
    border:         "#2A2A33",
    border_light:   "#3A3A45",
    text_primary:   "#EAEAF0",
    text_secondary: "#A5A5B0",
    text_dim:       "#4A4A55",
    text_muted:     "#2A2A33",
    green:          "#00D97E",
    green_dim:      "rgba(0,217,126,0.12)",
    blue:           "#4A8AFF",
    blue_dim:       "rgba(74,138,255,0.12)",
    orange:         "#FF8C00",
    red_error:      "#FF4455",
    btn_primary:    "#E30B17",
    btn_secondary:  "#1C1C24",
  },
  typography: {
    font_display: "Syne",
    font_mono:    "JetBrains Mono",
    font_body:    "JetBrains Mono",
  },
  brand: {
    name:    "CR AudioViz AI",
    tagline: "Your Story. Our Design.",
    javari:  "Javari AI",
  },
  _source:   "fallback",
  _loadedAt: 0,
}

// ─── Module-level cache ───────────────────────────────────────────────────────
// Persists for the lifetime of the serverless instance (~minutes).
// TTL: 5 minutes — re-fetches from R2 after expiry so hot deploys pick up changes.

const CACHE_TTL_MS = 5 * 60 * 1000
let _cache: BrandTokens | null = null

// ─── R2 fetch helpers (mirrors lib/canonical/r2-client.ts pattern) ────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
  const k = typeof key === "string" ? Buffer.from(key, "utf8") : key
  return crypto.createHmac("sha256", k).update(data, "utf8").digest()
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex")
}

async function fetchFromR2(
  endpoint:  string,
  accessKey: string,
  secretKey: string,
  bucket:    string,
  key:       string,
): Promise<string> {
  const now       = new Date()
  const dateShort = now.toISOString().slice(0, 10).replace(/-/g, "")
  const dateTime  = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z"

  const host        = new URL(endpoint).host
  const region      = "auto"
  const service     = "s3"
  const payloadHash = sha256Hex("")
  const path        = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateTime}\n`
  const signedHeaders    = "host;x-amz-content-sha256;x-amz-date"

  const canonicalRequest = ["GET", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credentialScope  = `${dateShort}/${region}/${service}/aws4_request`
  const stringToSign     = ["AWS4-HMAC-SHA256", dateTime, credentialScope, sha256Hex(canonicalRequest)].join("\n")

  const signingKey = hmacSha256(
    hmacSha256(hmacSha256(hmacSha256(`AWS4${secretKey}`, dateShort), region), service),
    "aws4_request",
  )
  const signature = hmacSha256(signingKey, stringToSign).toString("hex")

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const url = `${endpoint}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { host, "x-amz-date": dateTime, "x-amz-content-sha256": payloadHash, authorization },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

// ─── Token validator ──────────────────────────────────────────────────────────
// Ensures a parsed object has the minimum required shape before we trust it.

function isValidTokenShape(obj: unknown): obj is Partial<{ colors: unknown; typography: unknown; brand: unknown }> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "colors" in obj &&
    typeof (obj as Record<string, unknown>).colors === "object"
  )
}

function mergeWithFallback(remote: unknown): BrandTokens {
  if (!isValidTokenShape(remote)) return { ...FALLBACK_TOKENS, _source: "fallback" }

  const r = remote as Record<string, Record<string, string>>

  return {
    colors: {
      ...FALLBACK_TOKENS.colors,
      ...(typeof r.colors === "object" && r.colors !== null ? r.colors : {}),
    } as BrandColors,
    typography: {
      ...FALLBACK_TOKENS.typography,
      ...(typeof r.typography === "object" && r.typography !== null ? r.typography : {}),
    } as BrandTypography,
    brand: {
      ...FALLBACK_TOKENS.brand,
      ...(typeof r.brand === "object" && r.brand !== null ? r.brand : {}),
    } as BrandIdentity,
    _source:   "r2",
    _loadedAt: Date.now(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getBrandTokens — returns the canonical CR AudioViz AI brand token set.
 *
 * - First call: attempts to load from R2 `cold-storage/canonical/branding/crav-brand-tokens.json`
 * - Subsequent calls within TTL: returns cached value (no R2 round-trip)
 * - On any failure (network, auth, parse): returns FALLBACK_TOKENS silently
 *
 * Safe to call from any server component, API route, or server action.
 * Never throws. Never blocks the render for more than 8 seconds (R2 timeout).
 */
export async function getBrandTokens(): Promise<BrandTokens> {
  // Return cache if still fresh
  if (_cache && Date.now() - _cache._loadedAt < CACHE_TTL_MS) {
    return _cache
  }

  try {
    const [endpoint, accessKey, secretKey] = await Promise.all([
      getSecret("R2_ENDPOINT"),
      getSecret("R2_ACCESS_KEY_ID"),
      getSecret("R2_SECRET_ACCESS_KEY"),
    ])

    if (!endpoint || !accessKey || !secretKey) {
      console.warn("[loadBrandTokens] R2 credentials unavailable — using fallback tokens")
      return FALLBACK_TOKENS
    }

    const raw = await fetchFromR2(
      endpoint.trim(),
      accessKey.trim(),
      secretKey.trim(),
      "cold-storage",
      "canonical/branding/crav-brand-tokens.json",
    )

    const parsed = JSON.parse(raw)
    const tokens = mergeWithFallback(parsed)
    _cache = tokens

    console.info("[loadBrandTokens] Brand tokens loaded from R2 ✅")
    return tokens

  } catch (err) {
    console.warn(
      "[loadBrandTokens] R2 load failed — using fallback tokens:",
      err instanceof Error ? err.message : String(err),
    )
    // Cache the fallback briefly (30s) to avoid hammering R2 on every request
    _cache = { ...FALLBACK_TOKENS, _loadedAt: Date.now() - CACHE_TTL_MS + 30_000 }
    return FALLBACK_TOKENS
  }
}

/**
 * getStaticBrandTokens — synchronous fallback for client components.
 * Returns the hardcoded fallback immediately — no async, no R2 call.
 * Use this in "use client" files where you cannot await.
 */
export function getStaticBrandTokens(): BrandTokens {
  return FALLBACK_TOKENS
}

/**
 * invalidateBrandCache — force next call to re-fetch from R2.
 * Useful after a branding update or from an admin endpoint.
 */
export function invalidateBrandCache(): void {
  _cache = null
}
