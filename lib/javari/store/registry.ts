// lib/javari/store/registry.ts
// Javari Module Store — Registry
// 2026-02-20 — STEP 6 Productization
//
// Central registry of installable modules.
// Each module has a blueprint spec, file preview, required tier, and install metadata.
// Install = write module metadata to Supabase (install_id, user_id, module_id, status).

import type { ModuleComplexity, AuthRequirement } from "@/lib/javari/factory/blueprint";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModuleCategory =
  | "productivity"
  | "e-commerce"
  | "analytics"
  | "social"
  | "content"
  | "developer"
  | "finance"
  | "communication"
  | "ai-tools"
  | "admin";

export type ModuleStatus = "stable" | "beta" | "preview" | "coming_soon";
export type RequiredTier = "free" | "creator" | "pro" | "enterprise";

export interface ModuleRegistryEntry {
  id:          string;         // kebab-case unique ID
  name:        string;
  tagline:     string;
  description: string;
  category:    ModuleCategory;
  status:      ModuleStatus;
  requiredTier: RequiredTier;
  complexity:  ModuleComplexity;
  auth:        AuthRequirement;
  version:     string;
  author:      string;

  // Preview file tree (what gets generated)
  fileTree: Array<{
    path:     string;
    category: string;
    lines?:   number;
  }>;

  // Key features
  features:    string[];

  // Tags for search/filter
  tags:        string[];

  // Demo URL (optional)
  demoUrl?:    string;

  // Install time estimate (seconds)
  installTimeSec: number;

  // Counts
  installs:    number;
  rating:      number;   // 0-5

  createdAt:   string;
  updatedAt:   string;
}

