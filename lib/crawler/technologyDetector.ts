// lib/crawler/technologyDetector.ts
// Purpose: Technology detector — identifies frontend frameworks, backend services,
//          auth providers, payment processors, CDNs, and analytics from HTML,
//          JS content, headers, and URL patterns.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface TechStackProfile {
  frontendFramework: string;
  frontendVersion? : string;
  backendSignals   : string[];
  backendServices  : string[];
  authProviders    : string[];
  paymentProviders : string[];
  analyticsTools   : string[];
  cdnProviders     : string[];
  cssFrameworks    : string[];
  uiLibraries      : string[];
  hostingProvider  : string;
  confidence       : Record<string, "confirmed" | "likely" | "possible">;
  rawSignals       : string[];
}

interface DetectionSignal {
  name      : string;
  category  : keyof TechStackProfile;
  patterns  : Array<string | RegExp>;
  confidence: "confirmed" | "likely" | "possible";
}

// ── Signal library ─────────────────────────────────────────────────────────

const SIGNALS: DetectionSignal[] = [
  // Frontend frameworks
  { name: "Next.js",    category: "frontendFramework", confidence: "confirmed",
    patterns: ["__NEXT_DATA__", "_next/static", "next/head", "__next"] },
  { name: "React",      category: "frontendFramework", confidence: "confirmed",
    patterns: ["data-reactroot", "data-reactid", "_jsx(", "React.createElement", "__react"] },
  { name: "Vue.js",     category: "frontendFramework", confidence: "confirmed",
    patterns: ["data-v-app", "__vue_app__", "v-bind:", "v-model", "data-v-"] },
  { name: "Angular",    category: "frontendFramework", confidence: "confirmed",
    patterns: ["ng-version", "ng-app", "_nghost-", "_ngcontent-", "angular.min.js"] },
  { name: "Svelte",     category: "frontendFramework", confidence: "confirmed",
    patterns: ["__svelte", "svelte/internal", ".svelte-"] },
  { name: "Nuxt.js",    category: "frontendFramework", confidence: "confirmed",
    patterns: ["__nuxt", "_nuxt/", "nuxt-link", "$nuxt"] },
  { name: "Astro",      category: "frontendFramework", confidence: "confirmed",
    patterns: ["astro-island", "data-astro-cid", "_astro/"] },
  { name: "Remix",      category: "frontendFramework", confidence: "confirmed",
    patterns: ["__remix_manifest", "@remix-run/react"] },
  { name: "Gatsby",     category: "frontendFramework", confidence: "confirmed",
    patterns: ["___gatsby", "gatsby-", "page-data.json"] },

  // Backend services
  { name: "Supabase",   category: "backendServices", confidence: "confirmed",
    patterns: ["supabase.co", "supabaseClient", "@supabase/", "supabase-js"] },
  { name: "Firebase",   category: "backendServices", confidence: "confirmed",
    patterns: ["firebaseapp.com", "firebase.google.com", "initializeApp", "firestore"] },
  { name: "PlanetScale", category: "backendServices", confidence: "confirmed",
    patterns: ["planetscale.com"] },
  { name: "Prisma",     category: "backendServices", confidence: "likely",
    patterns: ["@prisma/client", "prisma.io"] },
  { name: "Vercel",     category: "hostingProvider", confidence: "confirmed",
    patterns: ["vercel.app", "x-vercel-", "/_vercel/", "vercel.json"] },
  { name: "Netlify",    category: "hostingProvider", confidence: "confirmed",
    patterns: ["netlify.app", "netlify.com/", "x-nf-request-id"] },
  { name: "AWS",        category: "backendServices", confidence: "likely",
    patterns: ["amazonaws.com", "cloudfront.net", "s3.amazonaws.com", "x-amz-"] },
  { name: "Cloudflare", category: "cdnProviders", confidence: "confirmed",
    patterns: ["cloudflare.com", "cf-ray", "__cf_bm", "cdn.cloudflare.com"] },

  // Auth providers
  { name: "Auth0",      category: "authProviders", confidence: "confirmed",
    patterns: ["auth0.com", "auth0.js", "@auth0/"] },
  { name: "Clerk",      category: "authProviders", confidence: "confirmed",
    patterns: ["clerk.com", "clerk.dev", "@clerk/nextjs"] },
  { name: "NextAuth",   category: "authProviders", confidence: "confirmed",
    patterns: ["/api/auth/", "next-auth", "next-auth.js.org"] },
  { name: "Firebase Auth", category: "authProviders", confidence: "confirmed",
    patterns: ["firebase/auth", "signInWithEmailAndPassword", "GoogleAuthProvider"] },
  { name: "Supabase Auth", category: "authProviders", confidence: "confirmed",
    patterns: ["supabase.auth.signIn", "supabase.auth.getUser", "supabase.auth.signUp"] },

  // Payment
  { name: "Stripe",     category: "paymentProviders", confidence: "confirmed",
    patterns: ["stripe.com/v3", "js.stripe.com", "Stripe(", "StripeElements"] },
  { name: "PayPal",     category: "paymentProviders", confidence: "confirmed",
    patterns: ["paypal.com/sdk", "paypalobjects.com", "PayPalScriptProvider"] },
  { name: "Square",     category: "paymentProviders", confidence: "confirmed",
    patterns: ["squareup.com", "web.squarecdn.com"] },
  { name: "Braintree",  category: "paymentProviders", confidence: "confirmed",
    patterns: ["braintreepayments.com", "braintree-web"] },

  // Analytics
  { name: "Google Analytics", category: "analyticsTools", confidence: "confirmed",
    patterns: ["google-analytics.com", "gtag(", "ga(", "UA-", "G-", "googletagmanager.com"] },
  { name: "Plausible",  category: "analyticsTools", confidence: "confirmed",
    patterns: ["plausible.io", "data-domain"] },
  { name: "Segment",    category: "analyticsTools", confidence: "confirmed",
    patterns: ["segment.com", "analytics.js", "window.analytics"] },
  { name: "Mixpanel",   category: "analyticsTools", confidence: "confirmed",
    patterns: ["mixpanel.com", "mixpanel.track"] },
  { name: "Hotjar",     category: "analyticsTools", confidence: "confirmed",
    patterns: ["hotjar.com", "hjSetting"] },

  // CSS frameworks
  { name: "Tailwind CSS", category: "cssFrameworks", confidence: "confirmed",
    patterns: [/class="[^"]*(?:flex|grid|bg-|text-|px-|py-|rounded|shadow)[^"]*"/, "tailwind.css", "tailwindcss"] },
  { name: "Bootstrap",  category: "cssFrameworks", confidence: "confirmed",
    patterns: ["bootstrap.min.css", "bootstrap.css", "bootstrap.bundle", "class=\"container\""] },
  { name: "Material UI", category: "uiLibraries", confidence: "confirmed",
    patterns: ["@mui/material", "material-ui", "MuiButton", "makeStyles"] },
  { name: "Chakra UI",  category: "uiLibraries", confidence: "confirmed",
    patterns: ["@chakra-ui", "ChakraProvider", "chakra-ui"] },
  { name: "shadcn/ui",  category: "uiLibraries", confidence: "confirmed",
    patterns: ["@/components/ui/", "shadcn", "radix-ui"] },
];

