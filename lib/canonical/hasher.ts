// lib/canonical/hasher.ts
// CR AudioViz AI — Canonical Hasher
// 2026-02-22 PART 2

import crypto from "crypto";

/**
 * sha256Hex — returns the hex-encoded SHA-256 hash of a UTF-8 string.
 * Used to detect content changes before re-embedding.
 */
export function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