export interface StoreInstallRecord {
  installId:  string;
  userId:     string;
  moduleId:   string;
  status:     "pending" | "generating" | "completed" | "failed";
  bundleData?: Record<string, string>;  // path → content
  error?:     string;
  installedAt: string;
  updatedAt:  string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    id:          "task-manager",
    name:        "Task Manager",
    tagline:     "Full CRUD task management with status tracking",
    description: "A complete task management module with create, read, update, delete operations, status workflows, user assignment, and real-time updates. Includes list view, detail view, and create/edit forms.",
    category:    "productivity",
    status:      "stable",
    requiredTier: "creator",
    complexity:  "standard",
    auth:        "required",
    version:     "1.0.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/tasks/page.tsx",           category: "page",      lines: 180 },
      { path: "app/tasks/[id]/page.tsx",       category: "page",      lines: 140 },
      { path: "app/tasks/new/page.tsx",        category: "page",      lines: 110 },
      { path: "app/api/tasks/route.ts",        category: "api_route", lines: 160 },
      { path: "app/api/tasks/[id]/route.ts",   category: "api_route", lines: 120 },
      { path: "components/tasks/TaskList.tsx", category: "component", lines: 200 },
      { path: "components/tasks/TaskForm.tsx", category: "component", lines: 180 },
      { path: "components/tasks/TaskCard.tsx", category: "component", lines: 90  },
      { path: "lib/types/tasks.ts",            category: "type",      lines: 80  },
      { path: "lib/utils/tasks.ts",            category: "util",      lines: 100 },
      { path: "supabase/migrations/*_tasks.sql", category: "schema",  lines: 120 },
    ],
    features: [
      "CRUD task operations",
      "Status workflow (pending → in-progress → done)",
      "User assignment",
      "Priority levels",
      "Due date tracking",
      "Supabase RLS",
      "TypeScript types + Zod validation",
    ],
    tags:           ["tasks", "productivity", "crud", "workflow"],
    installTimeSec: 45,
    installs:       1240,
    rating:         4.8,
    createdAt:      "2026-01-15T00:00:00Z",
    updatedAt:      "2026-02-01T00:00:00Z",
  },
  {
    id:          "blog-platform",
    name:        "Blog Platform",
    tagline:     "Full-featured blog with MDX support",
    description: "A complete blogging system with post creation, tag taxonomy, author profiles, comments, and SEO metadata. Supports MDX content, RSS feeds, and open-graph preview images.",
    category:    "content",
    status:      "stable",
    requiredTier: "creator",
    complexity:  "full",
    auth:        "optional",
    version:     "1.0.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/blog/page.tsx",           category: "page",      lines: 160 },
      { path: "app/blog/[slug]/page.tsx",    category: "page",      lines: 200 },
      { path: "app/api/blog/route.ts",       category: "api_route", lines: 180 },
      { path: "components/blog/PostCard.tsx",category: "component", lines: 120 },
      { path: "components/blog/PostForm.tsx",category: "component", lines: 240 },
      { path: "lib/types/blog.ts",           category: "type",      lines: 90  },
      { path: "supabase/migrations/*_blog.sql", category: "schema", lines: 140 },
    ],
    features: [
      "MDX content support",
      "Tag taxonomy",
      "Author profiles",
      "SEO meta tags",
      "RSS feed",
      "Comment system",
      "Draft/published workflow",
    ],
    tags:           ["blog", "content", "mdx", "seo"],
    installTimeSec: 60,
    installs:       890,
    rating:         4.7,
    createdAt:      "2026-01-20T00:00:00Z",
    updatedAt:      "2026-02-05T00:00:00Z",
  },
  {
    id:          "analytics-dashboard",
    name:        "Analytics Dashboard",
    tagline:     "Real-time metrics and KPI tracking",
    description: "A comprehensive analytics dashboard with real-time charts, KPI cards, date range filtering, CSV export, and Supabase-powered data aggregation. Built with Recharts.",
    category:    "analytics",
    status:      "stable",
    requiredTier: "pro",
    complexity:  "full",
    auth:        "required",
    version:     "1.0.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/analytics/page.tsx",                category: "page",      lines: 220 },
      { path: "app/api/analytics/route.ts",            category: "api_route", lines: 200 },
      { path: "components/analytics/KPICard.tsx",      category: "component", lines: 80  },
      { path: "components/analytics/TimeSeriesChart.tsx", category: "component", lines: 160 },
      { path: "components/analytics/BreakdownTable.tsx",  category: "component", lines: 140 },
      { path: "lib/types/analytics.ts",                category: "type",      lines: 100 },
      { path: "supabase/migrations/*_analytics.sql",   category: "schema",    lines: 200 },
    ],
    features: [
      "Real-time Recharts",
      "KPI cards with trends",
      "Date range filters",
      "CSV export",
      "Supabase aggregations",
      "Multi-metric support",
    ],
    tags:           ["analytics", "charts", "metrics", "kpi"],
    installTimeSec: 55,
    installs:       640,
    rating:         4.9,
    createdAt:      "2026-01-25T00:00:00Z",
    updatedAt:      "2026-02-10T00:00:00Z",
  },
  {
    id:          "contact-form",
    name:        "Contact Form",
    tagline:     "Accessible contact form with email delivery",
    description: "A minimal, accessible contact form with server-side validation, spam protection, Resend email delivery, and submission tracking in Supabase.",
    category:    "communication",
    status:      "stable",
    requiredTier: "free",
    complexity:  "minimal",
    auth:        "none",
    version:     "1.0.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/contact/page.tsx",         category: "page",      lines: 100 },
      { path: "app/api/contact/route.ts",     category: "api_route", lines: 120 },
      { path: "components/contact/ContactForm.tsx", category: "component", lines: 160 },
      { path: "lib/types/contact.ts",         category: "type",      lines: 40  },
    ],
    features: [
      "Server-side validation",
      "Resend email delivery",
      "Spam honeypot",
      "Submission confirmation",
      "WCAG 2.2 AA accessible",
    ],
    tags:           ["contact", "form", "email"],
    installTimeSec: 20,
    installs:       3200,
    rating:         4.6,
    createdAt:      "2026-01-10T00:00:00Z",
    updatedAt:      "2026-01-28T00:00:00Z",
  },
  {
    id:          "user-notifications",
    name:        "User Notifications",
    tagline:     "In-app and email notification system",
    description: "A complete notification system with in-app bell icon, notification feed, mark-as-read, email digests, and Supabase Realtime push.",
    category:    "communication",
    status:      "beta",
    requiredTier: "creator",
    complexity:  "standard",
    auth:        "required",
    version:     "0.9.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/api/notifications/route.ts",        category: "api_route", lines: 160 },
      { path: "components/notifications/NotificationBell.tsx", category: "component", lines: 120 },
      { path: "components/notifications/NotificationFeed.tsx", category: "component", lines: 200 },
      { path: "lib/types/notifications.ts",            category: "type",      lines: 70  },
      { path: "supabase/migrations/*_notifications.sql", category: "schema",  lines: 100 },
    ],
    features: [
      "Real-time Supabase push",
      "Mark as read/unread",
      "Email digest (Resend)",
      "Notification categories",
      "Auto-expire old items",
    ],
    tags:           ["notifications", "realtime", "email"],
    installTimeSec: 40,
    installs:       420,
    rating:         4.5,
    createdAt:      "2026-02-01T00:00:00Z",
    updatedAt:      "2026-02-15T00:00:00Z",
  },
  {
    id:          "ai-chat-widget",
    name:        "AI Chat Widget",
    tagline:     "Embeddable Javari AI chat widget",
    description: "A polished, embeddable chat widget powered by Javari AI. Supports streaming responses, conversation history, file uploads, and white-label customization.",
    category:    "ai-tools",
    status:      "stable",
    requiredTier: "creator",
    complexity:  "standard",
    auth:        "optional",
    version:     "1.0.0",
    author:      "CR AudioViz AI",
    fileTree: [
      { path: "app/api/widget/chat/route.ts",      category: "api_route", lines: 140 },
      { path: "components/widget/ChatWidget.tsx",  category: "component", lines: 280 },
      { path: "components/widget/ChatMessage.tsx", category: "component", lines: 100 },
      { path: "lib/types/widget.ts",               category: "type",      lines: 60  },
    ],
    features: [
      "SSE streaming responses",
      "Conversation history",
      "File/image uploads",
      "Customizable branding",
      "Embeddable via script tag",
      "Mobile responsive",
    ],
    tags:           ["chat", "widget", "ai", "embeddable"],
    installTimeSec: 35,
    installs:       1800,
    rating:         4.9,
    createdAt:      "2026-01-12T00:00:00Z",
    updatedAt:      "2026-02-12T00:00:00Z",
  },
];

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getModuleById(id: string): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

