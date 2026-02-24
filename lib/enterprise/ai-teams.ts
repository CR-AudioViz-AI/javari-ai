// lib/enterprise/ai-teams.ts
// CR AudioViz AI — Enterprise AI Teams Mode
// 2026-02-21 — STEP 10 Enterprise

export type TeamType = "marketing" | "engineering" | "ops" | "support" | "general";

export interface TeamRoutingConfig {
  teamType:          TeamType;
  displayName:       string;
  preferredProviders: string[];
  preferredModels:   string[];
  maxCostPerRequest: number;
  requireReasoning:  boolean;
  requireSpeed:      boolean;
  allowFallback:     boolean;
  systemPromptSuffix: string;
}

// ── Default team routing configs ──────────────────────────────────────────────

export const TEAM_CONFIGS: Record<TeamType, TeamRoutingConfig> = {
  marketing: {
    teamType:           "marketing",
    displayName:        "Marketing Team",
    preferredProviders: ["anthropic", "openai"],
    preferredModels:    ["claude-3-5-sonnet-20241022", "gpt-4o"],
    maxCostPerRequest:  0.10,
    requireReasoning:   false,
    requireSpeed:       true,
    allowFallback:      true,
    systemPromptSuffix: "Focus on engaging, persuasive, brand-consistent content. Maintain a professional yet approachable tone.",
  },
  engineering: {
    teamType:           "engineering",
    displayName:        "Engineering Team",
    preferredProviders: ["anthropic", "openai"],
    preferredModels:    ["claude-3-5-sonnet-20241022", "o4-mini"],
    maxCostPerRequest:  0.25,
    requireReasoning:   true,
    requireSpeed:       false,
    allowFallback:      true,
    systemPromptSuffix: "Prioritise technical accuracy, complete working code, and security best practices. Include TypeScript types.",
  },
  ops: {
    teamType:           "ops",
    displayName:        "Operations Team",
    preferredProviders: ["openai", "anthropic"],
    preferredModels:    ["gpt-4o-mini", "claude-3-5-haiku-20241022"],
    maxCostPerRequest:  0.05,
    requireReasoning:   false,
    requireSpeed:       true,
    allowFallback:      true,
    systemPromptSuffix: "Be concise and actionable. Focus on efficiency and operational clarity.",
  },
  support: {
    teamType:           "support",
    displayName:        "Support Team",
    preferredProviders: ["anthropic", "openai"],
    preferredModels:    ["claude-3-5-haiku-20241022", "gpt-4o-mini"],
    maxCostPerRequest:  0.03,
    requireReasoning:   false,
    requireSpeed:       true,
    allowFallback:      true,
    systemPromptSuffix: "Be empathetic, helpful, and clear. Always provide actionable solutions. Escalate unresolved issues.",
  },
  general: {
    teamType:           "general",
    displayName:        "General",
    preferredProviders: ["anthropic", "openai", "openrouter"],
    preferredModels:    ["claude-3-5-sonnet-20241022", "gpt-4o"],
    maxCostPerRequest:  0.15,
    requireReasoning:   false,
    requireSpeed:       false,
    allowFallback:      true,
    systemPromptSuffix: "",
  },
};

// ── Per-org overrides ─────────────────────────────────────────────────────────
// In production these would come from DB. In-process for now.

const _orgOverrides = new Map<string, Partial<Record<TeamType, Partial<TeamRoutingConfig>>>>();

export function getTeamConfig(
  teamType: TeamType,
  orgId?:   string
): TeamRoutingConfig {
  const base     = TEAM_CONFIGS[teamType];
  const override = orgId ? _orgOverrides.get(orgId)?.[teamType] : undefined;
  return override ? { ...base, ...override } : base;
}

export function setOrgTeamOverride(
  orgId:    string,
  teamType: TeamType,
  config:   Partial<TeamRoutingConfig>
): void {
  if (!_orgOverrides.has(orgId)) _orgOverrides.set(orgId, {});
  _orgOverrides.get(orgId)![teamType] = config;
}

export function resolveTeamFromWorkspace(teamType?: string | null): TeamType {
  const valid: TeamType[] = ["marketing", "engineering", "ops", "support", "general"];
  return valid.includes(teamType as TeamType) ? (teamType as TeamType) : "general";
}

export function getTeamSystemPromptSuffix(teamType: TeamType, orgId?: string): string {
  return getTeamConfig(teamType, orgId).systemPromptSuffix;
}
