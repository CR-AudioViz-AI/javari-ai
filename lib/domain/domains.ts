// lib/domain/domains.ts
// CR AudioViz AI — Domain & Canonical Routing
// 2026-02-21 — STEP 8 Go-Live

export const DOMAINS = {
  // Primary marketing domain
  main:  "craudiovizai.com",
  www:   "www.craudiovizai.com",
  // Beta / pre-release
  beta:  "beta.craudiovizai.com",
  // SaaS app
  app:   "app.craudiovizai.com",
  // Javari AI brand
  javari: "javariai.com",
} as const;

export type DomainKey = keyof typeof DOMAINS;

// ── Canonical domain resolver ──────────────────────────────────────────────────

export function getCanonicalDomain(host: string): string {
  const clean = host.replace(/:\d+$/, "").toLowerCase();

  // www → apex
  if (clean === DOMAINS.www) return DOMAINS.main;

  // beta → main (in GA phase)
  if (clean === DOMAINS.beta) return DOMAINS.main;

  return clean;
}

export function setCanonicalDomain(host: string): {
  canonical:   string;
  shouldRedirect: boolean;
  redirectTo?: string;
} {
  const canonical = getCanonicalDomain(host);
  const clean     = host.replace(/:\d+$/, "").toLowerCase();

  if (clean === canonical) {
    return { canonical, shouldRedirect: false };
  }

  return {
    canonical,
    shouldRedirect: true,
    redirectTo:     `https://${canonical}`,
  };
}

// ── Domain classification ──────────────────────────────────────────────────────

export function classifyDomain(host: string): {
  isApp:     boolean;
  isBeta:    boolean;
  isMain:    boolean;
  isJavari:  boolean;
  isLocal:   boolean;
} {
  const clean = host.replace(/:\d+$/, "").toLowerCase();
  return {
    isApp:    clean === DOMAINS.app,
    isBeta:   clean === DOMAINS.beta,
    isMain:   clean === DOMAINS.main || clean === DOMAINS.www,
    isJavari: clean === DOMAINS.javari,
    isLocal:  clean === "localhost" || clean.startsWith("127."),
  };
}

// ── Sitemap domains ────────────────────────────────────────────────────────────

export const PUBLIC_PAGES = [
  "/",
  "/pricing",
  "/features",
  "/tiers",
  "/store",
  "/beta",
  "/press",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/support",
] as const;

export function buildSitemapUrl(path: string, domain = DOMAINS.main): string {
  return `https://${domain}${path}`;
}
