// lib/crawler/apiMapper.ts
// Purpose: API mapper — scans JS bundles and HTML for API endpoint usage.
//          Detects fetch(), axios, GraphQL, and REST calls. Maps endpoints
//          to usage files and infers HTTP methods.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApiEndpoint {
  method    : string;
  endpoint  : string;
  usageFile : string;
  confidence: "high" | "medium" | "low";
  type      : "rest" | "graphql" | "rpc" | "websocket" | "unknown";
}

export interface ApiMapResult {
  endpoints     : ApiEndpoint[];
  graphqlUrls   : string[];
  websocketUrls : string[];
  totalFound    : number;
}

// ── Endpoint extractors ────────────────────────────────────────────────────

function extractFetchCalls(content: string, sourceFile: string): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];

  // fetch("URL") or fetch('URL') or fetch(`URL`)
  const fetchPat = /\bfetch\s*\(\s*["'`]([^"'`\s,)]{3,200})["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = new RegExp(fetchPat.source, fetchPat.flags).exec(content)) !== null) {
    const endpoint = m[1];
    if (!isLikelyUrl(endpoint)) continue;
    // Try to find method in surrounding context
    const ctx    = content.slice(Math.max(0, m.index - 200), m.index + 200);
    const method = inferMethod(ctx, endpoint);
    results.push({ method, endpoint, usageFile: sourceFile, confidence: "high", type: "rest" });
  }

  return results;
}

function extractAxiosCalls(content: string, sourceFile: string): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"];

  for (const method of methods) {
    const pat = new RegExp(`\\baxios\\.${method}\\s*\\(\\s*["'\`]([^"'\`\\s,)]{3,200})["'\`]`, "g");
    let m: RegExpExecArray | null;
    while ((m = pat.exec(content)) !== null) {
      if (isLikelyUrl(m[1])) {
        results.push({ method: method.toUpperCase(), endpoint: m[1], usageFile: sourceFile, confidence: "high", type: "rest" });
      }
    }
  }

  // axios({ method: "POST", url: "/api/..." })
  const axiosConfigPat = /axios\s*\(\s*\{[^}]*(?:method\s*:\s*["']([^"']+)["'])[^}]*(?:url\s*:\s*["']([^"']+)["'])|(?:url\s*:\s*["']([^"']+)["'])[^}]*(?:method\s*:\s*["']([^"']+)["'])/g;
  let m2: RegExpExecArray | null;
  while ((m2 = axiosConfigPat.exec(content)) !== null) {
    const method   = (m2[1] ?? m2[4] ?? "GET").toUpperCase();
    const endpoint = m2[2] ?? m2[3] ?? "";
    if (endpoint && isLikelyUrl(endpoint)) {
      results.push({ method, endpoint, usageFile: sourceFile, confidence: "high", type: "rest" });
    }
  }

  return results;
}

function extractGraphQL(content: string, sourceFile: string): { endpoints: ApiEndpoint[]; graphqlUrls: string[] } {
  const endpoints : ApiEndpoint[] = [];
  const graphqlUrls: string[] = [];

  // GraphQL endpoint detection
  const gqlPat = /(?:gql|graphql|ApolloClient)[^;]{0,200}["'`](https?:\/\/[^"'`\s]+\/graphql[^"'`\s]*)["'`]/gi;
  let m: RegExpExecArray | null;
  while ((m = gqlPat.exec(content)) !== null) {
    graphqlUrls.push(m[1]);
    endpoints.push({ method: "POST", endpoint: m[1], usageFile: sourceFile, confidence: "high", type: "graphql" });
  }

  // Generic /graphql path
  const gqlPathPat = /["'`](\/graphql[^"'`\s]*)["'`]/g;
  while ((m = new RegExp(gqlPathPat.source, gqlPathPat.flags).exec(content)) !== null) {
    endpoints.push({ method: "POST", endpoint: m[1], usageFile: sourceFile, confidence: "medium", type: "graphql" });
  }

  return { endpoints, graphqlUrls };
}

function extractWebSockets(content: string): string[] {
  const urls: string[] = [];
  const wsPat = /new\s+WebSocket\s*\(\s*["'`](wss?:\/\/[^"'`\s]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = wsPat.exec(content)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

function extractApiPaths(content: string, sourceFile: string): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];
  // Bare string paths like "/api/users" or "/v1/payments"
  const pathPat = /["'`](\/(?:api|v\d|rest|rpc|gql)[^"'`\s]{2,100})["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = new RegExp(pathPat.source, pathPat.flags).exec(content)) !== null) {
    const ep = m[1];
    if (ep.includes("\n") || ep.includes(" ")) continue;
    results.push({ method: "UNKNOWN", endpoint: ep, usageFile: sourceFile, confidence: "low", type: "rest" });
  }
  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isLikelyUrl(s: string): boolean {
  return s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://");
}

function inferMethod(ctx: string, endpoint: string): string {
  const lower = ctx.toLowerCase();
  if (/method\s*:\s*["']post["']/.test(lower))   return "POST";
  if (/method\s*:\s*["']put["']/.test(lower))    return "PUT";
  if (/method\s*:\s*["']delete["']/.test(lower)) return "DELETE";
  if (/method\s*:\s*["']patch["']/.test(lower))  return "PATCH";
  if (/\.post\(/.test(lower))  return "POST";
  if (/\.put\(/.test(lower))   return "PUT";
  if (/\.delete\(/.test(lower)) return "DELETE";
  if (/\.patch\(/.test(lower)) return "PATCH";
  // Heuristic: creation/update/delete endpoints → not GET
  if (/create|update|delete|remove|save|submit/i.test(endpoint)) return "POST";
  return "GET";
}

function deduplicateEndpoints(endpoints: ApiEndpoint[]): ApiEndpoint[] {
  const seen = new Set<string>();
  return endpoints.filter(e => {
    const key = `${e.method}:${e.endpoint}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main mapper ────────────────────────────────────────────────────────────

export async function mapApis(
  jsContents: Map<string, string>,  // url → JS content
  htmlContents: Map<string, string> // url → HTML content
): Promise<ApiMapResult> {
  const allEndpoints : ApiEndpoint[] = [];
  const allGraphqlUrls: string[] = [];
  const allWsUrls    : string[] = [];

  // Process JS files
  for (const [url, content] of jsContents) {
    allEndpoints.push(...extractFetchCalls(content, url));
    allEndpoints.push(...extractAxiosCalls(content, url));
    const gql = extractGraphQL(content, url);
    allEndpoints.push(...gql.endpoints);
    allGraphqlUrls.push(...gql.graphqlUrls);
    allWsUrls.push(...extractWebSockets(content));
    allEndpoints.push(...extractApiPaths(content, url));
  }

  // Process HTML (inline scripts)
  for (const [url, html] of htmlContents) {
    // Extract inline scripts
    const scriptPat = /<script(?![^>]+src\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = new RegExp(scriptPat.source, scriptPat.flags).exec(html)) !== null) {
      const inlineJs = m[1];
      allEndpoints.push(...extractFetchCalls(inlineJs, url));
      allEndpoints.push(...extractAxiosCalls(inlineJs, url));
    }
  }

  const deduplicated = deduplicateEndpoints(allEndpoints);

  return {
    endpoints    : deduplicated,
    graphqlUrls  : [...new Set(allGraphqlUrls)],
    websocketUrls: [...new Set(allWsUrls)],
    totalFound   : deduplicated.length,
  };
}
