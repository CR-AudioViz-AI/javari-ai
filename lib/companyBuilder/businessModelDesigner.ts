// lib/companyBuilder/businessModelDesigner.ts
// Purpose: Generates complete business model specifications: pricing tiers,
//          revenue streams, unit economics, growth strategy, and financial projections.
// Date: 2026-03-08

import { runOrchestrator }  from "@/lib/orchestrator/orchestrator";
import type { CompanyPlan } from "./companyPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PricingTier {
  name          : string;
  monthlyPrice  : number;
  annualPrice   : number;
  currency      : "USD";
  features      : string[];
  limits        : Record<string, number | string>;
  highlighted   : boolean;
  ctaText       : string;
  stripePriceId?: string;
}

export interface RevenueStream {
  name          : string;
  type          : "subscription" | "usage" | "one_time" | "marketplace" | "enterprise" | "affiliate";
  description   : string;
  estimatedMRR  : number;
  growthRate    : number;   // monthly %
  margin        : number;   // %
}

export interface UnitEconomics {
  avgRevenuePerUser     : number;
  estimatedCAC          : number;
  estimatedLTV          : number;
  ltvCacRatio           : number;
  grossMargin           : number;
  paybackPeriodMonths   : number;
}

export interface GrowthStrategy {
  channel       : string;
  tactic        : string;
  estimatedCost : number;
  expectedReach : number;
  priority      : "high" | "medium" | "low";
}

export interface FinancialProjection {
  month         : number;
  mrr           : number;
  customers     : number;
  churnRate     : number;
  arr           : number;
}

export interface BusinessModel {
  companyName       : string;
  pricing           : PricingTier[];
  revenueStreams     : RevenueStream[];
  unitEconomics     : UnitEconomics;
  growthStrategy    : GrowthStrategy[];
  projections       : FinancialProjection[];
  tokenSystem?      : TokenSystem;
  affiliateProgram? : AffiliateProgram;
  enterpriseModel?  : EnterpriseModel;
  totalMRR12Month   : number;
  totalARR12Month   : number;
  breakEvenMonth    : number;
  generatedAt       : string;
}

export interface TokenSystem {
  enabled       : boolean;
  name          : string;
  creditsPerTier: Record<string, number>;
  rollover      : boolean;
  purchasable   : boolean;
  pricePerCredit: number;
}

export interface AffiliateProgram {
  enabled       : boolean;
  commissionRate: number;   // %
  cookieDays    : number;
  minPayout     : number;
  payoutSchedule: string;
}

export interface EnterpriseModel {
  enabled         : boolean;
  minContract     : number;
  features        : string[];
  slaUptime       : string;
  dedicatedSupport: boolean;
  customContracts : boolean;
}

// ── Default pricing by industry ────────────────────────────────────────────

