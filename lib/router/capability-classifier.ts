import { ModelCapability } from "./model-registry";
// ── Routing override: explicit model assignment ───────────────────────────────
// Pass routingRole to bypass capability classification entirely.
// "builder"   → cheapest capable model (gemini-2.0-flash-exp)
// "validator" → highest reasoning model (claude-sonnet-4-20250514)
export type RoutingRole = "builder" | "validator" | "auto";

export function classifyCapability(
  input: string,
  role: RoutingRole = "auto"
): ModelCapability {
  // Role-based override — skips heuristic classification
  if (role === "builder")   return "standard"; // routes to gemini-2.0-flash-exp
  if (role === "validator") return "high";     // routes to claude-sonnet-4-20250514

  const length = input.length;
  const complexSignals = [
    "architecture",
    "design",
    "strategy",
    "multi-step",
    "legal",
    "contract",
    "financial",
    "optimize",
    "analyze",
  ];
  const lower = input.toLowerCase();

  // Tightened threshold: length alone no longer forces "high".
  // Tasks must have genuine complexity signals to warrant Sonnet 4.
  const hasComplexSignal = complexSignals.some((s) => lower.includes(s));
  if (hasComplexSignal) return "high";
  if (prompt.length > 800) return "high";        // was: return "standard"
  if (prompt.length > 300) return "standard";    // was: length > 200
  return "light";
}
