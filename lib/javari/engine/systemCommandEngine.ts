// lib/javari/engine/systemCommandEngine.ts
// Javari System Command Engine
// Routes parsed JAVARI_COMMAND blocks to appropriate executors:
//   ping_system → health check
//   generate_module / preview_module → Module Factory
//   update_roadmap → Supabase roadmap task updater
//   get_status → platform status summary
//   run_diagnostic → self-heal diagnostic
// Returns structured JSON — never chat text
// 2026-02-19 — P1-003

import type { ParsedCommand } from './commandDetector';
import { runModuleFactory, validateRequest } from '@/lib/javari/modules/engine';
import type { ModuleRequest } from '@/lib/javari/modules/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_zxjzE2qvMWFWqV0AspGvago6aPV5';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5';

export interface SystemCommandResult {
  systemCommandMode: true;
  action: string;
  success: boolean;
  executionMs: number;
  timestamp: string;
  result: Record<string, unknown>;
  logs: string[];
  error?: string;
}

// ── Executor helpers ──────────────────────────────────────────────────────────

function log(logs: string[], msg: string) {
  const ts = new Date().toISOString();
  logs.push(`[${ts}] ${msg}`);
  console.info(`[SystemCmd] ${msg}`);
}

async function supabaseFetch(
  path: string,
  opts: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Action: ping_system ───────────────────────────────────────────────────────

async function executePingSystem(
  cmd: ParsedCommand,
  logs: string[]
): Promise<Record<string, unknown>> {
  log(logs, 'ping_system: checking platform health');

  const [roadmapRes, knowledgeRes] = await Promise.allSettled([
    supabaseFetch('/javari_roadmaps?select=id,status,progress,completed_count&limit=1'),
    supabaseFetch('/javari_knowledge?select=id&limit=1', { headers: { Prefer: 'count=exact' } }),
  ]);

  log(logs, `ping_system: Supabase queries complete`);

  return {
    platform: 'Javari AI OS v2.0',
    status: 'operational',
    supabase: roadmapRes.status === 'fulfilled' ? 'connected' : 'error',
    roadmap: roadmapRes.status === 'fulfilled'
      ? (roadmapRes.value as Array<Record<string,unknown>>)[0] ?? null
      : null,
    moduleFactory: 'operational',
    knowledgeBase: knowledgeRes.status === 'fulfilled' ? 'connected' : 'error',
    systemCommandMode: true,
    timestamp: new Date().toISOString(),
  };
}

// ── Action: generate_module / preview_module ──────────────────────────────────

async function executeModuleGeneration(
  cmd: ParsedCommand,
  preview: boolean,
  logs: string[]
): Promise<Record<string, unknown>> {
  const action = preview ? 'preview_module' : 'generate_module';
  log(logs, `${action}: building ModuleRequest from command fields`);

  // Parse types from fields
  const rawTypes = (cmd.fields['types'] || cmd.fields['type'] || 'full-stack')
    .split(',').map((t) => t.trim().toLowerCase()) as ModuleRequest['types'];
  const validTypes = ['ui', 'api', 'db', 'full-stack'] as const;
  const types = rawTypes.filter((t): t is typeof validTypes[number] =>
    validTypes.includes(t as typeof validTypes[number])
  );

  const req: ModuleRequest = {
    name: cmd.fields['name'] || cmd.name || 'Unnamed Module',
    slug: cmd.fields['slug'] || slugify(cmd.fields['name'] || cmd.name || 'unnamed'),
    description: cmd.fields['description'] || 'Auto-generated module',
    family: (cmd.fields['family'] || 'creative-suite') as ModuleRequest['family'],
    types: types.length > 0 ? types : ['full-stack'],
    creditsPerUse: parseInt(cmd.fields['credits_per_use'] || cmd.fields['credits'] || '1', 10),
    minPlan: (cmd.fields['min_plan'] || cmd.fields['minplan'] || 'free') as ModuleRequest['minPlan'],
    features: (cmd.fields['features'] || '').split(',').map((f) => f.trim()).filter(Boolean),
    autoCommit: !preview && (cmd.fields['auto_commit'] || cmd.fields['autocommit'] || 'false') === 'true',
    autoDeploy: !preview && (cmd.fields['auto_deploy'] || cmd.fields['autodeploy'] || 'false') === 'true',
  };

  log(logs, `${action}: slug=${req.slug} family=${req.family} types=${req.types.join(',')} credits=${req.creditsPerUse}`);

  // Validate request
  const validation = validateRequest(req);
  if (!validation.valid) {
    log(logs, `${action}: request validation failed — ${validation.errors.join('; ')}`);
    throw new Error(`Invalid module request: ${validation.errors.join('; ')}`);
  }

  log(logs, `${action}: running module factory pipeline (dryRun=${preview})`);
  const { module, pipeline } = await runModuleFactory(req, { dryRun: preview });

  log(logs, `${action}: pipeline complete — status=${module.status} score=${module.validation?.score ?? 0}`);

  return {
    slug: req.slug,
    name: req.name,
    status: module.status,
    preview,
    validation: {
      passed: module.validation?.passed ?? false,
      score: module.validation?.score ?? 0,
      errors: module.validation?.errors ?? [],
      warnings: module.validation?.warnings ?? [],
      checks: module.validation?.checks ?? {},
    },
    version: module.version?.semver ?? null,
    artifacts: {
      totalFiles: [
        module.artifacts?.uiPage,
        ...(module.artifacts?.apiRoutes ?? []),
        module.artifacts?.dbMigration,
        module.artifacts?.registryEntry,
        module.artifacts?.readme,
      ].filter(Boolean).length,
      files: [
        module.artifacts?.uiPage?.path,
        ...(module.artifacts?.apiRoutes ?? []).map((f) => f.path),
        module.artifacts?.dbMigration?.path,
        module.artifacts?.registryEntry?.path,
        module.artifacts?.readme?.path,
      ].filter(Boolean),
    },
    commit: module.commit ?? null,
    deploy: module.deploy ?? null,
    generationMs: module.generationMs,
    pipeline: pipeline.steps.map((s) => ({
      name: s.name,
      status: s.status,
      durationMs: s.durationMs ?? null,
      error: s.error ?? null,
    })),
  };
}

// ── Action: get_status ────────────────────────────────────────────────────────

async function executeGetStatus(
  cmd: ParsedCommand,
  logs: string[]
): Promise<Record<string, unknown>> {
  log(logs, 'get_status: fetching platform status');

  const [roadmap, tasks, knowledge] = await Promise.allSettled([
    supabaseFetch('/javari_roadmaps?select=id,title,status,progress,completed_count,updated_at&limit=1'),
    supabaseFetch('/javari_tasks?select=id,task_id,status,phase_id&roadmap_id=eq.javari-os-v2&limit=50'),
    supabaseFetch('/javari_knowledge?select=category&limit=500'),
  ]);

  const tasksByStatus: Record<string, number> = {};
  if (tasks.status === 'fulfilled') {
    for (const t of tasks.value as Array<{status:string}>) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
    }
  }

  const knowledgeRows = knowledge.status === 'fulfilled'
    ? (knowledge.value as Array<{category:string}>)
    : [];
  const byCategory: Record<string, number> = {};
  for (const r of knowledgeRows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }

  log(logs, 'get_status: complete');

  return {
    roadmap: roadmap.status === 'fulfilled'
      ? (roadmap.value as Array<Record<string,unknown>>)[0] ?? null
      : null,
    tasks: tasksByStatus,
    knowledgeBase: {
      totalRows: knowledgeRows.length,
      byCategory,
    },
    moduleFactory: 'operational',
    providerFallbackChain: ['openai', 'anthropic', 'groq', 'mistral', 'openrouter'],
    timestamp: new Date().toISOString(),
  };
}