// ── Detection engine ───────────────────────────────────────────────────────

function testPatterns(content: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some(p =>
    typeof p === "string" ? content.includes(p) : p.test(content)
  );
}

function detectVersion(content: string, tech: string): string | undefined {
  const versionPatterns: Record<string, RegExp> = {
    "React"  : /"react":\s*"([^"]+)"/,
    "Next.js": /"next":\s*"([^"]+)"|next\/dist\/.*?version.*?"([^"]+)"/,
    "Vue.js" : /Vue\.version\s*=\s*["']([^"']+)["']/,
    "Angular": /ng-version="([^"]+)"/,
  };
  const pat = versionPatterns[tech];
  if (!pat) return undefined;
  const m = pat.exec(content);
  return m?.[1] ?? m?.[2];
}

// ── Main detector ──────────────────────────────────────────────────────────

export function detectTechnologies(
  htmlSamples : string[],    // HTML from multiple pages
  jsSamples   : string[],    // JS content samples
  headers     : Record<string, string>  // response headers from root page
): TechStackProfile {
  const combined  = [...htmlSamples, ...jsSamples].join("\n").slice(0, 500_000);
  const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n").toLowerCase();
  const allContent = combined + "\n" + headerStr;

  const profile: TechStackProfile = {
    frontendFramework: "Unknown",
    backendSignals   : [],
    backendServices  : [],
    authProviders    : [],
    paymentProviders : [],
    analyticsTools   : [],
    cdnProviders     : [],
    cssFrameworks    : [],
    uiLibraries      : [],
    hostingProvider  : "Unknown",
    confidence       : {},
    rawSignals       : [],
  };

  const frameworkCandidates: Array<{ name: string; confidence: "confirmed" | "likely" | "possible" }> = [];

  for (const signal of SIGNALS) {
    if (!testPatterns(allContent, signal.patterns)) continue;

    profile.rawSignals.push(signal.name);
    profile.confidence[signal.name] = signal.confidence;

    const cat = signal.category;

    if (cat === "frontendFramework") {
      frameworkCandidates.push({ name: signal.name, confidence: signal.confidence });
    } else if (cat === "hostingProvider") {
      profile.hostingProvider = signal.name;
    } else {
      const arr = profile[cat] as string[];
      if (!arr.includes(signal.name)) arr.push(signal.name);
    }
  }

  // Pick primary frontend framework (confirmed > likely > possible)
  if (frameworkCandidates.length > 0) {
    const best = frameworkCandidates.sort((a, b) => {
      const order = { confirmed: 0, likely: 1, possible: 2 };
      return order[a.confidence] - order[b.confidence];
    })[0];
    profile.frontendFramework = best.name;
    profile.frontendVersion   = detectVersion(combined, best.name);
  }

  // Vercel hosting heuristic from headers
  if (headers["x-vercel-id"] || headers["server"] === "Vercel") {
    profile.hostingProvider = "Vercel";
  } else if (headers["x-powered-by"]?.includes("Express")) {
    profile.backendSignals.push("Express.js");
  } else if (headers["x-powered-by"]?.includes("Next.js")) {
    profile.backendSignals.push("Next.js server");
  }

  // Deduplicate
  profile.backendServices  = [...new Set(profile.backendServices)];
  profile.authProviders    = [...new Set(profile.authProviders)];
  profile.paymentProviders = [...new Set(profile.paymentProviders)];
  profile.analyticsTools   = [...new Set(profile.analyticsTools)];
  profile.cdnProviders     = [...new Set(profile.cdnProviders)];
  profile.cssFrameworks    = [...new Set(profile.cssFrameworks)];
  profile.uiLibraries      = [...new Set(profile.uiLibraries)];

  return profile;
}
