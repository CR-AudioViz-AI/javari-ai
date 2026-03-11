// lib/ai/builders/architect.ts
// Purpose: Architect AI — analyzes a roadmap task and produces a precise build specification.
//          First stage of the AI Build Team pipeline.
//          Output: BuildSpec used by engineer.ts to generate code.
// Date: 2026-03-10

import { JavariRouter } from "@/lib/javari/router";

export interface ArchitectInput {
  taskId      : string;
  title       : string;
  description : string;
  artifactType: string;
  phaseId?    : string;
  canonicalContext?: string;
}

export interface BuildSpec {
  taskId          : string;
  artifactType    : string;
  filePath        : string;
  language        : string;
  framework       : string;
  components      : string[];
  integrations    : string[];
  dataFlows       : string[];
  interfaces      : string[];
  implementation  : string;
  migrationSql?   : string;
  testStrategy?   : string;
  securityNotes   : string;
  performanceNotes: string;
  raw             : string;
  durationMs      : number;
}

// Route architect calls through JavariRouter — reasoning_task for deep analysis
async function anthropicCall(system: string, user: string): Promise<string> {
  const result = await JavariRouter.generate({
    taskType  : "reasoning_task",
    prompt    : user,
    system,
    maxTokens : 4096,
  });
  if (!result.ok) throw new Error(`[architect] JavariRouter failed: ${result.error}`);
  return result.content;
}

export async function runArchitect(input: ArchitectInput): Promise<BuildSpec> {
  const t0 = Date.now();

  const system = `You are the Architect AI for CR AudioViz AI — a Fortune 50-quality AI platform.
Mission: "Your Story. Our Design."

Your role: analyze the task and produce a precise, implementable technical specification in JSON.
Think Next.js 14 App Router, TypeScript strict mode, Supabase PostgreSQL, shadcn/ui, Tailwind CSS.

Return ONLY valid JSON — no markdown, no backticks, no preamble.

Schema:
{
  "filePath": "string — exact file path",
  "language": "typescript | sql | markdown",
  "framework": "nextjs | supabase | react | jest | none",
  "components": ["list of components/classes to build"],
  "integrations": ["list of external systems to integrate"],
  "dataFlows": ["input → process → output descriptions"],
  "interfaces": ["TypeScript interfaces to define"],
  "implementation": "detailed implementation notes for the engineer",
  "migrationSql": "SQL migration text if applicable — null otherwise",
  "testStrategy": "testing approach if applicable — null otherwise",
  "securityNotes": "OWASP considerations",
  "performanceNotes": "performance targets and approach"
}`;

  const user = `Task: ${input.title}
Description: ${input.description}
Artifact type: ${input.artifactType}
Phase: ${input.phaseId ?? "general"}
${input.canonicalContext ? `\nCanonical context:\n${input.canonicalContext.slice(0, 800)}` : ""}

Produce the build specification.`;

  const raw = await anthropicCall(system, user);

  let parsed: Partial<BuildSpec> = {};
  try {
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    // Fallback: derive defaults
    parsed = { implementation: raw.slice(0, 1000) };
  }

  const slugId = input.taskId.slice(0, 32).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const defaultPath = (FILE_PATH_MAP[input.artifactType] ?? FILE_PATH_MAP.build_module)(slugId);

  return {
    taskId          : input.taskId,
    artifactType    : input.artifactType,
    filePath        : (parsed.filePath as string) || defaultPath,
    language        : (parsed.language as string) || "typescript",
    framework       : (parsed.framework as string) || "nextjs",
    components      : (parsed.components as string[]) || [],
    integrations    : (parsed.integrations as string[]) || [],
    dataFlows       : (parsed.dataFlows as string[]) || [],
    interfaces      : (parsed.interfaces as string[]) || [],
    implementation  : (parsed.implementation as string) || "",
    migrationSql    : (parsed.migrationSql as string) || undefined,
    testStrategy    : (parsed.testStrategy as string) || undefined,
    securityNotes   : (parsed.securityNotes as string) || "Standard OWASP Top 10 compliance",
    performanceNotes: (parsed.performanceNotes as string) || "Sub-200ms p95 target",
    raw,
    durationMs      : Date.now() - t0,
  };
}
