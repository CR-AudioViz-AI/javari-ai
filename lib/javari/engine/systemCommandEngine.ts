// lib/javari/engine/systemCommandEngine.ts
// Javari System Command Engine — v2
// 2026-02-20 — JAVARI_PATCH upgrade_system_command_engine
//
// New in v2:
//   - expanded_diagnostic_engine (12 checks)
//   - progress_event_emitter (structured progress steps)
//   - heartbeat_emitter (alive signal every N ms for long ops)
//   - final_report_autoresponse (formatted summary on every action)
//   - structured_logging (timestamped, leveled)
//   - orchestrator_preparation (schedule_task, emit_progress stubs)
//
// Rules enforced:
//   - do_not_modify_module_factory  (factory called via runModuleFactory only)
//   - do_not_generate_tools         (no module generation from diagnostic path)
//   - do_not_trigger_deploys        (autoDeploy always false in diagnostic path)
//   - preserve_existing_systemCommands (all v1 actions kept)

import type { ParsedCommand } from './commandDetector';
import { runModuleFactory, validateRequest } from '@/lib/javari/modules/engine';
import type { ModuleRequest } from '@/lib/javari/modules/types';
import { vault } from '@/lib/javari/secrets/vault';
import { craFetch as internalCraFetch, pingCra } from '@/lib/javari/internal-router';
import { craFetch } from '@/lib/javari/internal-router';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
                   || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// CRA_BASE removed — routing now via @/lib/javari/internal-router
const JAI_BASE      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://javariai.com';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface StructuredLog {
  ts: string;
  level: LogLevel;
  msg: string;
  durationMs?: number;
}

export interface ProgressEvent {
  step: number;
  total: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  durationMs?: number;
}

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

export interface SystemCommandResult {
  systemCommandMode: true;
  action: string;
  success: boolean;
  executionMs: number;
  timestamp: string;
  result: Record<string, unknown>;
  logs: StructuredLog[];
  progress: ProgressEvent[];
  finalReport: string;
  error?: string;
}

// ── Structured logger ─────────────────────────────────────────────────────────

function makeLogger(logs: StructuredLog[]) {
  return {
    info: (msg: string, durationMs?: number) => {
      const entry: StructuredLog = { ts: new Date().toISOString(), level: 'info', msg, durationMs };
      logs.push(entry);
      console.info(`[SCE:info] ${msg}${durationMs != null ? ` (${durationMs}ms)` : ''}`);
    },
    warn: (msg: string) => {
      const entry: StructuredLog = { ts: new Date().toISOString(), level: 'warn', msg };
      logs.push(entry);
      console.warn(`[SCE:warn] ${msg}`);
    },
    error: (msg: string) => {
      const entry: StructuredLog = { ts: new Date().toISOString(), level: 'error', msg };
      logs.push(entry);
      console.error(`[SCE:error] ${msg}`);
    },
    debug: (msg: string) => {
      const entry: StructuredLog = { ts: new Date().toISOString(), level: 'debug', msg };
      logs.push(entry);
    },
  };
}

// ── Progress emitter ──────────────────────────────────────────────────────────

function makeProgress(progress: ProgressEvent[], total: number) {
  let current = 0;
  return {
    start: (label: string): number => {
      current++;
      const idx = progress.length;
      progress.push({ step: current, total, label, status: 'running' });
      return idx;
    },
    done: (idx: number, durationMs?: number) => {
      if (progress[idx]) {
        progress[idx].status = 'done';
        if (durationMs != null) progress[idx].durationMs = durationMs;
      }
    },
    fail: (idx: number, durationMs?: number) => {
      if (progress[idx]) {
        progress[idx].status = 'failed';
        if (durationMs != null) progress[idx].durationMs = durationMs;
      }
    },
  };
}

// ── Heartbeat emitter ─────────────────────────────────────────────────────────
// Logs a heartbeat every intervalMs to prove long ops are still running.

function startHeartbeat(logger: ReturnType<typeof makeLogger>, intervalMs = 10_000): NodeJS.Timeout {
  return setInterval(() => {
    logger.debug(`heartbeat — still running at ${new Date().toISOString()}`);
  }, intervalMs);
}

// ── Supabase fetch helper ──────────────────────────────────────────────────────

async function supabaseFetch(path: string, opts: RequestInit = {}): Promise<unknown> {
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
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  const text = await res.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return text; }
}

