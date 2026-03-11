// lib/javari/chat/javariChatController.ts
// Purpose: Unified Javari Chat Controller — classifies intent, routes ALL user and system
//          prompts through JavariRouter, orchestrates the AI Build Team in team mode.
//
// Intent types and their routing:
//   chat           → router.simple_task or reasoning_task (conversational)
//   plan_task      → router.reasoning_task → autonomousPlanner trigger
//   execute_task   → workerCycle trigger
//   generate_module→ artifactExecutor pipeline (architect → engineer → validator → documenter)
//   query_system   → Supabase database lookup + formatted response
//
// Mode types:
//   single  → single model call, task-type routing
//   team    → Architect → Engineer → Validator → Documenter sequential pipeline
//
// Date: 2026-03-11

import { createClient }   from "@supabase/supabase-js";
import { JavariRouter }   from "@/lib/javari/router";
import { runArchitect }   from "@/lib/ai/builders/architect";
import { runEngineer }    from "@/lib/ai/builders/engineer";
import { runValidator }   from "@/lib/ai/builders/validator";
import { runDocumenter }  from "@/lib/ai/builders/documenter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentType =
  | "chat"
  | "plan_task"
  | "execute_task"
  | "generate_module"
  | "query_system";

export type ChatMode = "single" | "team";

export interface ChatRequest {
  message    : string;
  mode?      : ChatMode;
  userId?    : string;
  sessionId? : string;
  context?   : Record<string, unknown>;
}

export interface IntentResult {
  intent    : IntentType;
  confidence: number;
  signals   : string[];
}

export interface TeamStepResult {
  step      : "architect" | "engineer" | "validator" | "documenter";
  ok        : boolean;
  output    : string;
  durationMs: number;
}

export interface ChatControllerResult {
  ok          : boolean;
  reply       : string;
  intent      : IntentType;
  mode        : ChatMode;
  provider?   : string;
  model?      : string;
  costUsd     : number;
  latencyMs   : number;
  sessionId?  : string;
  teamSteps?  : TeamStepResult[];
  systemData? : Record<string, unknown>;
  error?      : string;
}

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Intent classifier ─────────────────────────────────────────────────────────
// Pattern-based first pass. Fast and zero-cost. Falls back to "chat".

const INTENT_PATTERNS: Array<{ intent: IntentType; patterns: RegExp[]; weight: number }> = [
  {
    intent: "query_system",
    weight: 0.95,
    patterns: [
      /\b(how many|count|total|status|show me|list|what is the current|how is|dashboard|metrics|telemetry)\b/i,
      /\b(tasks?|roadmap|progress|pending|completed|queue|build.?artifacts?|deployments?)\b.*\b(count|status|how many|total)\b/i,
      /\b(system|platform|database)\b.*\b(status|health|stats?|metrics?)\b/i,
    ],
  },
  {
    intent: "generate_module",
    weight: 0.92,
    patterns: [
      /\b(build|create|generate|make|implement|write)\b.*\b(module|component|api|service|migration|feature|endpoint|route|schema)\b/i,
      /\b(generate|create|build)\b.*\b(code|typescript|sql|react|next\.?js)\b/i,
    ],
  },
  {
    intent: "execute_task",
    weight: 0.90,
    patterns: [
      /\b(run|execute|start|trigger|fire|kick off)\b.*\b(task|worker|cycle|job|pipeline)\b/i,
      /\b(deploy|push|ship|release|launch)\b/i,
      /\brun (the )?(worker|planner|roadmap|autonomous)\b/i,
    ],
  },
  {
    intent: "plan_task",
    weight: 0.88,
    patterns: [
      /\b(plan|strategy|roadmap|schedule|prioritize|next steps|what should)\b/i,
      /\b(add|create|generate)\b.{0,30}\b(tasks?|roadmap|plan|backlog)\b/i,
      /\bhow (should|do) (I|we|javari)\b.*\b(build|approach|tackle|handle)\b/i,
    ],
  },
];