function buildDefaultTiers(plan: CompanyPlan): PricingTier[] {
  const isAI   = plan.industry.toLowerCase().includes("ai") || plan.industry.toLowerCase().includes("developer");
  const isB2B  = (plan.target_users ?? "").toLowerCase().includes("b2b") || (plan.target_users ?? "").toLowerCase().includes("business");

  if (isAI) {
    return [
      {
        name: "Starter", monthlyPrice: 0, annualPrice: 0, currency: "USD",
        features: ["100 AI generations/mo", "1 project", "Community support", "API access (limited)"],
        limits: { generations: 100, projects: 1, api_calls: 500 },
        highlighted: false, ctaText: "Start Free",
      },
      {
        name: "Pro", monthlyPrice: 39, annualPrice: 390, currency: "USD",
        features: ["5,000 AI generations/mo", "10 projects", "Priority support", "Full API access", "Custom workflows"],
        limits: { generations: 5000, projects: 10, api_calls: 50000 },
        highlighted: true, ctaText: "Start Pro Trial",
      },
      {
        name: "Scale", monthlyPrice: 149, annualPrice: 1490, currency: "USD",
        features: ["50,000 AI generations/mo", "Unlimited projects", "Dedicated support", "Team seats (10)", "Audit logs"],
        limits: { generations: 50000, projects: -1, api_calls: -1, seats: 10 },
        highlighted: false, ctaText: "Start Scale",
      },
      {
        name: "Enterprise", monthlyPrice: 599, annualPrice: 5990, currency: "USD",
        features: ["Unlimited AI generations", "Unlimited everything", "SSO/SAML", "SLA 99.9%", "Custom integrations", "Dedicated CSM"],
        limits: { generations: -1, projects: -1, api_calls: -1, seats: -1 },
        highlighted: false, ctaText: "Contact Sales",
      },
    ];
  }

  return [
    {
      name: "Free", monthlyPrice: 0, annualPrice: 0, currency: "USD",
      features: ["Up to 3 projects", "1 user", "Basic features", "Community support"],
      limits: { projects: 3, users: 1, storage_gb: 1 },
      highlighted: false, ctaText: "Get Started Free",
    },
    {
      name: "Pro", monthlyPrice: 29, annualPrice: 290, currency: "USD",
      features: ["Unlimited projects", "5 users", "All features", "Priority email support", "API access"],
      limits: { projects: -1, users: 5, storage_gb: 50 },
      highlighted: true, ctaText: "Start 14-Day Trial",
    },
    {
      name: "Team", monthlyPrice: 99, annualPrice: 990, currency: "USD",
      features: ["Everything in Pro", "25 users", "Advanced analytics", "Custom domain", "Slack support"],
      limits: { projects: -1, users: 25, storage_gb: 200 },
      highlighted: false, ctaText: "Start Team Trial",
    },
    {
      name: "Enterprise", monthlyPrice: 499, annualPrice: 4990, currency: "USD",
      features: ["Everything in Team", "Unlimited users", "SSO/SAML", "99.9% SLA", "Dedicated CSM"],
      limits: { projects: -1, users: -1, storage_gb: -1 },
      highlighted: false, ctaText: "Contact Sales",
    },
  ];
}

// ── Financial projections ──────────────────────────────────────────────────

function buildProjections(tiers: PricingTier[]): FinancialProjection[] {
  const avgPrice = tiers.filter(t => t.monthlyPrice > 0).reduce((s, t) => s + t.monthlyPrice, 0) /
                   Math.max(1, tiers.filter(t => t.monthlyPrice > 0).length);
  const projections: FinancialProjection[] = [];
  let customers = 10, mrr = 0;

  for (let month = 1; month <= 24; month++) {
    const newCustomers = Math.floor(customers * 0.25);
    const churned      = Math.floor(customers * 0.05);
    customers = customers + newCustomers - churned;
    mrr = customers * avgPrice;
    projections.push({ month, mrr: Math.round(mrr), customers, churnRate: 5, arr: Math.round(mrr * 12) });
  }
  return projections;
}

// ── Main designer ──────────────────────────────────────────────────────────

