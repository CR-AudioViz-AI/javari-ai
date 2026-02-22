/** @type {import('next').NextConfig} */
// next.config.js
// CR AudioViz AI — Production-Optimised Next.js Config
// 2026-02-21 — Added instrumentationHook for Secret Authority

const nextConfig = {
  // ── TypeScript & ESLint ───────────────────────────────────────────────────
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // ── Secret Authority: enable instrumentation.ts ───────────────────────────
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: [  // tree-shake large deps
      "lucide-react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "framer-motion",
    ],
  },

  // ── Image Optimization ────────────────────────────────────────────────────
  images: {
    formats:          ["image/avif", "image/webp"],
    minimumCacheTTL:  86400,
    deviceSizes:      [640, 750, 828, 1080, 1200, 1920],
    imageSizes:       [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co",        pathname: "/storage/v1/object/**" },
      { protocol: "https", hostname: "*.vercel.app",         pathname: "/**" },
      { protocol: "https", hostname: "craudiovizai.com",     pathname: "/**" },
      { protocol: "https", hostname: "www.craudiovizai.com", pathname: "/**" },
    ],
  },

  // ── Headers: Security + Caching ──────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff"        },
          { key: "X-Frame-Options",         value: "DENY"           },
          { key: "X-XSS-Protection",        value: "1; mode=block"  },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/images/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },

  // ── Redirects ─────────────────────────────────────────────────────────────
  async redirects() {
    return [
      {
        source:      "/:path*",
        has:         [{ type: "host", value: "www.craudiovizai.com" }],
        destination: "https://craudiovizai.com/:path*",
        permanent:   true,
      },
      {
        source:      "/",
        has:         [{ type: "host", value: "beta.craudiovizai.com" }],
        destination: "https://craudiovizai.com/beta",
        permanent:   false,
      },
      { source: "/invite",   destination: "/beta",           permanent: false },
      { source: "/join",     destination: "/beta",           permanent: false },
      { source: "/waitlist", destination: "/beta#waitlist",  permanent: false },
    ];
  },

  // ── Rewrites ──────────────────────────────────────────────────────────────
  async rewrites() {
    return [
      { source: "/health", destination: "/api/health/ready" },
      { source: "/live",   destination: "/api/health/live"  },
    ];
  },

  // ── Webpack: Node built-in safety for edge runtime ────────────────────────
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === "edge") {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        stream: false,
        buffer: false,
        fs:     false,
        path:   false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
