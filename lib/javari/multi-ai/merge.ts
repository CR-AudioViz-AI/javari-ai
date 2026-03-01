// lib/javari/multi-ai/merge.ts
// Agent output merge logic for multi-AI orchestration
// Consolidated stub — provides merge function used by orchestrator.ts

export interface AgentOutput {
  role: string;
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface MergeResult {
  merged: string;
  strategy: "single" | "concatenate" | "primary_wins" | "json_merge";
  conflictDetected: boolean;
  conflictResolution?: string;
  agentCount: number;
}

export function mergeAgentOutputs(
  outputs: AgentOutput[],
  options?: { requireJson?: boolean; taskDescription?: string }
): MergeResult {
  const successful = outputs.filter(o => o.success && o.content);

  if (successful.length === 0) {
    return { merged: "", strategy: "single", conflictDetected: false, agentCount: 0 };
  }

  if (successful.length === 1) {
    return { merged: successful[0].content, strategy: "single", conflictDetected: false, agentCount: 1 };
  }

  // JSON mode: take the first valid JSON output
  if (options?.requireJson) {
    for (const out of successful) {
      try {
        JSON.parse(out.content);
        return { merged: out.content, strategy: "json_merge", conflictDetected: false, agentCount: successful.length };
      } catch { /* not valid JSON, try next */ }
    }
  }

  // Multiple outputs: primary wins, note if conflict
  const primary = successful[0];
  const others = successful.slice(1);
  const conflictDetected = others.some(o => {
    // Simple conflict detection: >50% different tokens
    const pTokens = new Set(primary.content.split(/\s+/));
    const oTokens = o.content.split(/\s+/);
    const overlap = oTokens.filter(t => pTokens.has(t)).length;
    return overlap < oTokens.length * 0.5;
  });

  return {
    merged: primary.content,
    strategy: "primary_wins",
    conflictDetected,
    conflictResolution: conflictDetected ? "Primary agent output selected" : undefined,
    agentCount: successful.length,
  };
}
