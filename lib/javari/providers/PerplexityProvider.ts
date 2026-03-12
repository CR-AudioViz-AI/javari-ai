// lib/javari/providers/PerplexityProvider.ts
// Perplexity AI Provider — routed via OpenRouter
// WHY: Perplexity's API endpoint (api.perplexity.ai) is protected by Cloudflare
// WAF which blocks requests from Vercel serverless functions due to their
// dynamic/rotating IP pool. This is a known platform-wide issue (community.perplexity.ai/t/2591).
// OpenRouter has established Cloudflare trust and proxies Perplexity models
// with zero functionality loss. The fix is transparent — callers still request
// provider='perplexity', they get Perplexity's sonar-pro model, just via
// OpenRouter's stable IP infrastructure.
// KEY USED: OPENROUTER_API_KEY (already in vault, confirmed working)
// ENDPOINT: https://openrouter.ai/api/v1/chat/completions
// MODELS:   perplexity/sonar-pro (default) | perplexity/sonar (fast)
// 2026-02-19 — P0-003 fix
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';
import { vault } from '@/lib/javari/secrets/vault';
  // Default to sonar-pro — full web search with citations
  // OpenRouter endpoint — bypasses Cloudflare WAF that blocks Vercel IPs
    // Always prefer the live OpenRouter key from vault
    // Fall back to whatever was passed to the constructor
    // (could be the perplexity key — won't work directly, but the caller
    //  may have already resolved openrouter key via getProviderApiKey)
    // Map bare model names (sonar, sonar-pro) to OpenRouter namespaced IDs
      // e.g. 'sonar-pro' → 'perplexity/sonar-pro'
                // malformed chunk — skip
    // sonar-pro via OpenRouter: ~$1/M input, ~$1/M output
export default {}
