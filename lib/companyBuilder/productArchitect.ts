// lib/companyBuilder/productArchitect.ts
// Purpose: Generates full product architecture specs from a CompanyPlan.
//          Produces database schemas, API contracts, service definitions,
//          integration maps, and component trees ready for code generation.
// Date: 2026-03-08

import { runOrchestrator }    from "@/lib/orchestrator/orchestrator";
import type { CompanyPlan }   from "./companyPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DatabaseTable {
  name       : string;
  columns    : Array<{ name: string; type: string; nullable: boolean; default?: string }>;
  indexes    : string[];
  rls        : boolean;
}

export interface APIEndpoint {
  method : "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path   : string;
  auth   : boolean;
  body?  : Record<string, string>;
  returns: string;
}

export interface ServiceDefinition {
  name        : string;
  type        : "internal" | "external" | "third_party";
  description : string;
  endpoints?  : string[];
  env_vars    : string[];
}

export interface ProductArchitecture {
  companyName   : string;
  frontend      : FrontendSpec;
  backend       : BackendSpec;
  database      : DatabaseSpec;
  auth          : AuthSpec;
  payments      : PaymentSpec;
  ai_layer      : AILayerSpec;
  infrastructure: InfraSpec;
  services      : ServiceDefinition[];
  integrations  : IntegrationSpec[];
  security      : SecuritySpec;
  monitoring    : MonitoringSpec;
  folderStructure: string[];
  envVars       : EnvVarSpec[];
  architectId   : string;
}

export interface FrontendSpec {
  framework   : string;
  pages       : string[];
  components  : string[];
  stateManager: string;
  styling     : string;
  animations  : string;
}

export interface BackendSpec {
  runtime   : string;
  apiStyle  : string;
  middleware: string[];
  rateLimiting: string;
  caching   : string;
}

export interface DatabaseSpec {
  engine  : string;
  tables  : DatabaseTable[];
  orm     : string;
  migrations: string;
  backups : string;
}

export interface AuthSpec {
  provider    : string;
  methods     : string[];
  sessionStore: string;
  mfa         : boolean;
  rbac        : string;
}

export interface PaymentSpec {
  provider     : string;
  tiers        : Array<{ name: string; price: number; interval: string; features: string[] }>;
  webhooks     : string[];
  portalEnabled: boolean;
}

export interface AILayerSpec {
  orchestrator : string;
  models       : string[];
  vectorStore  : string;
  ragEnabled   : boolean;
}

export interface InfraSpec {
  hosting    : string;
  regions    : string[];
  cicd       : string;
  containers : boolean;
  cdn        : string;
}

export interface IntegrationSpec {
  name    : string;
  type    : string;
  purpose : string;
  required: boolean;
}

export interface SecuritySpec {
  headers    : string[];
  csp        : boolean;
  rateLimit  : string;
  owasp      : string[];
  scanning   : string;
}

export interface MonitoringSpec {
  analytics  : string;
  errorTrack : string;
  uptime     : string;
  logging    : string;
  alerts     : string[];
}

export interface EnvVarSpec {
  key       : string;
  required  : boolean;
  secret    : boolean;
  example   : string;
}

// ── Core database tables for any SaaS ─────────────────────────────────────

