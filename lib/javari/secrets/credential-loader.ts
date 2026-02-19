// lib/javari/secrets/credential-loader.ts
// Safe credential loader — resolves provider names to actual API keys
// All code should call these functions instead of process.env directly

import vault, { type ProviderName } from "./vault";

// ── AI Provider keys ─────────────────────────────────────────────────────────
export const getOpenAIKey      = ()  => vault.assert("openai");
export const getAnthropicKey   = ()  => vault.assert("anthropic");
export const getMistralKey     = ()  => vault.assert("mistral");
export const getGroqKey        = ()  => vault.assert("groq");
export const getElevenLabsKey  = ()  => vault.assert("elevenlabs");
export const getPerplexityKey  = ()  => vault.assert("perplexity");
export const getGeminiKey      = ()  => vault.assert("gemini");
export const getXAIKey         = ()  => vault.assert("xai");
export const getOpenRouterKey  = ()  => vault.assert("openrouter");
export const getDeepSeekKey    = ()  => vault.assert("deepseek");
export const getCohereKey      = ()  => vault.assert("cohere");
export const getFireworksKey   = ()  => vault.assert("fireworks");
export const getTogetherKey    = ()  => vault.assert("together");
export const getReplicateKey   = ()  => vault.assert("replicate");

// ── Infrastructure keys ──────────────────────────────────────────────────────
export const getSupabaseUrl        = () => vault.assert("supabase_url");
export const getSupabaseAnonKey    = () => vault.assert("supabase_anon");
export const getSupabaseServiceKey = () => vault.get("supabase_service") ?? null;
export const getGitHubToken        = () => vault.assert("github");
export const getVercelToken        = () => vault.assert("vercel");
export const getStripeKey          = () => vault.get("stripe") ?? null;
export const getPayPalSecret       = () => vault.get("paypal") ?? null;

// ── Agent-scoped credential access ───────────────────────────────────────────
// Expose a safe server-side function for any agent to get its credentials
// Agents never receive keys they haven\'t been scoped to access.

type AgentName =
  | "javari" | "claude" | "chatgpt" | "router"
  | "autonomous-executor" | "voice-subsystem" | "ingest-worker";

const AGENT_SCOPES: Record<AgentName, ProviderName[]> = {
  "javari": [
    "openai", "anthropic", "mistral", "groq", "gemini", "xai",
    "openrouter", "perplexity", "cohere",
    "supabase_url", "supabase_anon", "supabase_service",
    "github", "vercel",
  ],
  "claude": ["anthropic", "supabase_url", "supabase_anon"],
  "chatgpt": ["openai", "supabase_url", "supabase_anon"],
  "router": [
    "openai", "anthropic", "mistral", "groq", "gemini", "xai",
    "openrouter", "perplexity", "cohere", "fireworks", "together",
  ],
  "autonomous-executor": [
    "openai", "anthropic", "supabase_url", "supabase_anon", "supabase_service",
    "github", "vercel",
  ],
  "voice-subsystem": ["openai", "elevenlabs"],
  "ingest-worker": [
    "openai", "supabase_url", "supabase_anon", "supabase_service", "github",
  ],
};

/**
 * Get credentials for a specific agent.
 * Only returns keys the agent is authorized to use.
 * Returns only keys that are actually present (no nulls in result).
 */
export function getCredentialForAgent(
  agentName: AgentName,
  providerName: ProviderName
): string | null {
  const scope = AGENT_SCOPES[agentName];
  if (!scope) {
    console.warn(`[CredentialLoader] Unknown agent: ${agentName}`);
    return null;
  }
  if (!scope.includes(providerName)) {
    console.warn(`[CredentialLoader] Agent "${agentName}" not authorized for "${providerName}"`);
    return null;
  }
  return vault.get(providerName);
}

/**
 * Get all available credentials for an agent.
 */
export function getAllCredentialsForAgent(
  agentName: AgentName
): Partial<Record<ProviderName, string>> {
  const scope = AGENT_SCOPES[agentName] ?? [];
  return vault.getMany(scope);
}

/**
 * Check if all required credentials for an agent are present.
 */
export function validateAgentCredentials(
  agentName: AgentName,
  required?: ProviderName[]
): { ok: boolean; missing: string[] } {
  const scope = required ?? AGENT_SCOPES[agentName] ?? [];
  const missing = scope.filter(p => !vault.has(p));
  return { ok: missing.length === 0, missing: missing.map(String) };
}