export function getModulesByCategory(category: ModuleCategory): ModuleRegistryEntry[] {
  return MODULE_REGISTRY.filter((m) => m.category === category);
}

export function getModulesByTier(tier: RequiredTier): ModuleRegistryEntry[] {
  const tierOrder = { free: 0, creator: 1, pro: 2, enterprise: 3 };
  return MODULE_REGISTRY.filter((m) => tierOrder[m.requiredTier] <= tierOrder[tier]);
}

export function searchModules(query: string): ModuleRegistryEntry[] {
  const q = query.toLowerCase();
  return MODULE_REGISTRY.filter((m) =>
    m.name.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    m.tags.some((t) => t.includes(q)) ||
    m.category.includes(q)
  );
}

export function getCategories(): ModuleCategory[] {
  return [...new Set(MODULE_REGISTRY.map((m) => m.category))];
}

export function getStats() {
  return {
    totalModules:  MODULE_REGISTRY.length,
    stableModules: MODULE_REGISTRY.filter((m) => m.status === "stable").length,
    totalInstalls: MODULE_REGISTRY.reduce((s, m) => s + m.installs, 0),
    avgRating:     (MODULE_REGISTRY.reduce((s, m) => s + m.rating, 0) / MODULE_REGISTRY.length).toFixed(1),
    categories:    getCategories().length,
  };
}