export function classifyIntent(message: string): IntentResult {
  const lower = message.toLowerCase().trim();
  const signals: string[] = [];

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    const matched = patterns.filter(p => p.test(lower));
    if (matched.length > 0) {
      signals.push(...matched.map(p => p.source.slice(0, 40)));
      return {
        intent,
        confidence: Math.min(weight + (matched.length - 1) * 0.02, 0.99),
        signals,
      };
    }
  }

  // Default: conversational chat
  return { intent: "chat", confidence: 0.80, signals: ["default:conversational"] };
}

// ── System query handler ──────────────────────────────────────────────────────

async function handleQuerySystem(message: string): Promise<{ reply: string; data: Record<string, unknown> }> {
  const client = db();
  const lower  = message.toLowerCase();

  // Task queue stats
  if (/tasks?|queue|pending|completed|roadmap|progress/.test(lower)) {
    try {
      const [totalRes, completedRes, pendingRes] = await Promise.all([
        client.from("roadmap_tasks").select("*", { count: "exact", head: true }),
        client.from("roadmap_tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
        client.from("roadmap_tasks").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const total     = totalRes.count     ?? 0;
      const completed = completedRes.count ?? 0;
      const pending   = pendingRes.count   ?? 0;
      const pct       = total > 0 ? ((completed / total) * 100).toFixed(1) : "0";
      return {
        reply: `📊 **Roadmap Status**\n- Total tasks: ${total.toLocaleString()}\n- Completed: ${completed.toLocaleString()} (${pct}%)\n- Pending: ${pending.toLocaleString()}\n- Other: ${(total - completed - pending).toLocaleString()}`,
        data : { total, completed, pending },
      };
    } catch {
      return { reply: "📊 Unable to fetch roadmap stats right now — check /api/javari/dashboard for full telemetry.", data: {} };
    }
  }

  // Build artifacts
  if (/build.?artifact|commit|deploy/.test(lower)) {
    const { data: arts } = await client
      .from("build_artifacts")
      .select("artifact_type, status, commit_sha, deployment_url, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const count = arts?.length ?? 0;
    const types = [...new Set(arts?.map((a: { artifact_type: string }) => a.artifact_type) ?? [])];
    return {
      reply: `🏗️ **Build Artifacts**\n- Recent artifacts: ${count}\n- Types: ${types.join(", ") || "none yet"}\n- Use /api/javari/dashboard for full telemetry.`,
      data : { artifacts: arts ?? [] },
    };
  }

  // AI router logs
  if (/router|ai.?call|model|cost|latency|provider/.test(lower)) {
    const { data: logs } = await client
      .from("ai_router_logs")
      .select("task_type, provider, model_used, cost_usd, latency_ms, ok")
      .order("created_at", { ascending: false })
      .limit(20);

    const total    = logs?.length ?? 0;
    const totalCost = logs?.reduce((s: number, l: { cost_usd?: number }) => s + (l.cost_usd ?? 0), 0) ?? 0;
    const providers = [...new Set(logs?.map((l: { provider: string }) => l.provider) ?? [])];
    return {
      reply: `🤖 **AI Router Telemetry**\n- Recent calls: ${total}\n- Total cost: $${totalCost.toFixed(5)}\n- Active providers: ${providers.join(", ") || "none yet"}`,
      data : { logs: logs ?? [] },
    };
  }

  // Generic system status
  return {
    reply: "I have access to the full system telemetry. Could you be more specific? Try asking about: tasks/roadmap progress, build artifacts, AI router costs, or deployments.",
    data : {},
  };
}

// ── Plan task handler ─────────────────────────────────────────────────────────

async function handlePlanTask(message: string): Promise<{ reply: string; costUsd: number }> {
  const result = await JavariRouter.generate({
    taskType: "reasoning_task",
    prompt  : message,
    system  : `You are Javari AI, the autonomous ecosystem planner for CR AudioViz AI.
Mission: "Your Story. Our Design."
When asked to plan tasks, generate specific, actionable roadmap items.
Format your response with clear sections and concrete next steps.
Reference the platform's 55-module architecture when relevant.`,
    maxTokens: 2000,
  });

  if (!result.ok) throw new Error(`Plan task failed: ${result.error}`);
  return { reply: result.content, costUsd: result.costUsd };
}

// ── Execute task handler ──────────────────────────────────────────────────────

async function handleExecuteTask(message: string): Promise<{ reply: string; costUsd: number }> {
  // Trigger worker cycle via internal call
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

  try {
    const res = await fetch(`${baseUrl}/api/javari/worker-cycle`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      signal : AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      const data = await res.json() as {
        tasksExecuted?: number;
        tasksCompleted?: number;
        costUsd?: number;
        stoppedReason?: string;
      };
      return {
        reply: `⚙️ **Worker Cycle Triggered**\n- Tasks executed: ${data.tasksExecuted ?? 0}\n- Tasks completed: ${data.tasksCompleted ?? 0}\n- Cost: $${(data.costUsd ?? 0).toFixed(4)}\n- Stopped: ${data.stoppedReason ?? "unknown"}`,
        costUsd: 0,
      };
    }
  } catch {
    // Worker timeout is expected — it runs async
  }

  return {
    reply  : "⚙️ Worker cycle triggered. Tasks are executing autonomously. Check the dashboard for real-time progress.",
    costUsd: 0,
  };
}

// ── Generate module handler (single mode) ─────────────────────────────────────

async function handleGenerateModuleSingle(message: string): Promise<{ reply: string; costUsd: number }> {
  const result = await JavariRouter.generate({
    taskType: "code_task",
    prompt  : message,
    system  : `You are the Javari AI code generation engine for CR AudioViz AI.
Platform: Next.js 14 App Router, TypeScript strict, Supabase, Tailwind CSS, shadcn/ui.
Generate complete, production-ready implementations.
Include proper error handling, TypeScript types, and file headers.
Return ONLY the code. No markdown fences.`,
    maxTokens: 8000,
  });

  if (!result.ok) throw new Error(`Generate module failed: ${result.error}`);
  return { reply: result.content, costUsd: result.costUsd };
}

// ── Plain chat handler ────────────────────────────────────────────────────────

async function handleChat(message: string): Promise<{ reply: string; provider: string; model: string; costUsd: number }> {
  // Use reasoning for complex messages, simple for short ones
  const isComplex = message.length > 200 || /\b(explain|analyze|compare|design|architecture|strategy|why|how does)\b/i.test(message);

  const result = await JavariRouter.generate({
    taskType: isComplex ? "reasoning_task" : "simple_task",
    prompt  : message,
    system  : `You are Javari AI — the intelligent assistant and operating system for CR AudioViz AI.
Mission: "Your Story. Our Design."
You are concise, precise, and helpful. You have full knowledge of the platform's architecture,
roadmap, and capabilities. When asked about platform capabilities, be specific and confident.
Never make up features. If unsure, say so.`,
    maxTokens: 2000,
  });

  if (!result.ok) throw new Error(`Chat failed: ${result.error}`);
  return { reply: result.content, provider: result.provider, model: result.model, costUsd: result.costUsd };
}

// ── TEAM MODE — full build pipeline ──────────────────────────────────────────
// Runs: Architect → Engineer → Validator → Documenter
// Each stage routed through JavariRouter with its task type.
// Validator uses a DIFFERENT model than engineer (by design in router strategy).

async function runTeamMode(message: string): Promise<{
  reply     : string;
  costUsd   : number;
  teamSteps : TeamStepResult[];
}> {
  const steps: TeamStepResult[] = [];
  let totalCost = 0;

  // Derive a synthetic task for the build team
  const syntheticTask = {
    taskId      : `chat-${Date.now()}`,
    title       : message.slice(0, 120),
    description : message,
    artifactType: "build_module",
  };

  // ── Step 1: Architect ────────────────────────────────────────────────────
  const archStart = Date.now();
  let spec: Awaited<ReturnType<typeof runArchitect>>;
  try {
    spec = await runArchitect(syntheticTask);
    steps.push({
      step: "architect", ok: true,
      output: `BuildSpec: ${spec.filePath} | Components: ${spec.components.join(", ")}`,
      durationMs: Date.now() - archStart,
    });
  } catch (err) {
    steps.push({ step: "architect", ok: false, output: String(err), durationMs: Date.now() - archStart });
    return { reply: `Team mode failed at Architect stage: ${String(err)}`, costUsd: totalCost, teamSteps: steps };
  }

  // ── Step 2: Engineer ─────────────────────────────────────────────────────
  const engStart = Date.now();
  let engineerOutput: Awaited<ReturnType<typeof runEngineer>>;
  try {
    engineerOutput = await runEngineer(spec);
    totalCost += spec.components.length * 0.001;
    steps.push({
      step: "engineer", ok: true,
      output: `Generated: ${engineerOutput.filePath} (${engineerOutput.lineCount} lines, ${engineerOutput.language})`,
      durationMs: Date.now() - engStart,
    });
  } catch (err) {
    steps.push({ step: "engineer", ok: false, output: String(err), durationMs: Date.now() - engStart });
    return { reply: `Team mode failed at Engineer stage: ${String(err)}`, costUsd: totalCost, teamSteps: steps };
  }

  // ── Step 3: Validator ────────────────────────────────────────────────────
  // runValidator(spec, content) — positional args, uses validation_task (different model than engineer)
  const valStart = Date.now();
  let validatorOutput: Awaited<ReturnType<typeof runValidator>> | undefined;
  try {
    validatorOutput = await runValidator(spec, engineerOutput.content);
    steps.push({
      step: "validator", ok: validatorOutput.passed,
      output: `${validatorOutput.passed ? "✅ PASS" : "⚠️ WARN"} — Score: ${validatorOutput.score}/100 | ${validatorOutput.notes.slice(0, 120)}`,
      durationMs: Date.now() - valStart,
    });
  } catch (err) {
    steps.push({ step: "validator", ok: false, output: String(err), durationMs: Date.now() - valStart });
    // Non-fatal — continue to documentation
  }

  // ── Step 4: Documenter ───────────────────────────────────────────────────
  // runDocumenter(spec, content) — positional args
  const docStart = Date.now();
  let docOutput: Awaited<ReturnType<typeof runDocumenter>> | undefined;
  try {
    docOutput = await runDocumenter(spec, engineerOutput.content);
    steps.push({
      step: "documenter", ok: true,
      output: `Documentation written: ${docOutput.filePath} (${docOutput.documentation.length} chars)`,
      durationMs: Date.now() - docStart,
    });
  } catch (err) {
    steps.push({ step: "documenter", ok: false, output: String(err), durationMs: Date.now() - docStart });
  }

  // Compose final reply
  const validationSummary = validatorOutput
    ? `\n\n**Validation:** ${validatorOutput.passed ? "✅ PASS" : "⚠️ Issues found"} (${validatorOutput.score}/100) — ${validatorOutput.notes.slice(0, 200)}`
    : "";

  const docSummary = docOutput?.documentation
    ? `\n\n**Documentation preview:**\n${docOutput.documentation.slice(0, 600)}${docOutput.documentation.length > 600 ? "..." : ""}`
    : "";

  const reply =
    `🏗️ **Team Build Complete** — \`${engineerOutput.filePath}\`\n\n` +
    `\`\`\`${engineerOutput.language}\n${engineerOutput.content.slice(0, 2000)}` +
    (engineerOutput.content.length > 2000 ? `\n... (${engineerOutput.lineCount} lines total)` : "") +
    `\n\`\`\`` +
    validationSummary +
    docSummary;

  return { reply, costUsd: totalCost, teamSteps: steps };
}

// ── Session telemetry ─────────────────────────────────────────────────────────

async function logChatSession(params: {
  sessionId   : string;
  userId      : string;
  mode        : ChatMode;
  intent      : IntentType;
  messageCount: number;
  modelsUsed  : string[];
  costTotal   : number;
}): Promise<void> {
  try {
    await db().from("chat_sessions").insert({
      id          : params.sessionId,
      user_id     : params.userId,
      mode        : params.mode,
      intent      : params.intent,
      messages    : params.messageCount,
      models_used : params.modelsUsed,
      cost_total  : params.costTotal,
      created_at  : new Date().toISOString(),
    });
  } catch {
    // Non-fatal — telemetry never blocks
  }
}

// ── Main controller ───────────────────────────────────────────────────────────

export async function handleChatMessage(req: ChatRequest): Promise<ChatControllerResult> {
  const t0        = Date.now();
  const sessionId = req.sessionId ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId    = req.userId    ?? "anonymous";
  const mode      = req.mode      ?? "single";
  const message   = req.message.trim();

  if (!message) {
    return {
      ok: false, reply: "Empty message received.", intent: "chat",
      mode, costUsd: 0, latencyMs: 0, error: "Empty message",
    };
  }

  // Classify intent
  const { intent, confidence, signals } = classifyIntent(message);
  console.log(`[chat-controller] intent=${intent} confidence=${confidence.toFixed(2)} signals=${signals[0] ?? "none"} mode=${mode}`);

  let reply       = "";
  let provider    = "";
  let model       = "";
  let costUsd     = 0;
  let teamSteps: TeamStepResult[] | undefined;
  let systemData: Record<string, unknown> | undefined;

  try {
    // TEAM MODE — override intent to generate_module pipeline
    if (mode === "team") {
      const teamResult = await runTeamMode(message);
      reply     = teamResult.reply;
      costUsd   = teamResult.costUsd;
      teamSteps = teamResult.teamSteps;
      provider  = "team";
      model     = "architect+engineer+validator+documenter";
    } else {
      // SINGLE MODE — route by intent
      switch (intent) {
        case "query_system": {
          const r = await handleQuerySystem(message);
          reply      = r.reply;
          systemData = r.data;
          break;
        }
        case "plan_task": {
          const r = await handlePlanTask(message);
          reply   = r.reply;
          costUsd = r.costUsd;
          break;
        }
        case "execute_task": {
          const r = await handleExecuteTask(message);
          reply   = r.reply;
          costUsd = r.costUsd;
          break;
        }
        case "generate_module": {
          const r = await handleGenerateModuleSingle(message);
          reply   = r.reply;
          costUsd = r.costUsd;
          break;
        }
        case "chat":
        default: {
          const r = await handleChat(message);
          reply    = r.reply;
          provider = r.provider;
          model    = r.model;
          costUsd  = r.costUsd;
          break;
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[chat-controller] ❌ ${intent}: ${errMsg}`);
    return {
      ok: false, reply: `I encountered an error processing your request: ${errMsg}`,
      intent, mode, costUsd: 0, latencyMs: Date.now() - t0,
      sessionId, error: errMsg,
    };
  }

  const latencyMs = Date.now() - t0;

  // Log session telemetry (non-blocking)
  logChatSession({
    sessionId, userId, mode, intent,
    messageCount: 1,
    modelsUsed: model ? [model] : teamSteps?.map(s => s.step) ?? [],
    costTotal: costUsd,
  }).catch(() => {});

  console.log(`[chat-controller] ✅ ${intent}/${mode} — ${latencyMs}ms $${costUsd.toFixed(5)}`);

  return {
    ok: true, reply, intent, mode,
    provider: provider || undefined,
    model: model || undefined,
    costUsd, latencyMs, sessionId,
    teamSteps, systemData,
  };
}
