// lib/governance/systemOwnership.ts
// Purpose: Defines the authoritative ownership boundary for each system in the
//          CR AudioViz AI ecosystem. Enforces the hub-and-spoke architecture rule:
//          all apps communicate through CRAudioVizAI Core API Gateway; no direct
//          app-to-app calls. Javari AI provides intelligence to the Core.
// Date: 2026-03-09

import { CAPABILITY_REGISTRY, CapabilityOwner, Capability } from "./capabilityRegistry";

// ── System definitions ─────────────────────────────────────────────────────

export interface SystemDefinition {
  id             : string;
  name           : string;
  type           : "core" | "intelligence" | "app" | "tool";
  description    : string;
  repo?          : string;
  domain?        : string;
  communicatesVia: "api_gateway" | "direct" | "none";
  /** Systems this system is allowed to call directly */
  allowedDeps    : string[];
  /** Capabilities this system owns */
  capabilities   : string[];
}

export const SYSTEM_REGISTRY: SystemDefinition[] = [
  {
    id             : "CRAudioVizAI_Core",
    name           : "CRAudioVizAI Core",
    type           : "core",
    description    : "Platform infrastructure hub. All apps communicate through this system.",
    repo           : "CR-AudioViz-AI/craudiovizai",
    domain         : "craudiovizai.com",
    communicatesVia: "direct",
    allowedDeps    : ["Javari_AI"],
    capabilities   : ["auth","payments","credits","subscriptions","projects","ticketing",
                      "crm","api_gateway","notifications","storage","analytics","admin",
                      "audit_logging","security"],
  },
  {
    id             : "Javari_AI",
    name           : "Javari AI",
    type           : "intelligence",
    description    : "Autonomous intelligence layer. Provides AI reasoning, repair, learning, and autonomous execution to the entire ecosystem.",
    repo           : "CR-AudioViz-AI/javari-ai",
    domain         : "javariai.com",
    communicatesVia: "direct",
    allowedDeps    : ["CRAudioVizAI_Core"],
    capabilities   : ["ai_reasoning","model_orchestration","learning_system","memory_graph",
                      "code_generation","code_repair","system_analysis","roadmap_execution",
                      "company_building","site_crawling","security_auditing",
                      "performance_auditing","technology_detection"],
  },
  {
    id             : "Document_Studio",
    name           : "Document Studio",
    type           : "app",
    description    : "Specialized document generation app.",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core", "Javari_AI"],
    capabilities   : ["document_generation"],
  },
  {
    id             : "Javari_Spirits",
    name           : "Javari Spirits",
    type           : "app",
    description    : "Alcohol affiliate app (formerly CravBarrels).",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core"],
    capabilities   : ["alcohol_database"],
  },
  {
    id             : "Javari_Cards",
    name           : "Javari Cards",
    type           : "app",
    description    : "AI-powered greeting card creation app.",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core", "Javari_AI"],
    capabilities   : ["greeting_cards"],
  },
  {
    id             : "Javari_Key",
    name           : "Javari Key",
    type           : "app",
    description    : "Password and secrets management app.",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core"],
    capabilities   : ["password_management"],
  },
  {
    id             : "Site_Auditor",
    name           : "Site Auditor",
    type           : "app",
    description    : "Client-facing website audit report generator.",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core", "Javari_AI"],
    capabilities   : ["website_audit_reports"],
  },
  {
    id             : "CRAIverse",
    name           : "CRAIverse Virtual World",
    type           : "app",
    description    : "Avatar-based virtual world with social impact modules.",
    communicatesVia: "api_gateway",
    allowedDeps    : ["CRAudioVizAI_Core", "Javari_AI"],
    capabilities   : ["virtual_world"],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

export function getSystem(id: string): SystemDefinition | undefined {
  return SYSTEM_REGISTRY.find(s => s.id === id);
}

/**
 * validateCommunicationPath — checks whether system A is allowed to call system B.
 * Enforces hub-and-spoke: apps may only call through API Gateway, never each other.
 */
export function validateCommunicationPath(
  fromSystemId: string,
  toSystemId  : string
): { valid: boolean; reason?: string } {
  const from = getSystem(fromSystemId);
  const to   = getSystem(toSystemId);
  if (!from) return { valid: false, reason: `Unknown source system: ${fromSystemId}` };
  if (!to)   return { valid: false, reason: `Unknown target system: ${toSystemId}` };

  // Core and Intelligence can communicate directly
  if (from.type === "core" || from.type === "intelligence") {
    return { valid: true };
  }

  // Apps may only call their allowedDeps
  if (!from.allowedDeps.includes(toSystemId)) {
    return {
      valid: false,
      reason: `${from.name} (app) may not directly call ${to.name}. Route through CRAudioVizAI_Core API Gateway.`,
    };
  }

  return { valid: true };
}

/**
 * getCapabilityOwner — returns the system that should handle a given capability.
 * Use this before implementing anything to find the authoritative owner.
 */
export function getCapabilityOwner(capabilityId: string): SystemDefinition | undefined {
  const cap = CAPABILITY_REGISTRY.find(c => c.id === capabilityId);
  if (!cap) return undefined;
  return SYSTEM_REGISTRY.find(s => s.id === cap.owner);
}

/**
 * systemOwnershipReport — full ownership breakdown for the governance dashboard
 */
export function systemOwnershipReport(): Array<{
  system: string;
  type: string;
  capabilityCount: number;
  capabilities: string[];
  communicatesVia: string;
}> {
  return SYSTEM_REGISTRY.map(s => ({
    system         : s.name,
    type           : s.type,
    capabilityCount: s.capabilities.length,
    capabilities   : s.capabilities,
    communicatesVia: s.communicatesVia,
  }));
}
