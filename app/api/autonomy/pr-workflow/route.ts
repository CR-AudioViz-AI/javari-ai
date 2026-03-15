// app/api/autonomy/pr-workflow/route.ts
// Phase 1 ONLY — create branch + commit + open PR, return immediately.
// Does NOT wait for CI. CI checking and merging is handled by /api/autonomy/pr-merge.
// Guardrail: max 3 open javari/ PRs per repo (checked before creating).
// Cron: */5 * * * *
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { route }        from '@/lib/javari/model-router'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 30   // well within limit — no CI polling

const GH_ORG       = 'CR-AudioViz-AI'
const MAX_OPEN_PRS = 3

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function ghHeaders() {
  const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN
  return {
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

async function ghFetch(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: ghHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub ${method} ${path}: ${res.status} — ${err.slice(0, 200)}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function countOpenJavariPRs(repo: string): Promise<number> {
  try {
    const prs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=30`
    ) as Array<{ head: { ref: string } }>
    return prs.filter(p => p.head.ref.startsWith('javari/')).length
  } catch { return 0 }
}

async function getMainSHA(repo: string): Promise<string> {
  const b = await ghFetch(
    `/repos/${GH_ORG}/${repo}/git/ref/heads/main`
  ) as { object: { sha: string } }
  return b.object.sha
}

async function createBranch(repo: string, branch: string, sha: string): Promise<void> {
  try {
    await ghFetch(`/repos/${GH_ORG}/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branch}`, sha,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('422') && !msg.includes('already exists')) throw err
  }
}

async function commitFile(
  repo: string, branch: string, path: string,
  content: string, message: string
): Promise<void> {
  let existingSha: string | undefined
  try {
    const e = await ghFetch(
      `/repos/${GH_ORG}/${repo}/contents/${path}?ref=${branch}`
    ) as { sha: string }
    existingSha = e.sha
  } catch {}
  const body: Record<string, unknown> = {
    message, branch,
    content: Buffer.from(content).toString('base64'),
  }
  if (existingSha) body.sha = existingSha
  await ghFetch(`/repos/${GH_ORG}/${repo}/contents/${path}`, 'PUT', body)
}

async function openPR(
  repo: string, branch: string, title: string, body: string
): Promise<{ number: number; url: string }> {
  const pr = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls`, 'POST', {
    title, body, head: branch, base: 'main',
  }) as { number: number; html_url: string }
  return { number: pr.number, url: pr.html_url }
}

async function getCIContext(repo: string, issueType: string, title: string): Promise<string> {
  if (issueType !== 'failing_build') return ''
  try {
    const workflowName = title.replace(/^Fix failing CI: /, '').split(' in ')[0]
    const runs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs?per_page=3&status=failure`
    ) as { workflow_runs: Array<{ id: number; name: string }> }
    const run = runs.workflow_runs.find(r => r.name === workflowName) ?? runs.workflow_runs[0]
    if (!run) return ''
    const jobs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs/${run.id}/jobs`
    ) as { jobs: Array<{ id: number; name: string; conclusion: string; steps: Array<{ name: string; conclusion: string | null }> }> }
    const failed = jobs.jobs.filter(j => j.conclusion === 'failure')
    const lines  = [`CI failure: ${run.name}`]
    for (const job of failed.slice(0, 2)) {
      lines.push(`Job: ${job.name}`)
      job.steps.filter(s => s.conclusion === 'failure')
               .forEach(s => lines.push(`  Failed: ${s.name}`))
    }
    return lines.join('\n')
  } catch { return '' }
}

// ── POST — Phase 1: create branch, commit, open PR, return immediately ────────
export async function POST(req: NextRequest) {
  const start    = Date.now()
  const supabase = db()
  const body     = await req.json().catch(() => ({}))

  // Reset tasks stuck in running > 10 min (defensive against prior timeouts)
  await supabase.from('roadmap_tasks')
    .update({ status: 'pending', error: 'reset: stuck running > 10min', updated_at: Date.now() })
    .eq('status', 'running')
    .in('source', ['roadmap_master', 'javari_scanner'])
    .lt('updated_at', Date.now() - 10 * 60 * 1000)

  type TaskRecord = {
    id: string; title: string; description: string; source?: string
    metadata: {
      repo?: string; issue_type?: string; file?: string
      task_type?: string; module?: string; phase?: string; priority?: string
    }
  }
  let taskRecord: TaskRecord | null = null

  const taskId = body.task_id as string | undefined
  if (taskId) {
    const { data } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata, source').eq('id', taskId).single()
    taskRecord = data
  } else {
    // Priority 1: scanner tasks with fixable issue_type
    const { data: scannerTask } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata, source')
      .eq('status', 'pending')
      .filter('metadata->>issue_type', 'in',
        '("failing_build","stub_file","todo","unimplemented_route")')
      .order('id', { ascending: true }).limit(1).single()

    // Priority 2: roadmap_master build tasks
    const { data: roadmapTask } = scannerTask ? { data: null } :
      await supabase.from('roadmap_tasks')
        .select('id, title, description, metadata, source')
        .eq('status', 'pending')
        .eq('source', 'roadmap_master')
        .order('id', { ascending: true }).limit(1).single()

    taskRecord = scannerTask ?? roadmapTask ?? null
  }

  if (!taskRecord) {
    return NextResponse.json({
      status: 'no_eligible_tasks',
      message: 'No pending scanner or roadmap_master tasks found',
    })
  }

  const meta      = taskRecord.metadata ?? {}
  const isRoadmap = taskRecord.source === 'roadmap_master'
  const repo      = meta.repo ?? (isRoadmap ? 'javari-ai' : null)
  if (!repo) {
    return NextResponse.json(
      { error: 'Task missing repo', task_id: taskRecord.id }, { status: 400 }
    )
  }

  // Guardrail: max 3 open javari/ PRs per repo
  const openCount = await countOpenJavariPRs(repo)
  if (openCount >= MAX_OPEN_PRS) {
    return NextResponse.json({
      status:  'guardrail_hit',
      message: `${openCount}/${MAX_OPEN_PRS} open Javari PRs in ${repo}`,
      task_id: taskRecord.id,
    })
  }

  // Mark running
  await supabase.from('roadmap_tasks')
    .update({ status: 'running', updated_at: Date.now() })
    .eq('id', taskRecord.id)

  const branch = `javari/task-${taskRecord.id.slice(0, 40)}`
  let   fixPath    = ''
  let   prNumber   = 0
  let   prUrl      = ''

  try {
    // Build prompt + determine fix path
    let fixPrompt: string
    let prBody: string

    if (isRoadmap) {
      const module   = meta.module ?? taskRecord.title
      const phase    = meta.phase ?? '?'
      const priority = meta.priority ?? 'high'
      const slug     = module.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      fixPath = `lib/javari/modules/${slug}.ts`

      fixPrompt = [
        `You are Javari AI building the CR AudioViz AI platform for Roy & Cindy Henderson.`,
        `Mission: "Your Story. Our Design."`,
        ``,
        `ROADMAP BUILD TASK`,
        `Phase: ${phase}  Module: ${module}  Priority: ${priority}`,
        `Repo: ${GH_ORG}/${repo}`,
        `Task: ${taskRecord.title}`,
        `Description: ${taskRecord.description}`,
        ``,
        `Generate a COMPLETE, production-ready TypeScript implementation.`,
        `Stack: Next.js 14 App Router, TypeScript strict, Supabase, Tailwind CSS, shadcn/ui.`,
        `Requirements: WCAG 2.2 AA, full error handling, default export.`,
        `Return ONLY the file content — no markdown fences.`,
        `Start with: // [JAVARI-BUILD] ${module}`,
      ].join('\n')

      prBody = [
        `## 🤖 Javari Autonomous Build`,
        ``,
        `**Phase:** ${phase} | **Module:** ${module} | **Priority:** ${priority}`,
        `**Task ID:** \`${taskRecord.id}\``,
        ``,
        taskRecord.description,
        ``,
        `**File:** \`${fixPath}\``,
        ``,
        `_CI must pass for auto-merge via /api/autonomy/pr-merge cron._`,
      ].join('\n')
    } else {
      const ciContext = await getCIContext(repo, meta.issue_type ?? '', taskRecord.title)
      fixPath = meta.file
        ?? (meta.issue_type === 'failing_build' ? 'scripts/system-audit.ts'
                                                : 'lib/javari/generated-fix.ts')

      fixPrompt = [
        `You are Javari AI fixing a code issue in ${GH_ORG}/${repo}.`,
        `Task: ${taskRecord.title}`,
        `Description: ${taskRecord.description}`,
        meta.file ? `File: ${meta.file}` : '',
        `Issue type: ${meta.issue_type ?? 'unknown'}`,
        ciContext,
        ``,
        `Generate a COMPLETE working fix. Return ONLY file content — no markdown fences.`,
        `Start with: // [JAVARI-FIX] filename`,
      ].filter(Boolean).join('\n')

      prBody = [
        `## Autonomous Fix`,
        `**Task:** \`${taskRecord.id}\` | **Issue:** ${meta.issue_type ?? 'unknown'}`,
        `**File:** \`${fixPath}\``,
        ``,
        `_CI must pass for auto-merge via /api/autonomy/pr-merge cron._`,
      ].join('\n')
    }

    // Generate code
    const aiResult = await route('coding', fixPrompt, {
      systemPrompt: 'You are Javari AI. Return only production-ready file content, no markdown.',
      maxTier: meta.priority === 'critical' ? 'moderate' : 'low',
    })

    // Create branch → commit → open PR
    const mainSHA = await getMainSHA(repo)
    await createBranch(repo, branch, mainSHA)
    await commitFile(repo, branch, fixPath, aiResult.content,
      `${isRoadmap ? 'feat' : 'fix'}: ${taskRecord.title} [javari-autonomous]`)
    const pr = await openPR(repo, branch,
      `[Javari] ${taskRecord.title}`, prBody)
    prNumber = pr.number
    prUrl    = pr.url

    // Record in javari_jobs — Phase 2 (pr-merge) reads this to know what to check
    await supabase.from('javari_jobs').insert({
      task:         taskRecord.title,
      priority:     meta.priority ?? 'normal',
      status:       'running',    // pr-merge queries triggered_by=pr_workflow_phase1
      dry_run:      false,
      triggered_by: 'pr_workflow_phase1',
      metadata: {
        task_id:        taskRecord.id,
        task_source:    taskRecord.source,
        repo,
        branch,
        pr_number:      prNumber,
        fix_path:       fixPath,
        ai_model:       aiResult.model,
        ai_cost:        aiResult.cost,
        phase1_done_at: new Date().toISOString(),
      },
      started_at: new Date().toISOString(),
    })

    // Leave roadmap_task in 'running' — pr-merge will update to completed/failed
    // (already set to running above — do not change here)

    return NextResponse.json({
      status:      'pr_opened',  // response only — job stored as 'running'
      task_id:     taskRecord.id,
      task_title:  taskRecord.title,
      task_source: taskRecord.source,
      repo, branch, fix_path: fixPath,
      pr_number:   prNumber,
      pr_url:      prUrl,
      model:       aiResult.model,
      cost:        `$${aiResult.cost.toFixed(5)}`,
      message:     'PR opened. CI check and merge handled by /api/autonomy/pr-merge on next cycle.',
      duration_ms: Date.now() - start,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('roadmap_tasks')
      .update({ status: 'failed', error: msg.slice(0, 500), updated_at: Date.now() })
      .eq('id', taskRecord.id)
    return NextResponse.json(
      { error: msg, task_id: taskRecord.id, duration_ms: Date.now() - start },
      { status: 500 }
    )
  }
}

// ── GET — open Javari PR status across all repos ──────────────────────────────
export async function GET() {
  const repos = [
    'javari-ai','javari-omni-media','javari-forge','javari-sites',
    'javari-faith-communities','javari-games-hub','javari-social','javari-news',
  ]
  const result: Array<{
    repo: string; open_prs: number
    prs: Array<{ number: number; title: string; branch: string }>
  }> = []

  for (const repo of repos) {
    try {
      const prs = await ghFetch(
        `/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=10`
      ) as Array<{ number: number; title: string; head: { ref: string } }>
      const javariPRs = prs.filter(p => p.head.ref.startsWith('javari/'))
      if (javariPRs.length > 0) {
        result.push({
          repo,
          open_prs: javariPRs.length,
          prs: javariPRs.map(p => ({
            number: p.number, title: p.title, branch: p.head.ref,
          })),
        })
      }
    } catch {}
  }

  return NextResponse.json({
    total_open_javari_prs:  result.reduce((s, r) => s + r.open_prs, 0),
    guardrail_limit:        MAX_OPEN_PRS,
    repos:                  result,
    timestamp:              new Date().toISOString(),
  })
}
