// lib/javari/secrets/credential-loader.ts
// ─────────────────────────────────────────────────────────────────────────────
// JAVARI OS — AGENT-SCOPED CREDENTIAL LOADER
// ─────────────────────────────────────────────────────────────────────────────
// Provides getCredentialForAgent(agentName, providerName) so every AI agent
// can get exactly the credentials it needs without touching process.env directly.
//
// Supported agents: javari | claude | chatgpt | router | autonomous-executor
//                   voice-subsystem | ingest | admin
// ─────────────────────────────────────────────────────────────────────────────
// Timestamp: 2026-02-18 16:45 EST

import { vault, type ProviderName, type VaultStatus } from "./vault";

// ── Agent definitions ─────────────────────────────────────────────────────────

export type AgentName =
  | "javari"
  | "claude"
  | "chatgpt"
  | "router"
  | "autonomous-executor"
  | "voice-subsystem"
  | "ingest"
  | "admin";

interface AgentCredentialMap {
  allowed: ProviderName[];
  description: string;
}

/** Defines which credentials each agent is permitted to request */
const AGENT_PERMISSIONS: Record<AgentName, AgentCredentialMap> = {
  javari: {
    description: "Javari AI core engine — full multi-AI routing",
    allowed: [
      "openai", "anthropic", "mistral", "groq", "perplexity",
      "openrouter", "xai", "deepseek", "cohere",
      "supabase_url", "supabase_anon_key", "supabase_service_role",
      "elevenlabs",
    ],
  },
  claude: {
    description: "Claude (Anthropic) agent for specialized reasoning tasks",
    allowed: ["anthropic", "supabase_url", "supabase_anon_key"],
  },
  chatgpt: {
    description: "OpenAI GPT agent for general tasks",
    allowed: ["openai", "supabase_url", "supabase_anon_key"],
  },
  router: {
    description: "Multi-AI routing engine — selects best provider per query",
    allowed: [
      "openai", "anthropic", "mistral", "groq", "perplexity",
      "openrouter", "xai", "deepseek", "cohere",
    ],
  },
  "autonomous-executor": {
    description: "Javari autonomous build/deploy executor",
    allowed: [
      "openai", "anthropic",
      "github_pat", "vercel_token",
      "supabase_url", "supabase_service_role",
      "cron_secret",
    ],
  },
  "voice-subsystem": {
    description: "Javari voice layer — ElevenLabs TTS + OpenAI Realtime",
    allowed: ["openai", "elevenlabs"],
  },
  ingest: {
    description: "R2 canonical document ingestion pipeline",
    allowed: [
      "openai", "github_pat",
      "supabase_url", "supabase_anon_key", "supabase_service_role",
      "ingest_secret",
    ],
  },
  admin: {
    description: "Admin dashboard and setup endpoints",
    allowed: [
      "supabase_url", "supabase_anon_key", "supabase_service_role",
      "stripe_secret", "stripe_webhook_secret",
      "paypal_client_id", "paypal_client_secret",
      "resend", "cron_secret", "admin_setup_key",
    ],
  },
};

// ── Core Function ─────────────────────────────────────────────────────────────

/**
 * Get a credential for a specific agent.
 *
 * @param agentName - The requesting agent identifier
 * @param providerName - The credential/provider being requested
 * @returns The credential value, or null if not found
 * @throws Error if the agent is not permitted to access this provider
 *
 * @example
 * const openaiKey = getCredentialForAgent("voice-subsystem", "openai");
 */
export function getCredentialForAgent(
  agentName: AgentName,
  providerName: ProviderName
): string | null {
  const permissions = AGENT_PERMISSIONS[agentName];
  if (!permissions) {
    throw new Error(`[CredentialLoader] Unknown agent: "${agentName}"`);
  }

  if (!permissions.allowed.includes(providerName)) {
    throw new Error(
      `[CredentialLoader] Agent "${agentName}" is not permitted to access ` +
        `credential "${providerName}". ` +
        `Allowed: ${permissions.allowed.join(", ")}`
    );
  }

  return vault.get(providerName);
}

/**
 * Assert a credential for an agent. Throws if missing or not permitted.
 */
export function assertCredentialForAgent(
  agentName: AgentName,
  providerName: ProviderName
): string {
  const val = getCredentialForAgent(agentName, providerName);
  if (!val) {
    throw new Error(
      `[CredentialLoader] Agent "${agentName}" requires credential ` +
        `"${providerName}" but it is not set. ` +
        `Check Vercel environment variables.`
    );
  }
  return val;
}

/**
 * Get all available credentials for an agent (only those that are present).
 * Returns a map of providerName → true/false (never the actual values).
 */
export function getAgentCredentialStatus(
  agentName: AgentName
): Record<ProviderName, VaultStatus> {
  const permissions = AGENT_PERMISSIONS[agentName];
  if (!permissions) {
    throw new Error(`[CredentialLoader] Unknown agent: "${agentName}"`);
  }

  const result: Partial<Record<ProviderName, VaultStatus>> = {};
  for (const provider of permissions.allowed) {
    result[provider] = vault.getStatus(provider);
  }
  return result as Record<ProviderName, VaultStatus>;
}

/**
 * Check if an agent has a specific credential available.
 */
export function agentHasCredential(
  agentName: AgentName,
  providerName: ProviderName
): boolean {
  try {
    return !!getCredentialForAgent(agentName, providerName);
  } catch {
    return false;
  }
}

/**
 * Get all agent names and their descriptions. Safe to expose in diagnostics.
 */
export function listAgents(): Array<{ name: AgentName; description: string; allowedCount: number }> {
  return (Object.entries(AGENT_PERMISSIONS) as [AgentName, AgentCredentialMap][]).map(
    ([name, def]) => ({
      name,
      description: def.description,
      allowedCount: def.allowed.length,
    })
  );
}

export default {
  getCredentialForAgent,
  assertCredentialForAgent,
  getAgentCredentialStatus,
  agentHasCredential,
  listAgents,
};
