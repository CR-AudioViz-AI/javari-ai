// lib/ai/builders/documenter.ts
// Purpose: Documenter AI — generates technical documentation for a built artifact.
//          Fourth stage of the AI Build Team pipeline.
//          Output: Markdown documentation committed alongside the artifact.
// Date: 2026-03-10

import { getSecret } from "@/lib/platform-secrets/getSecret";
import type { BuildSpec } from "./architect";

export interface DocumenterOutput {
  filePath      : string;    // Markdown doc path derived from artifact path
  documentation : string;
  durationMs    : number;
}

async function anthropicCall(system: string, user: string): Promise<string> {
  const apiKey = await getSecret("ANTHROPIC_API_KEY").catch(() => "")
    || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) throw new Error("[documenter] ANTHROPIC_API_KEY unavailable");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method : "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as { content: Array<{ type: string; text?: string }> };
  return d.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim();
}

function deriveDocPath(artifactPath: string): string {
  // Strip extension, add .md
  return artifactPath.replace(/\.(ts|tsx|sql|js|jsx)$/, ".md");
}

export async function runDocumenter(
  spec   : BuildSpec,
  content: string
): Promise<DocumenterOutput> {
  const t0 = Date.now();

  const system = `You are the Documenter AI for CR AudioViz AI.
Write concise, accurate technical documentation for the generated artifact.

Format: Markdown only. Sections to include:
## Purpose
## Usage
## Parameters / Props / Arguments (if applicable)
## Return Value / Response Shape (if applicable)
## Integration Notes
## Example

Rules:
- Keep it under 600 words.
- Accurate — derive directly from the code provided.
- Code examples in appropriate language code blocks.
- No filler phrases.
Return ONLY the Markdown documentation.`;

  const user = `Task: ${spec.taskId}
Artifact: ${spec.filePath}
Type: ${spec.artifactType}

Generated artifact (first 2500 chars):
${content.slice(0, 2500)}

Write the documentation.`;

  let documentation = `# ${spec.taskId}\n\nAutomated build by Javari AI — ${new Date().toISOString()}\n\nArtifact: \`${spec.filePath}\`\n`;

  try {
    documentation = await anthropicCall(system, user);
  } catch (err) {
    console.warn("[documenter] Failed — using fallback docs:", err instanceof Error ? err.message : String(err));
  }

  return {
    filePath     : deriveDocPath(spec.filePath),
    documentation,
    durationMs   : Date.now() - t0,
  };
}
