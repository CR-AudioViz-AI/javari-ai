// lib/platform-secrets/index.ts
// CR AudioViz AI — Platform Secret Authority
// 2026-02-21
//
// SERVER-SIDE ONLY. Never import from client components.
// All exports are safe for server-side use only.

export { encrypt, decrypt, fingerprint, maskSecret }        from "./crypto";
export { getSecret, getSecretSync, warmSecrets,
         cacheInvalidate, cacheStats }                       from "./getSecret";
export { setSecret, setSecrets }                             from "./setSecret";
export type { SetSecretOptions, SetSecretResult,
              SecretCategory }                               from "./setSecret";

// ── Convenience: warm the most critical secrets at module load ────────────────
// This is OPTIONAL. Call warmSecrets() explicitly in instrumentation.ts instead.
// Do NOT call this at module load — it would run in every serverless invocation.