// ── Action: update_roadmap ────────────────────────────────────────────────────

async function executeUpdateRoadmap(
  cmd: ParsedCommand,
  logs: string[]
): Promise<Record<string, unknown>> {
  const taskId = cmd.fields['task_id'] || cmd.fields['taskid'];
  const status = cmd.fields['status'] || 'complete';
  const result = cmd.fields['result'] || '';

  if (!taskId) throw new Error('update_roadmap requires task_id field');

  log(logs, `update_roadmap: task=${taskId} → ${status}`);

  const body: Record<string, string> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (result) body['result'] = result;
  if (status === 'complete') body['completed_at'] = new Date().toISOString();

  await supabaseFetch(
    `/javari_tasks?id=eq.${taskId}&roadmap_id=eq.javari-os-v2`,
    { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=minimal' } }
  );

  log(logs, `update_roadmap: task ${taskId} updated`);
  return { taskId, newStatus: status, updated: true };
}

// ── Action: run_diagnostic ────────────────────────────────────────────────────

async function executeRunDiagnostic(
  cmd: ParsedCommand,
  logs: string[]
): Promise<Record<string, unknown>> {
  log(logs, 'run_diagnostic: starting self-heal diagnostic');

  const checks: Record<string, boolean | string> = {};

  // Check Supabase
  try {
    await supabaseFetch('/javari_roadmaps?select=id&limit=1');
    checks['supabase'] = true;
    log(logs, 'run_diagnostic: Supabase ✅');
  } catch (e) {
    checks['supabase'] = (e as Error).message.slice(0, 80);
    log(logs, `run_diagnostic: Supabase ❌ ${checks['supabase']}`);
  }

  // Check Module Factory imports
  try {
    validateRequest({
      name: 'Test', slug: 'test', description: 'test module for diag',
      family: 'creative-suite', types: ['ui'], creditsPerUse: 0, minPlan: 'free',
    });
    checks['moduleFactory'] = true;
    log(logs, 'run_diagnostic: Module Factory ✅');
  } catch (e) {
    checks['moduleFactory'] = (e as Error).message.slice(0, 80);
  }

  checks['commandDetection'] = true; // We're here, so detection worked
  checks['systemCommandEngine'] = true;

  const allPass = Object.values(checks).every((v) => v === true);
  log(logs, `run_diagnostic: complete — ${allPass ? 'ALL PASS' : 'SOME FAILURES'}`);

  return {
    allPass,
    checks,
    recommendation: allPass
      ? 'System healthy — proceed with autonomous operations'
      : 'Failures detected — check provider keys and Supabase connectivity',
  };
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function executeSystemCommand(
  cmd: ParsedCommand
): Promise<SystemCommandResult> {
  const t0 = Date.now();
  const logs: string[] = [];
  const timestamp = new Date().toISOString();

  log(logs, `SystemCommandEngine: action=${cmd.action} tag=${cmd.tagName} valid=${cmd.valid}`);

  // Reject invalid commands with structured error
  if (!cmd.valid) {
    return {
      systemCommandMode: true,
      action: cmd.action || 'unknown',
      success: false,
      executionMs: Date.now() - t0,
      timestamp,
      result: {},
      logs,
      error: `Invalid command: ${cmd.errors.join('; ')}`,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (cmd.action) {
      case 'ping_system':
        result = await executePingSystem(cmd, logs);
        break;

      case 'generate_module':
      case 'implement_module_factory_engine': // alias used in some commands
        result = await executeModuleGeneration(cmd, false, logs);
        break;

      case 'preview_module':
        result = await executeModuleGeneration(cmd, true, logs);
        break;

      case 'get_status':
        result = await executeGetStatus(cmd, logs);
        break;

      case 'update_roadmap':
        result = await executeUpdateRoadmap(cmd, logs);
        break;

      case 'run_diagnostic':
        result = await executeRunDiagnostic(cmd, logs);
        break;

      case 'ingest_missing_canonical_documents':
      case 'ingest_docs': {
        // Delegate to the existing ingest-r2 endpoint
        log(logs, 'ingest_docs: delegating to /api/javari/ingest-r2');
        const ingestRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://craudiovizai.com'}/api/javari/ingest-r2`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: process.env.INGEST_SECRET ?? '' }),
          }
        );
        result = await ingestRes.json() as Record<string, unknown>;
        log(logs, `ingest_docs: complete — ${JSON.stringify(result).slice(0, 80)}`);
        break;
      }

      default:
        // Unknown action — still returns structured response
        log(logs, `Unknown action: ${cmd.action} — returning unhandled notice`);
        result = {
          notice: `Action "${cmd.action}" recognized as system command but has no executor registered.`,
          availableActions: [
            'ping_system', 'generate_module', 'preview_module',
            'get_status', 'update_roadmap', 'run_diagnostic', 'ingest_docs',
          ],
        };
    }

    const executionMs = Date.now() - t0;
    log(logs, `SystemCommandEngine: complete in ${executionMs}ms`);

    return {
      systemCommandMode: true,
      action: cmd.action,
      success: true,
      executionMs,
      timestamp,
      result,
      logs,
    };

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(logs, `SystemCommandEngine: ERROR — ${errMsg}`);

    return {
      systemCommandMode: true,
      action: cmd.action,
      success: false,
      executionMs: Date.now() - t0,
      timestamp,
      result: {},
      logs,
      error: errMsg,
    };
  }
}
