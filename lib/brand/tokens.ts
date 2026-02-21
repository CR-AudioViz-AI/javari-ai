// lib/brand/tokens.ts
// CR AudioViz AI — Brand Design Tokens
// 2026-02-20 — STEP 6 Productization
//
// Single source of truth for brand colors, typography, spacing, gradients.
// Use these in Tailwind className strings or inline styles.
// Mirrors the CSS variables approach in globals.css.

// ── Color Palette ─────────────────────────────────────────────────────────────

export const BRAND_COLORS = {
  // Primary — CR Blue
  primary: {
    50:  "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",   // main
    600: "#2563eb",   // hover
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  // Accent — CR Purple
  accent: {
    50:  "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",   // main
    600: "#9333ea",   // hover
    700: "#7e22ce",
    800: "#6b21a8",
    900: "#581c87",
    950: "#3b0764",
  },
  // Success
  success: {
    500: "#22c55e",
    600: "#16a34a",
  },
  // Warning
  warning: {
    500: "#f59e0b",
    600: "#d97706",
  },
  // Error
  error: {
    500: "#ef4444",
    600: "#dc2626",
  },
  // Neutral (dark theme base)
  neutral: {
    0:   "#ffffff",
    50:  "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    850: "#162032",
    900: "#0f172a",
    950: "#020617",
  },
} as const;

// ── Gradients ─────────────────────────────────────────────────────────────────

export const BRAND_GRADIENTS = {
  // Hero gradient — blue to purple
  hero:       "from-blue-600 via-blue-500 to-purple-600",
  heroBg:     "bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600",
  // Card gradient
  card:       "from-slate-900 to-slate-800",
  cardBg:     "bg-gradient-to-br from-slate-900 to-slate-800",
  // Subtle blue tint for sections
  section:    "from-blue-950/30 to-purple-950/20",
  sectionBg:  "bg-gradient-to-br from-blue-950/30 to-purple-950/20",
  // Text gradient
  text:       "bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent",
  textInline: "bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent",
  // Border gradient (via outline trick)
  border:     "bg-gradient-to-r from-blue-500 to-purple-500",
  // Pricing highlight
  featured:   "from-blue-600 to-purple-700",
  featuredBg: "bg-gradient-to-br from-blue-600 to-purple-700",
  // CTA button
  cta:        "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500",
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const BRAND_TYPOGRAPHY = {
  // Font families (must match next/font imports in layout)
  fontSans:  "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
  fontMono:  "var(--font-mono, ui-monospace, 'Cascadia Code', monospace)",
  // Scale (Tailwind class names)
  h1:   "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight",
  h2:   "text-3xl sm:text-4xl font-bold tracking-tight",
  h3:   "text-2xl sm:text-3xl font-semibold",
  h4:   "text-xl sm:text-2xl font-semibold",
  h5:   "text-lg font-semibold",
  body: "text-base leading-relaxed",
  sm:   "text-sm leading-relaxed",
  xs:   "text-xs",
  // Special
  heroTitle:    "text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight",
  sectionTitle: "text-3xl sm:text-4xl font-bold tracking-tight",
  label:        "text-xs font-semibold uppercase tracking-widest",
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const BRAND_SPACING = {
  // Section padding
  sectionY: "py-16 sm:py-24",
  sectionX: "px-4 sm:px-6 lg:px-8",
  container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
  containerNarrow: "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8",
  // Card
  cardPad:   "p-6 sm:p-8",
  cardPadSm: "p-4 sm:p-6",
} as const;

// ── Component tokens ──────────────────────────────────────────────────────────

export const BRAND_COMPONENTS = {
  // Buttons
  btnPrimary:   `${BRAND_GRADIENTS.cta} text-white font-semibold rounded-xl px-6 py-3 transition-all shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40 active:scale-[0.98]`,
  btnSecondary: "bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl px-6 py-3 transition-all border border-white/20",
  btnOutline:   "border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white font-semibold rounded-xl px-6 py-3 transition-all",
  btnSm:        `${BRAND_GRADIENTS.cta} text-white font-medium rounded-lg px-4 py-2 text-sm transition-all`,
  btnDanger:    "bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl px-6 py-3 transition-all",
  // Cards
  card:         "bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm",
  cardHover:    "bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm hover:border-blue-700/50 transition-all duration-300",
  cardFeatured: "bg-gradient-to-br from-blue-900/60 to-purple-900/40 border border-blue-600/50 rounded-2xl shadow-2xl shadow-blue-900/20",
  // Badges
  badgeFree:       "bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full",
  badgeCreator:    "bg-blue-900/60 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-700/40",
  badgePro:        "bg-purple-900/60 text-purple-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-700/40",
  badgeEnterprise: "bg-gradient-to-r from-blue-900/60 to-purple-900/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-600/40",
  // Page shells
  pageBg:       "min-h-screen bg-slate-950 text-white",
  pageHero:     "relative overflow-hidden bg-slate-950",
} as const;

// ── Tier badge map ─────────────────────────────────────────────────────────────

export const TIER_BADGE_CLASS: Record<string, string> = {
  free:       BRAND_COMPONENTS.badgeFree,
  creator:    BRAND_COMPONENTS.badgeCreator,
  pro:        BRAND_COMPONENTS.badgePro,
  enterprise: BRAND_COMPONENTS.badgeEnterprise,
};

export const TIER_COLOR_MAP: Record<string, { icon: string; ring: string; glow: string }> = {
  free:       { icon: "text-slate-400",  ring: "ring-slate-700",  glow: "shadow-slate-900/50"  },
  creator:    { icon: "text-blue-400",   ring: "ring-blue-700",   glow: "shadow-blue-900/50"   },
  pro:        { icon: "text-purple-400", ring: "ring-purple-700", glow: "shadow-purple-900/50" },
  enterprise: { icon: "text-yellow-400", ring: "ring-yellow-700", glow: "shadow-yellow-900/50" },
};

// ── CR AudioViz brand identity ────────────────────────────────────────────────

export const BRAND_IDENTITY = {
  name:        "CR AudioViz AI",
  tagline:     "Your Story. Our Design.",
  description: "The all-in-one AI creative platform for creators, businesses, and enterprises.",
  url:         "https://craudiovizai.com",
  appUrl:      "https://javariai.com",
  support:     "support@craudiovizai.com",
  twitter:     "@CRAudioVizAI",
  // Javari AI — the embedded assistant brand
  javari: {
    name:    "Javari AI",
    tagline: "Your Autonomous Business Partner",
    color:   "blue",
  },
} as const;