function buildCoreTables(companyName: string): DatabaseTable[] {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return [
    {
      name: "users", rls: true,
      columns: [
        { name: "id",         type: "uuid",        nullable: false, default: "gen_random_uuid()" },
        { name: "email",      type: "text",        nullable: false },
        { name: "full_name",  type: "text",        nullable: true  },
        { name: "avatar_url", type: "text",        nullable: true  },
        { name: "role",       type: "text",        nullable: false, default: "'user'" },
        { name: "plan",       type: "text",        nullable: false, default: "'free'" },
        { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
        { name: "updated_at", type: "timestamptz", nullable: false, default: "now()" },
      ],
      indexes: ["email", "role", "plan"],
    },
    {
      name: "subscriptions", rls: true,
      columns: [
        { name: "id",                 type: "uuid",        nullable: false, default: "gen_random_uuid()" },
        { name: "user_id",            type: "uuid",        nullable: false },
        { name: "stripe_customer_id", type: "text",        nullable: true  },
        { name: "stripe_sub_id",      type: "text",        nullable: true  },
        { name: "plan",               type: "text",        nullable: false, default: "'free'" },
        { name: "status",             type: "text",        nullable: false, default: "'active'" },
        { name: "current_period_end", type: "timestamptz", nullable: true  },
        { name: "created_at",         type: "timestamptz", nullable: false, default: "now()" },
      ],
      indexes: ["user_id", "stripe_customer_id", "status"],
    },
    {
      name: "api_keys", rls: true,
      columns: [
        { name: "id",         type: "uuid",        nullable: false, default: "gen_random_uuid()" },
        { name: "user_id",    type: "uuid",        nullable: false },
        { name: "key_hash",   type: "text",        nullable: false },
        { name: "name",       type: "text",        nullable: false },
        { name: "last_used",  type: "timestamptz", nullable: true  },
        { name: "expires_at", type: "timestamptz", nullable: true  },
        { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      ],
      indexes: ["user_id", "key_hash"],
    },
    {
      name: "audit_logs", rls: false,
      columns: [
        { name: "id",         type: "bigserial",   nullable: false },
        { name: "user_id",    type: "uuid",        nullable: true  },
        { name: "action",     type: "text",        nullable: false },
        { name: "resource",   type: "text",        nullable: false },
        { name: "metadata",   type: "jsonb",       nullable: false, default: "'{}'" },
        { name: "ip_address", type: "text",        nullable: true  },
        { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      ],
      indexes: ["user_id", "action", "created_at"],
    },
    {
      name: `${slug}_usage`, rls: true,
      columns: [
        { name: "id",         type: "uuid",        nullable: false, default: "gen_random_uuid()" },
        { name: "user_id",    type: "uuid",        nullable: false },
        { name: "feature",    type: "text",        nullable: false },
        { name: "units",      type: "integer",     nullable: false, default: "1" },
        { name: "metadata",   type: "jsonb",       nullable: false, default: "'{}'" },
        { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
      ],
      indexes: ["user_id", "feature", "created_at"],
    },
  ];
}

// ── Core pages for any SaaS ────────────────────────────────────────────────

function buildCorePages(companyName: string): string[] {
  return [
    "/ (landing page with pricing)",
    "/login (auth)",
    "/signup (auth + onboarding)",
    "/dashboard (main app)",
    "/dashboard/settings (profile + billing)",
    "/dashboard/api-keys (key management)",
    "/dashboard/usage (consumption analytics)",
    "/pricing (public pricing page)",
    "/docs (documentation portal)",
    "/admin (super-admin panel)",
    "/api/v1/* (REST API)",
    "/api/webhooks/stripe (Stripe webhook handler)",
  ];
}

// ── Main architect ─────────────────────────────────────────────────────────

export async function designProductArchitecture(plan: CompanyPlan): Promise<ProductArchitecture> {
  const architectId = `arch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Optionally enrich with AI for industry-specific services
  let aiServices: ServiceDefinition[] = [];
  try {
    const r = await runOrchestrator({
      task_type: "architecture_design",
      priority : "cost",
      prompt   : `For a ${plan.industry} SaaS called "${plan.companyName}", list 5 key services as JSON array only:
[{"name":"","type":"internal|external","description":"","env_vars":[]}]
Features: ${plan.mvpFeatures.join(", ")}. No explanation, JSON only.`,
      max_models: 1,
    });
    const raw = r.final_answer.replace(/```json|```/g, "").trim();
    const start = raw.indexOf("["), end = raw.lastIndexOf("]");
    if (start > -1 && end > start) {
      aiServices = JSON.parse(raw.slice(start, end + 1)) as ServiceDefinition[];
    }
  } catch { /* use defaults */ }

  const isAI = plan.industry.toLowerCase().includes("ai") || plan.industry.toLowerCase().includes("developer");

  return {
    companyName   : plan.companyName,
    architectId,
    frontend: {
      framework   : "Next.js 14 App Router",
      pages       : buildCorePages(plan.companyName),
      components  : ["Navbar", "Sidebar", "DataTable", "StatCard", "Modal", "PricingCard", "CodeBlock", "LoadingState"],
      stateManager: "Zustand + React Query (TanStack)",
      styling     : "Tailwind CSS + shadcn/ui + CSS variables",
      animations  : "Framer Motion",
    },
    backend: {
      runtime     : "Node.js 20 + Next.js API Routes",
      apiStyle    : "REST /api/v1 + tRPC for internal calls",
      middleware  : ["auth guard", "rate limiter", "request logger", "CORS", "CSRF protection"],
      rateLimiting: "Upstash Redis rate limiter (100 req/min free, 1000 req/min paid)",
      caching     : "Next.js fetch cache + Supabase realtime",
    },
    database: {
      engine    : "Supabase PostgreSQL 15 + pgvector",
      tables    : buildCoreTables(plan.companyName),
      orm       : "Supabase JS client v2 with TypeScript types",
      migrations: "Supabase CLI migrations + auto-migration in API routes",
      backups   : "Supabase daily backups + point-in-time recovery",
    },
    auth: {
      provider    : "Supabase Auth",
      methods     : ["email/password", "Google OAuth", "GitHub OAuth", "magic link"],
      sessionStore: "Supabase JWT + HTTP-only cookie",
      mfa         : false,
      rbac        : "role column in users table (user/admin/super_admin)",
    },
    payments: {
      provider     : "Stripe",
      tiers        : [
        { name: "Free",       price: 0,   interval: "month", features: ["5 projects", "1 user", "Community support"] },
        { name: "Pro",        price: 29,  interval: "month", features: ["Unlimited projects", "5 users", "Priority support", "API access"] },
        { name: "Team",       price: 99,  interval: "month", features: ["Everything in Pro", "25 users", "Advanced analytics", "Custom domain"] },
        { name: "Enterprise", price: 499, interval: "month", features: ["Everything in Team", "Unlimited users", "SSO", "SLA", "Dedicated support"] },
      ],
      webhooks     : ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_succeeded", "invoice.payment_failed"],
      portalEnabled: true,
    },
    ai_layer: {
      orchestrator: isAI ? "Javari Multi-Model Orchestration Engine (79 models, 14 providers)" : "OpenAI API",
      models       : isAI ? ["claude-sonnet-4-20250514", "groq:llama-3.3-70b-versatile", "gemini-2.0-flash-exp"] : ["gpt-4o", "gpt-4o-mini"],
      vectorStore  : "Supabase pgvector (1536-dim OpenAI embeddings)",
      ragEnabled   : isAI,
    },
    infrastructure: {
      hosting  : "Vercel (serverless + edge)",
      regions  : ["iad1 (US East)", "sfo1 (US West)"],
      cicd     : "GitHub Actions → Vercel preview on PR, production on merge to main",
      containers: false,
      cdn      : "Vercel Edge Network + Cloudflare CDN",
    },
    services: aiServices.length > 0 ? aiServices : [
      { name: "AuthService",     type: "internal",    description: "User authentication and session management", env_vars: ["NEXTAUTH_SECRET", "SUPABASE_URL"] },
      { name: "BillingService",  type: "internal",    description: "Subscription management and payment processing", env_vars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
      { name: "NotificationService", type: "internal", description: "Email and in-app notifications", env_vars: ["RESEND_API_KEY"] },
      { name: "AnalyticsService", type: "internal",   description: "Usage tracking and business metrics", env_vars: [] },
      { name: "Stripe",          type: "third_party", description: "Payment processing", env_vars: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_KEY"] },
    ],
    integrations: [
      { name: "Stripe",   type: "payments",   purpose: "Subscription billing and payment processing", required: true },
      { name: "Resend",   type: "email",      purpose: "Transactional emails and notifications", required: true },
      { name: "Supabase", type: "database",   purpose: "Database, auth, and realtime", required: true },
      { name: "Vercel",   type: "hosting",    purpose: "Deployment and CDN", required: true },
      { name: "GitHub",   type: "vcs",        purpose: "Source control and CI/CD", required: true },
      { name: "PostHog",  type: "analytics",  purpose: "Product analytics and feature flags", required: false },
    ],
    security: {
      headers  : ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Strict-Transport-Security", "Referrer-Policy", "Permissions-Policy"],
      csp      : true,
      rateLimit: "100/min (free), 1000/min (paid), 10000/min (enterprise)",
      owasp    : ["SQL injection prevention via parameterized queries", "XSS prevention via CSP", "CSRF tokens", "Input validation with Zod"],
      scanning : "Javari autonomous security scanner",
    },
    monitoring: {
      analytics  : "Vercel Analytics + PostHog",
      errorTrack : "Sentry (errors) + Vercel logs",
      uptime     : "Vercel health checks + custom /api/health endpoint",
      logging    : "Structured JSON logging with correlation IDs",
      alerts     : ["P95 latency > 500ms", "Error rate > 1%", "Payment failures", "Auth failures spike"],
    },
    folderStructure: [
      "app/",
      "  (auth)/login/",
      "  (auth)/signup/",
      "  (dashboard)/dashboard/",
      "  (dashboard)/dashboard/settings/",
      "  (dashboard)/dashboard/api-keys/",
      "  (public)/pricing/",
      "  (public)/docs/",
      "  api/v1/",
      "  api/webhooks/",
      "lib/",
      "  auth/",
      "  billing/",
      "  database/",
      "  notifications/",
      "  analytics/",
      "components/",
      "  ui/ (shadcn)",
      "  layouts/",
      "  features/",
      "hooks/",
      "types/",
      "public/",
      "docs/",
      "tests/",
      "  unit/",
      "  integration/",
      "  e2e/",
    ],
    envVars: [
      { key: "NEXT_PUBLIC_SUPABASE_URL",    required: true,  secret: false, example: "https://xxx.supabase.co" },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, secret: false, example: "eyJ..." },
      { key: "SUPABASE_SERVICE_ROLE_KEY",   required: true,  secret: true,  example: "eyJ..." },
      { key: "NEXTAUTH_SECRET",             required: true,  secret: true,  example: "$(openssl rand -base64 32)" },
      { key: "NEXTAUTH_URL",                required: true,  secret: false, example: "https://app.example.com" },
      { key: "STRIPE_SECRET_KEY",           required: true,  secret: true,  example: "sk_live_..." },
      { key: "NEXT_PUBLIC_STRIPE_KEY",      required: true,  secret: false, example: "pk_live_..." },
      { key: "STRIPE_WEBHOOK_SECRET",       required: true,  secret: true,  example: "whsec_..." },
      { key: "RESEND_API_KEY",              required: false, secret: true,  example: "re_..." },
      { key: "GOOGLE_CLIENT_ID",            required: false, secret: false, example: "xxx.googleusercontent.com" },
      { key: "GOOGLE_CLIENT_SECRET",        required: false, secret: true,  example: "GOCSPX-..." },
    ],
  };
}
