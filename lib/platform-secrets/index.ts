// lib/platform-secrets/index.ts
// CR AudioViz AI — Platform Secret Authority
// 2026-02-22
//
// SERVER-SIDE ONLY. Never import from client components.
// All exports are safe for server-side use only.

export { encrypt, decrypt, fingerprint, maskSecret }        from "./crypto";
export { getSecret, getSecretSync, warmSecrets,
         cacheInvalidate, cacheStats }                       from "./getSecret";
export { setSecret, setSecrets }                             from "./setSecret";
export type { SetSecretOptions, SetSecretResult,
              SecretCategory }                               from "./setSecret";
export { installEnvShim, warmEnvShim, shimStatus }           from "./env-shim";