export async function designBusinessModel(plan: CompanyPlan): Promise<BusinessModel> {
  const generatedAt = new Date().toISOString();

  // Try AI enrichment for revenue streams
  let aiStreams: RevenueStream[] = [];
  try {
    const r = await runOrchestrator({
      task_type: "general_analysis",
      priority : "cost",
      prompt   : `For "${plan.companyName}" in ${plan.industry}, suggest 4 revenue streams as JSON array only:
[{"name":"","type":"subscription|usage|marketplace|enterprise","description":"","estimatedMRR":0,"growthRate":5,"margin":70}]
JSON only, no explanation.`,
      max_models: 1,
    });
    const raw = r.final_answer.replace(/```json|```/g, "").trim();
    const s = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s > -1 && e > s) aiStreams = JSON.parse(raw.slice(s, e + 1)) as RevenueStream[];
  } catch { /* use defaults */ }

  const pricing = buildDefaultTiers(plan);
  const projections = buildProjections(pricing);
  const totalMRR12 = projections[11]?.mrr ?? 0;

  const revenueStreams: RevenueStream[] = aiStreams.length > 0 ? aiStreams : [
    { name: "Subscriptions",     type: "subscription", description: "Monthly/annual SaaS tiers", estimatedMRR: totalMRR12 * 0.70, growthRate: 15, margin: 80 },
    { name: "Usage Overage",     type: "usage",        description: "Pay-as-you-go above tier limits", estimatedMRR: totalMRR12 * 0.15, growthRate: 20, margin: 85 },
    { name: "Enterprise",        type: "enterprise",   description: "Custom contracts for large accounts", estimatedMRR: totalMRR12 * 0.10, growthRate: 25, margin: 70 },
    { name: "Marketplace",       type: "marketplace",  description: "Third-party integrations revenue share", estimatedMRR: totalMRR12 * 0.05, growthRate: 30, margin: 90 },
  ];

  const avgPrice  = pricing.filter(t => t.monthlyPrice > 0).reduce((s, t) => s + t.monthlyPrice, 0) / Math.max(1, pricing.filter(t => t.monthlyPrice > 0).length);
  const unitEcon: UnitEconomics = {
    avgRevenuePerUser   : Math.round(avgPrice),
    estimatedCAC        : Math.round(avgPrice * 3),
    estimatedLTV        : Math.round(avgPrice * 24 * 0.92),
    ltvCacRatio         : Math.round((avgPrice * 24 * 0.92) / (avgPrice * 3) * 10) / 10,
    grossMargin         : 78,
    paybackPeriodMonths : 3,
  };

  const growthStrategy: GrowthStrategy[] = [
    { channel: "Product-Led Growth", tactic: "Free tier → upgrade nudges, in-app virality", estimatedCost: 500, expectedReach: 5000, priority: "high" },
    { channel: "Content Marketing",  tactic: "SEO blog posts, YouTube tutorials, documentation SEO", estimatedCost: 1000, expectedReach: 20000, priority: "high" },
    { channel: "Developer Community",tactic: "GitHub, Discord, Hacker News, Dev.to posts", estimatedCost: 200, expectedReach: 10000, priority: "high" },
    { channel: "Paid Ads",           tactic: "Google Ads targeting {pain point} keywords", estimatedCost: 3000, expectedReach: 50000, priority: "medium" },
    { channel: "Partnerships",       tactic: "Integration marketplace, co-marketing with complementary tools", estimatedCost: 500, expectedReach: 15000, priority: "medium" },
    { channel: "Affiliate Program",  tactic: "30% recurring commission for referrals", estimatedCost: 0, expectedReach: 8000, priority: "medium" },
  ];

  const breakEvenMonth = projections.findIndex(p => p.mrr > 5000) + 1;

  return {
    companyName   : plan.companyName,
    pricing,
    revenueStreams,
    unitEconomics : unitEcon,
    growthStrategy,
    projections,
    tokenSystem: {
      enabled       : true,
      name          : `${plan.companyName} Credits`,
      creditsPerTier: { Free: 100, Pro: 5000, Scale: 50000, Enterprise: -1 },
      rollover      : true,
      purchasable   : true,
      pricePerCredit: 0.01,
    },
    affiliateProgram: {
      enabled       : true,
      commissionRate: 30,
      cookieDays    : 90,
      minPayout     : 50,
      payoutSchedule: "monthly",
    },
    enterpriseModel: {
      enabled         : true,
      minContract     : 5988,
      features        : ["SSO/SAML", "Audit logs export", "Custom SLA", "Dedicated instance", "Priority security patches"],
      slaUptime       : "99.9%",
      dedicatedSupport: true,
      customContracts : true,
    },
    totalMRR12Month: totalMRR12,
    totalARR12Month: totalMRR12 * 12,
    breakEvenMonth : breakEvenMonth > 0 ? breakEvenMonth : 12,
    generatedAt,
  };
}
