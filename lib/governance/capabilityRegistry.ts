// lib/governance/capabilityRegistry.ts
// Purpose: Canonical capability registry for the CR AudioViz AI ecosystem.
//          Registers every capability and the authoritative system that owns it.
//          Before any new module is built, this registry is checked to prevent
//          duplication. Any capability not in this registry requires registration
//          approval through the governance engine.
// Date: 2026-03-09

import { createClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type CapabilityOwner =
  | "CRAudioVizAI_Core"   // platform infrastructure
  | "Javari_AI"           // intelligence + autonomous execution
  | "Document_Studio"
  | "Javari_Spirits"
  | "Javari_Cards"
  | "Javari_Key"
  | "Site_Auditor"
  | "CRAIverse"
  | "External";           // third-party / no internal owner

export interface Capability {
  id          : string;   // snake_case identifier
  label       : string;   // human-readable
  owner       : CapabilityOwner;
  description : string;
  category    : CapabilityCategory;
  exclusive   : boolean;  // if true, no other system may implement this
  added_at    : string;
}

export type CapabilityCategory =
  | "infrastructure"
  | "intelligence"
  | "payment"
  | "auth"
  | "storage"
  | "analytics"
  | "content"
  | "communication"
  | "security"
  | "ai_model"
  | "crawler"
  | "repair"
  | "learning"
  | "marketplace"
  | "social";

// ── Canonical capability registry ─────────────────────────────────────────

export const CAPABILITY_REGISTRY: Capability[] = [
  // ── CRAudioVizAI Core ────────────────────────────────────────────────────
  { id:"auth",                   label:"Authentication & Authorization",     owner:"CRAudioVizAI_Core", category:"auth",           exclusive:true,  description:"User login, OAuth, sessions, permissions",                    added_at:"2026-03-09" },
  { id:"payments",               label:"Payment Processing",                 owner:"CRAudioVizAI_Core", category:"payment",        exclusive:true,  description:"Stripe + PayPal subscriptions, one-time, refunds",           added_at:"2026-03-09" },
  { id:"credits",                label:"Platform Credits",                   owner:"CRAudioVizAI_Core", category:"payment",        exclusive:true,  description:"Universal credit system, auto-refunds, expiry policies",     added_at:"2026-03-09" },
  { id:"subscriptions",          label:"Subscription Management",            owner:"CRAudioVizAI_Core", category:"payment",        exclusive:true,  description:"Subscription tiers, upgrades, billing cycles",               added_at:"2026-03-09" },
  { id:"projects",               label:"Project Management",                 owner:"CRAudioVizAI_Core", category:"infrastructure", exclusive:true,  description:"User projects, workspaces, access control",                  added_at:"2026-03-09" },
  { id:"ticketing",              label:"Support Ticketing",                  owner:"CRAudioVizAI_Core", category:"communication",  exclusive:true,  description:"Customer support tickets, SLA tracking",                     added_at:"2026-03-09" },
  { id:"crm",                    label:"CRM",                                owner:"CRAudioVizAI_Core", category:"analytics",      exclusive:true,  description:"Customer records, lifecycle, segmentation",                  added_at:"2026-03-09" },
  { id:"api_gateway",            label:"API Gateway",                        owner:"CRAudioVizAI_Core", category:"infrastructure", exclusive:true,  description:"Unified API routing, rate limiting, versioning",             added_at:"2026-03-09" },
  { id:"notifications",          label:"Notification System",                owner:"CRAudioVizAI_Core", category:"communication",  exclusive:true,  description:"Email, push, in-app, webhook notifications",                 added_at:"2026-03-09" },
  { id:"storage",                label:"Asset Storage",                      owner:"CRAudioVizAI_Core", category:"storage",        exclusive:true,  description:"R2/S3 file storage, CDN delivery",                           added_at:"2026-03-09" },
  { id:"analytics",              label:"Platform Analytics",                 owner:"CRAudioVizAI_Core", category:"analytics",      exclusive:false, description:"Usage metrics, event tracking, conversion funnels",          added_at:"2026-03-09" },
  { id:"admin",                  label:"Admin Dashboard",                    owner:"CRAudioVizAI_Core", category:"infrastructure", exclusive:true,  description:"Super-admin controls, feature flags, user management",       added_at:"2026-03-09" },
  { id:"audit_logging",          label:"Audit Logging",                      owner:"CRAudioVizAI_Core", category:"security",       exclusive:true,  description:"Tamper-proof audit trail for all platform actions",          added_at:"2026-03-09" },
  { id:"security",               label:"Platform Security",                  owner:"CRAudioVizAI_Core", category:"security",       exclusive:false, description:"OWASP compliance, WAF, threat detection",                    added_at:"2026-03-09" },

  // ── Javari AI ────────────────────────────────────────────────────────────
  { id:"ai_reasoning",           label:"AI Reasoning & Inference",           owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"Multi-model LLM orchestration, routing, ensemble voting",    added_at:"2026-03-09" },
  { id:"model_orchestration",    label:"Model Orchestration",                owner:"Javari_AI",         category:"ai_model",       exclusive:true,  description:"283+ models, 14 providers, cost optimization, benchmarking", added_at:"2026-03-09" },
  { id:"learning_system",        label:"Learning & Experience System",       owner:"Javari_AI",         category:"learning",       exclusive:true,  description:"Domain scoring, memory graph, knowledge accumulation",       added_at:"2026-03-09" },
  { id:"memory_graph",           label:"Memory Graph",                       owner:"Javari_AI",         category:"learning",       exclusive:true,  description:"795+ nodes, issue/fix/technology relationship graph",        added_at:"2026-03-09" },
  { id:"code_generation",        label:"Code Generation",                    owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"TypeScript/Python code synthesis, file generation",          added_at:"2026-03-09" },
  { id:"code_repair",            label:"Code Repair Engine",                 owner:"Javari_AI",         category:"repair",         exclusive:true,  description:"Automated bug detection and repair with verification",       added_at:"2026-03-09" },
  { id:"system_analysis",        label:"System Analysis",                    owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"Repo scanning, dependency analysis, architecture mapping",   added_at:"2026-03-09" },
  { id:"roadmap_execution",      label:"Autonomous Roadmap Execution",       owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"Task queue, lifecycle management, artifact recording",       added_at:"2026-03-09" },
  { id:"company_building",       label:"Autonomous Company Builder",         owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"Idea → market analysis → architecture → repo → deploy",      added_at:"2026-03-09" },
  { id:"site_crawling",          label:"Website Crawling",                   owner:"Javari_AI",         category:"crawler",        exclusive:true,  description:"Full-site crawl, DOM analysis, API mapping",                 added_at:"2026-03-09" },
  { id:"security_auditing",      label:"Security Auditing",                  owner:"Javari_AI",         category:"security",       exclusive:false, description:"OWASP scanning, header analysis, vulnerability detection",   added_at:"2026-03-09" },
  { id:"performance_auditing",   label:"Performance Auditing",               owner:"Javari_AI",         category:"crawler",        exclusive:false, description:"Core Web Vitals, bundle analysis, LCP/CLS/FID detection",   added_at:"2026-03-09" },
  { id:"technology_detection",   label:"Technology Detection",               owner:"Javari_AI",         category:"intelligence",   exclusive:true,  description:"Framework/CMS/auth/payments detection from crawl data",      added_at:"2026-03-09" },

  // ── Specialized Apps ─────────────────────────────────────────────────────
  { id:"document_generation",    label:"Document Generation",                owner:"Document_Studio",   category:"content",        exclusive:true,  description:"PDF, DOCX, presentations, reports with brand templates",     added_at:"2026-03-09" },
  { id:"alcohol_database",       label:"Alcohol Product Database",           owner:"Javari_Spirits",    category:"marketplace",    exclusive:true,  description:"Wine, spirits, beer catalog, ratings, affiliate links",      added_at:"2026-03-09" },
  { id:"greeting_cards",         label:"Greeting Card Creation",             owner:"Javari_Cards",      category:"content",        exclusive:true,  description:"AI-generated card designs, templates, personalization",      added_at:"2026-03-09" },
  { id:"password_management",    label:"Password & Secrets Management",      owner:"Javari_Key",        category:"security",       exclusive:true,  description:"Encrypted password vault, sharing, breach detection",        added_at:"2026-03-09" },
  { id:"website_audit_reports",  label:"Website Audit Reports",              owner:"Site_Auditor",      category:"analytics",      exclusive:true,  description:"Client-facing audit reports, scores, recommendations",       added_at:"2026-03-09" },
  { id:"virtual_world",          label:"CRAIverse Virtual World",            owner:"CRAIverse",         category:"social",         exclusive:true,  description:"Avatar-based communities, virtual real estate, social impact",added_at:"2026-03-09" },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

export function getCapability(id: string): Capability | undefined {
  return CAPABILITY_REGISTRY.find(c => c.id === id);
}

export function getCapabilitiesByOwner(owner: CapabilityOwner): Capability[] {
  return CAPABILITY_REGISTRY.filter(c => c.owner === owner);
}

export function getCapabilitiesByCategory(category: CapabilityCategory): Capability[] {
  return CAPABILITY_REGISTRY.filter(c => c.category === category);
}

export function isCapabilityExclusive(id: string): boolean {
  return CAPABILITY_REGISTRY.find(c => c.id === id)?.exclusive ?? false;
}

/**
 * checkCapabilityConflict — before building a new feature, check if the
 * capability is already exclusively owned by another system.
 */
export function checkCapabilityConflict(
  capabilityId : string,
  requestingOwner: CapabilityOwner
): { conflict: boolean; existingOwner?: CapabilityOwner; message?: string } {
  const cap = getCapability(capabilityId);
  if (!cap) return { conflict: false };

  if (cap.exclusive && cap.owner !== requestingOwner) {
    return {
      conflict: true,
      existingOwner: cap.owner,
      message: `Capability "${cap.label}" is exclusively owned by ${cap.owner}. ${requestingOwner} must delegate to ${cap.owner} rather than re-implementing it.`,
    };
  }
  return { conflict: false };
}

/**
 * registryStats — summary for governance dashboard
 */
export function registryStats(): {
  total: number;
  byOwner: Record<string, number>;
  byCategory: Record<string, number>;
  exclusiveCount: number;
} {
  const byOwner: Record<string, number>    = {};
  const byCategory: Record<string, number> = {};
  let exclusiveCount = 0;

  for (const c of CAPABILITY_REGISTRY) {
    byOwner[c.owner]       = (byOwner[c.owner] ?? 0) + 1;
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    if (c.exclusive) exclusiveCount++;
  }
  return { total: CAPABILITY_REGISTRY.length, byOwner, byCategory, exclusiveCount };
}