// craFetch now imported from @/lib/javari/internal-router


// ══════════════════════════════════════════════════════════════════════════════
// ACTION: ping_system
// ══════════════════════════════════════════════════════════════════════════════

async function executePingSystem(
  _cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const prog = makeProgress(progress, 3);

  const idx1 = prog.start('Supabase connectivity');
  const t1 = Date.now();
  let supabaseStatus = 'error';
  let roadmapData: unknown = null;
  try {
    const r = await supabaseFetch('/javari_roadmaps?select=id,status,progress,completed_count&limit=1');
    supabaseStatus = 'connected';
    roadmapData = (r as Array<Record<string, unknown>>)[0] ?? null;
    prog.done(idx1, Date.now() - t1);
    logger.info('supabase connected', Date.now() - t1);
  } catch (e) {
    prog.fail(idx1, Date.now() - t1);
    logger.error(`supabase: ${(e as Error).message}`);
  }

  const idx2 = prog.start('Knowledge base count');
  const t2 = Date.now();
  let kbRows = 0;
  try {
    const r = await supabaseFetch('/javari_knowledge?select=id&limit=1000');
    kbRows = Array.isArray(r) ? r.length : 0;
    prog.done(idx2, Date.now() - t2);
    logger.info(`knowledge base: ${kbRows} rows`, Date.now() - t2);
  } catch {
    prog.fail(idx2, Date.now() - t2);
  }

  const idx3 = prog.start('Module factory validation');
  const t3 = Date.now();
  let factoryStatus = 'error';
  try {
    validateRequest({
      name: 'Ping Test', slug: 'ping-test', description: 'diag',
      family: 'creative-suite', types: ['ui'], creditsPerUse: 0, minPlan: 'free',
    });
    factoryStatus = 'operational';
    prog.done(idx3, Date.now() - t3);
    logger.info('module factory: operational', Date.now() - t3);
  } catch (e) {
    prog.fail(idx3, Date.now() - t3);
    logger.error(`factory: ${(e as Error).message}`);
  }

  return {
    platform: 'Javari AI OS v2.0',
    status: 'operational',
    supabase: supabaseStatus,
    roadmap: roadmapData,
    moduleFactory: factoryStatus,
    knowledgeBase: { rows: kbRows },
    systemCommandMode: true,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: run_diagnostic — 12 checks
// ══════════════════════════════════════════════════════════════════════════════

async function executeRunDiagnostic(
  cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const TOTAL_CHECKS = 12;
  const prog = makeProgress(progress, TOTAL_CHECKS);
  const checks: DiagnosticCheck[] = [];
  const hb = startHeartbeat(logger, 8_000);

  async function check(
    name: string,
    fn: () => Promise<string>
  ): Promise<void> {
    const idx = prog.start(name);
    const t0 = Date.now();
    try {
      const detail = await fn();
      const ms = Date.now() - t0;
      checks.push({ name, passed: true, detail, durationMs: ms });
      prog.done(idx, ms);
      logger.info(`✅ ${name}: ${detail}`, ms);
    } catch (e) {
      const ms = Date.now() - t0;
      const detail = (e as Error).message.slice(0, 120);
      checks.push({ name, passed: false, detail, durationMs: ms });
      prog.fail(idx, ms);
      logger.error(`❌ ${name}: ${detail}`);
    }
  }

  // 1. central_services — ping via /api/javari-internal (CORS-safe, no auth needed)
  await check('central_services', async () => {
    const r = await craFetch<{ ok?: boolean; service?: string; ms?: number }>(
      '/api/javari-internal?action=ping',
      { useInternalAuth: true, timeoutMs: 8_000 }
    );
    if (!r.ok) throw new Error(`CRA unreachable: ${r.error ?? `status=${r.status}`}`);
    return `CRA "${r.data?.service ?? 'craudiovizai'}" reachable via javari-internal (${r.ms}ms)`;
  });

  // 2. auth_chain — verify auth routes registered
  await check('auth_chain', async () => {
    const r = await craFetch<{ ok?: boolean; endpoints?: string[] }>(
      '/api/javari-internal?action=auth',
      { useInternalAuth: true, timeoutMs: 8_000 }
    );
    if (!r.ok) throw new Error(`CRA auth chain unreachable: ${r.error ?? `status=${r.status}`}`);
    return `Auth routes: ${(r.data?.endpoints ?? []).join(', ')}`;
  });

  // 3. credits_chain — verify credits routes registered
  await check('credits_chain', async () => {
    const r = await craFetch<{ ok?: boolean; endpoints?: string[] }>(
      '/api/javari-internal?action=credits',
      { useInternalAuth: true, timeoutMs: 8_000 }
    );
    if (!r.ok) throw new Error(`CRA credits chain unreachable: ${r.error ?? `status=${r.status}`}`);
    return `Credits routes: ${(r.data?.endpoints ?? []).join(', ')}`;
  });

  // 4. payments_chain — verify payments routes registered
  await check('payments_chain', async () => {
    const r = await craFetch<{ ok?: boolean; endpoints?: string[] }>(
      '/api/javari-internal?action=payments',
      { useInternalAuth: true, timeoutMs: 8_000 }
    );
    if (!r.ok) throw new Error(`CRA payments chain unreachable: ${r.error ?? `status=${r.status}`}`);
    return `Payments routes: ${(r.data?.endpoints ?? []).join(', ')}`;
  });

  // 5. supabase_integrity — roadmap + tasks + knowledge tables
  await check('supabase_integrity', async () => {
    const [rm, tasks, kb] = await Promise.all([
      supabaseFetch('/javari_roadmaps?select=id&limit=1'),
      supabaseFetch('/javari_tasks?select=id&limit=1'),
      supabaseFetch('/javari_knowledge?select=id&limit=1'),
    ]);
    const tables = [rm, tasks, kb].map((r, i) =>
      Array.isArray(r) ? ['roadmaps','tasks','knowledge'][i] + '=ok' : ['roadmaps','tasks','knowledge'][i] + '=fail'
    );
    const allOk = [rm, tasks, kb].every(r => Array.isArray(r));
    if (!allOk) throw new Error(`Table check: ${tables.join(', ')}`);
    return tables.join(', ');
  });

  // 6. template_consistency — generator imports from CRA, not direct Supabase
  await check('template_consistency', async () => {
    // Fetch generator from GitHub via vault token
    const token = vault.get('github');
    if (!token) throw new Error('github token not in vault');
    const r = await fetch(
      'https://api.github.com/repos/CR-AudioViz-AI/javari-ai/contents/lib/javari/modules/generator.ts',
      { headers: { Authorization: `token ${token}` } }
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const data = await r.json() as { content: string };
    const content = Buffer.from(data.content, 'base64').toString();
    const hasCraCredits = content.includes('credits/spend') || content.includes('NEXT_PUBLIC_CRA_URL');
    const hasDirectSupabase = content.includes("from('user_credits')") && !content.includes('CRA');
    if (hasDirectSupabase && !hasCraCredits) throw new Error('Generator still uses direct Supabase credits — needs CRA alignment');
    return `CRA credits integration: ${hasCraCredits ? 'present' : 'via prompt only'}, direct-supabase: ${hasDirectSupabase}`;
  });

  // 7. repo_routing_correctness — writer targets craudiovizai, not javari-ai
  await check('repo_routing_correctness', async () => {
    const token = vault.get('github');
    if (!token) throw new Error('github token not in vault');
    const r = await fetch(
      'https://api.github.com/repos/CR-AudioViz-AI/javari-ai/contents/lib/javari/modules/writer.ts',
      { headers: { Authorization: `token ${token}` } }
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const data = await r.json() as { content: string };
    const content = Buffer.from(data.content, 'base64').toString();
    const targetsCra = content.includes("'craudiovizai'") || content.includes('"craudiovizai"') || content.includes('DEFAULT_REPO_NAME');
    const targetsJavariOnly = content.includes("REPO_NAME = 'javari-ai'") && !targetsCra;
    if (targetsJavariOnly) throw new Error('Writer still hardcoded to javari-ai repo');
    return `Writer target: ${targetsCra ? 'craudiovizai (correct)' : 'configurable (ok)'}`;
  });

  // 8. ecosystem_crawl — count live Vercel projects
  await check('ecosystem_crawl', async () => {
    const vercelToken = vault.get('vercel');
    const teamId = process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5';
    if (!vercelToken) throw new Error('vercel token not in vault');
    const r = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=50`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    if (!r.ok) throw new Error(`Vercel API ${r.status}`);
    const data = await r.json() as { projects: Array<{ name: string; id: string }> };
    const count = data.projects?.length ?? 0;
    return `${count} Vercel projects in ecosystem`;
  });

  // 9. tool_route_validation — verify tool routes exist in craudiovizai
  await check('tool_route_validation', async () => {
    const token = vault.get('github');
    if (!token) throw new Error('github token not in vault');
    const r = await fetch(
      'https://api.github.com/repos/CR-AudioViz-AI/craudiovizai/contents/app/tools',
      { headers: { Authorization: `token ${token}` } }
    );
    if (!r.ok) throw new Error(`GitHub tools dir ${r.status}`);
    const items = await r.json() as Array<{ name: string }>;
    const toolCount = Array.isArray(items) ? items.filter(i => i.name !== 'page.tsx').length : 0;
    return `${toolCount} tool routes in craudiovizai/app/tools`;
  });

  // 10. branding_unification — javari-ai package.json name should not say "crav"
  await check('branding_unification', async () => {
    const token = vault.get('github');
    if (!token) throw new Error('github token not in vault');
    const r = await fetch(
      'https://api.github.com/repos/CR-AudioViz-AI/javari-ai/contents/package.json',
      { headers: { Authorization: `token ${token}` } }
    );
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const data = await r.json() as { content: string };
    const pkg = JSON.parse(Buffer.from(data.content, 'base64').toString());
    const name: string = pkg.name ?? '';
    const hasCrav = name.toLowerCase().includes('crav');
    return `package.json name="${name}" ${hasCrav ? '⚠️ still has Crav branding' : '✅ no Crav branding'}`;
  });

  // 11. ingestion_validity — knowledge base has content
  await check('ingestion_validity', async () => {
    const rows = await supabaseFetch('/javari_knowledge?select=id,category&limit=500') as Array<{ category: string }>;
    if (!Array.isArray(rows)) throw new Error('Knowledge table not accessible');
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    }
    const total = rows.length;
    if (total < 50) throw new Error(`Only ${total} knowledge rows — ingestion may be incomplete`);
    return `${total} rows across ${Object.keys(byCategory).length} categories`;
  });

  // 12. provider_routing — vault has all 7 target providers
  await check('provider_routing', async () => {
    const targets = ['groq','openai','anthropic','mistral','openrouter','xai','perplexity'];
    const missing: string[] = [];
    for (const p of targets) {
      const key = vault.get(p as Parameters<typeof vault.get>[0]);
      if (!key) missing.push(p);
    }
    if (missing.length > 0) throw new Error(`Missing vault keys: ${missing.join(', ')}`);
    return `All 7 providers present: ${targets.join('→')}`;
  });

  clearInterval(hb);

  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed);
  const allPass = failed.length === 0;

  logger.info(`run_diagnostic: ${passed}/${TOTAL_CHECKS} checks passed`);

  return {
    allPass,
    passed,
    total: TOTAL_CHECKS,
    checks: checks.reduce((acc, c) => {
      acc[c.name] = { passed: c.passed, detail: c.detail, durationMs: c.durationMs };
      return acc;
    }, {} as Record<string, unknown>),
    failures: failed.map(c => ({ name: c.name, detail: c.detail })),
    recommendation: allPass
      ? 'All systems aligned. Javari is ready for autonomous roadmap execution.'
      : `${failed.length} issue(s) require attention: ${failed.map(c => c.name).join(', ')}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: generate_module / preview_module (pass-through to factory — unchanged)
// ══════════════════════════════════════════════════════════════════════════════

async function executeModuleGeneration(
  cmd: ParsedCommand,
  preview: boolean,
  logger: ReturnType<typeof makeLogger>,
  progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const action = preview ? 'preview_module' : 'generate_module';
  const prog = makeProgress(progress, 4);

  const idx0 = prog.start('Parse module request');
  const t0 = Date.now();
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
    autoCommit: !preview && (cmd.fields['auto_commit'] || 'false') === 'true',
    autoDeploy: false, // RULE: do_not_trigger_deploys
  };
  prog.done(idx0, Date.now() - t0);
  logger.info(`${action}: slug=${req.slug} family=${req.family} types=${req.types.join(',')}`);

  const idx1 = prog.start('Validate request schema');
  const t1 = Date.now();
  const validation = validateRequest(req);
  if (!validation.valid) {
    prog.fail(idx1, Date.now() - t1);
    throw new Error(`Invalid module request: ${validation.errors.join('; ')}`);
  }
  prog.done(idx1, Date.now() - t1);

  const hb = startHeartbeat(logger, 10_000);
  const idx2 = prog.start('Run module factory pipeline');
  const t2 = Date.now();
  const { module, pipeline } = await runModuleFactory(req, { dryRun: preview });
  prog.done(idx2, Date.now() - t2);
  clearInterval(hb);
  logger.info(`${action}: pipeline complete — status=${module.status} score=${module.validation?.score ?? 0}`, Date.now() - t2);

  const idx3 = prog.start('Assemble result');
  const t3 = Date.now();
  const result = {
    slug: req.slug,
    name: req.name,
    status: module.status,
    preview,
    validation: {
      passed: module.validation?.passed ?? false,
      score: module.validation?.score ?? 0,
      errors: module.validation?.errors ?? [],
      warnings: module.validation?.warnings ?? [],
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
    deploy: null, // do_not_trigger_deploys
    generationMs: module.generationMs,
    pipeline: pipeline.steps.map((s) => ({
      name: s.name, status: s.status,
      durationMs: s.durationMs ?? null,
      error: s.error ?? null,
    })),
  };
  prog.done(idx3, Date.now() - t3);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: get_status
// ══════════════════════════════════════════════════════════════════════════════

async function executeGetStatus(
  _cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const prog = makeProgress(progress, 3);

  const idx0 = prog.start('Fetch roadmap state');
  const t0 = Date.now();
  const [roadmap, tasks, knowledge] = await Promise.allSettled([
    supabaseFetch('/javari_roadmaps?select=id,title,status,progress,completed_count,updated_at&limit=1'),
    supabaseFetch('/javari_tasks?select=id,task_id,status,phase_id&roadmap_id=eq.javari-os-v2&limit=50'),
    supabaseFetch('/javari_knowledge?select=category&limit=500'),
  ]);
  prog.done(idx0, Date.now() - t0);
  logger.info('roadmap state fetched', Date.now() - t0);

  const idx1 = prog.start('Aggregate task stats');
  const t1 = Date.now();
  const tasksByStatus: Record<string, number> = {};
  if (tasks.status === 'fulfilled') {
    for (const t of tasks.value as Array<{status:string}>) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
    }
  }
  prog.done(idx1, Date.now() - t1);

  const idx2 = prog.start('Aggregate knowledge stats');
  const t2 = Date.now();
  const knowledgeRows = knowledge.status === 'fulfilled'
    ? (knowledge.value as Array<{category:string}>)
    : [];
  const byCategory: Record<string, number> = {};
  for (const r of knowledgeRows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }
  prog.done(idx2, Date.now() - t2);

  logger.info('get_status: complete');

  return {
    roadmap: roadmap.status === 'fulfilled'
      ? (roadmap.value as Array<Record<string,unknown>>)[0] ?? null
      : null,
    tasks: tasksByStatus,
    knowledgeBase: { totalRows: knowledgeRows.length, byCategory },
    moduleFactory: 'operational',
    providerFallbackChain: ['groq','openai','anthropic','mistral','openrouter','xai','perplexity'],
    craBase: CRA_BASE,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: update_roadmap
// ══════════════════════════════════════════════════════════════════════════════

async function executeUpdateRoadmap(
  cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  _progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const taskId = cmd.fields['task_id'] || cmd.fields['taskid'];
  const status  = cmd.fields['status'] || 'complete';
  const resultNote = cmd.fields['result'] || '';
  if (!taskId) throw new Error('update_roadmap requires task_id field');
  logger.info(`update_roadmap: task=${taskId} → ${status}`);
  const body: Record<string, string> = { status, updated_at: new Date().toISOString() };
  if (resultNote) body['result'] = resultNote;
  if (status === 'complete') body['completed_at'] = new Date().toISOString();
  await supabaseFetch(
    `/javari_tasks?id=eq.${taskId}&roadmap_id=eq.javari-os-v2`,
    { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=minimal' } }
  );
  logger.info(`update_roadmap: task ${taskId} updated to ${status}`);
  return { taskId, newStatus: status, updated: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: ingest_docs
// ══════════════════════════════════════════════════════════════════════════════

async function executeIngestDocs(
  _cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const prog = makeProgress(progress, 1);
  const idx = prog.start('Trigger R2 ingestion pipeline');
  logger.info('ingest_docs: delegating to /api/javari/ingest-r2');
  const res = await fetch(`${JAI_BASE}/api/javari/ingest-r2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.INGEST_SECRET ?? '' }),
  });
  const data = await res.json() as Record<string, unknown>;
  prog.done(idx);
  logger.info(`ingest_docs: complete — ${JSON.stringify(data).slice(0, 100)}`);
  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION: schedule_task  (orchestrator_preparation stub)
// ══════════════════════════════════════════════════════════════════════════════

async function executeScheduleTask(
  cmd: ParsedCommand,
  logger: ReturnType<typeof makeLogger>,
  _progress: ProgressEvent[]
): Promise<Record<string, unknown>> {
  const taskId   = cmd.fields['task_id'] || cmd.fields['id'] || '';
  const runAt    = cmd.fields['run_at'] || '';
  const payload  = cmd.fields['payload'] || '{}';
  logger.info(`schedule_task: queuing taskId=${taskId} runAt=${runAt || 'immediate'}`);
  // Orchestrator stub — writes to javari_scheduled_tasks when table exists
  try {
    await supabaseFetch('/javari_scheduled_tasks', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        run_at: runAt || new Date().toISOString(),
        payload,
        status: 'queued',
        created_at: new Date().toISOString(),
      }),
    });
    logger.info(`schedule_task: queued`);
    return { queued: true, taskId, runAt };
  } catch (e) {
    logger.warn(`schedule_task: table not yet created — stub response: ${(e as Error).message.slice(0,60)}`);
    return { queued: false, taskId, reason: 'orchestrator_table_pending', stub: true };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FINAL REPORT GENERATOR  (final_report_autoresponse)
// ══════════════════════════════════════════════════════════════════════════════

function buildFinalReport(
  action: string,
  success: boolean,
  result: Record<string, unknown>,
  progress: ProgressEvent[],
  executionMs: number,
  error?: string
): string {
  const lines: string[] = [];
  const icon = success ? '✅' : '❌';
  lines.push(`${icon} **System Command: \`${action}\`** — ${success ? 'SUCCESS' : 'FAILED'} (${executionMs}ms)`);

  if (!success && error) {
    lines.push('', `**Error:** ${error}`);
  }

  // Progress summary
  if (progress.length > 0) {
    lines.push('', '**Steps:**');
    for (const p of progress) {
      const stepIcon = p.status === 'done' ? '✅' : p.status === 'failed' ? '❌' : '⏳';
      lines.push(`  ${stepIcon} ${p.step}/${p.total} ${p.label}${p.durationMs != null ? ` (${p.durationMs}ms)` : ''}`);
    }
  }

  // Action-specific summary
  switch (action) {
    case 'ping_system': {
      const r = result as Record<string, unknown>;
      lines.push('', '**Health:**',
        `  - Supabase: ${r.supabase === 'connected' ? '✅' : '❌'} ${r.supabase}`,
        `  - Module Factory: ${r.moduleFactory === 'operational' ? '✅' : '❌'} ${r.moduleFactory}`,
        `  - Knowledge Base: ${(r.knowledgeBase as { rows?: number })?.rows ?? 0} rows`,
      );
      break;
    }
    case 'run_diagnostic': {
      const r = result as { passed?: number; total?: number; allPass?: boolean; failures?: Array<{name:string;detail:string}> };
      lines.push('', `**Diagnostics: ${r.passed ?? 0}/${r.total ?? 12} passed**`);
      if ((r.failures?.length ?? 0) > 0) {
        lines.push('', '**Failures:**');
        (r.failures ?? []).forEach(f => lines.push(`  ❌ ${f.name}: ${f.detail}`));
      }
      const recKey = 'recommendation';
      if ((result as Record<string,unknown>)[recKey]) {
        lines.push('', `**Recommendation:** ${(result as Record<string,unknown>)[recKey]}`);
      }
      break;
    }
    case 'generate_module':
    case 'preview_module': {
      const r = result as { name?: string; validation?: { score?: number; passed?: boolean }; artifacts?: { totalFiles?: number }; commit?: { sha?: string } | null };
      lines.push('', `**Module:** ${r.name}`,
        `  - Validation: ${r.validation?.passed ? '✅' : '❌'} score=${r.validation?.score ?? 0}/100`,
        `  - Files: ${r.artifacts?.totalFiles ?? 0}`,
      );
      if (r.commit?.sha) lines.push(`  - Commit: \`${(r.commit.sha as string).slice(0,10)}\``);
      break;
    }
    case 'get_status': {
      const r = result as { roadmap?: { progress?: number; completed_count?: number }; knowledgeBase?: { totalRows?: number } };
      lines.push('', `**Roadmap:** ${r.roadmap?.progress ?? 0}% (${r.roadmap?.completed_count ?? 0} tasks complete)`,
        `**Knowledge Base:** ${r.knowledgeBase?.totalRows ?? 0} rows`,
      );
      break;
    }
    case 'update_roadmap': {
      const r = result as { taskId?: string; newStatus?: string };
      lines.push('', `**Updated:** task \`${r.taskId}\` → \`${r.newStatus}\``);
      break;
    }
    default: {
      lines.push('', '```json', JSON.stringify(result, null, 2).slice(0, 600), '```');
    }
  }

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// SLUG HELPER
// ══════════════════════════════════════════════════════════════════════════════

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCHER
// ══════════════════════════════════════════════════════════════════════════════

export async function executeSystemCommand(
  cmd: ParsedCommand
): Promise<SystemCommandResult> {
  const t0 = Date.now();
  const logs: StructuredLog[] = [];
  const progress: ProgressEvent[] = [];
  const timestamp = new Date().toISOString();
  const logger = makeLogger(logs);

  logger.info(`SystemCommandEngine v2: action=${cmd.action} tag=${cmd.tagName} valid=${cmd.valid}`);

  // Reject invalid commands
  if (!cmd.valid) {
    const finalReport = buildFinalReport(cmd.action || 'unknown', false, {},
      progress, 0, `Invalid command: ${cmd.errors.join('; ')}`);
    return {
      systemCommandMode: true,
      action: cmd.action || 'unknown',
      success: false,
      executionMs: Date.now() - t0,
      timestamp,
      result: {},
      logs,
      progress,
      finalReport,
      error: `Invalid command: ${cmd.errors.join('; ')}`,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (cmd.action) {
      case 'ping_system':
        result = await executePingSystem(cmd, logger, progress);
        break;

      case 'generate_module':
      case 'commit_module':
      case 'implement_module_factory_engine':
        result = await executeModuleGeneration(cmd, false, logger, progress);
        break;

      case 'preview_module':
        result = await executeModuleGeneration(cmd, true, logger, progress);
        break;

      case 'get_status':
        result = await executeGetStatus(cmd, logger, progress);
        break;

      case 'update_roadmap':
        result = await executeUpdateRoadmap(cmd, logger, progress);
        break;

      case 'run_diagnostic':
      // JAVARI_PATCH + JAVARI_SYSTEM_REPAIR route here when no specific action
      case 'upgrade_system_command_engine':
      case 'repair':
        result = await executeRunDiagnostic(cmd, logger, progress);
        break;

      case 'ingest_docs':
      case 'ingest_missing_canonical_documents':
        result = await executeIngestDocs(cmd, logger, progress);
        break;

      case 'schedule_task':
      case 'orchestrate':
        result = await executeScheduleTask(cmd, logger, progress);
        break;

      default:
        logger.warn(`Unknown action: ${cmd.action} — returning unhandled notice`);
        result = {
          notice: `Action "${cmd.action}" recognized as system command but has no executor registered.`,
          availableActions: [
            'ping_system','generate_module','preview_module','commit_module',
            'get_status','update_roadmap','run_diagnostic','ingest_docs','schedule_task',
          ],
        };
    }

    const executionMs = Date.now() - t0;
    logger.info(`SystemCommandEngine v2: complete in ${executionMs}ms`);

    const finalReport = buildFinalReport(cmd.action, true, result, progress, executionMs);

    return {
      systemCommandMode: true,
      action: cmd.action,
      success: true,
      executionMs,
      timestamp,
      result,
      logs,
      progress,
      finalReport,
    };

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`SystemCommandEngine v2: ERROR — ${errMsg}`);
    const executionMs = Date.now() - t0;
    const finalReport = buildFinalReport(cmd.action, false, {}, progress, executionMs, errMsg);

    return {
      systemCommandMode: true,
      action: cmd.action,
      success: false,
      executionMs,
      timestamp,
      result: {},
      logs,
      progress,
      finalReport,
      error: errMsg,
    };
  }
}
