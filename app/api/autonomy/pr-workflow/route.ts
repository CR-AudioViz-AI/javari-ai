// app/api/autonomy/pr-workflow/route.ts
// Javari PR Workflow — creates branches, commits fixes, opens PRs, polls CI
// Selects tasks from two sources (Step 3 of Roy's fix request):
//   Priority 1: scanner tasks WHERE metadata->>'issue_type' IN (failing_build, stub_file, todo, unimplemented_route)
//   Priority 2: roadmap_master build tasks WHERE source = 'roadmap_master'
// Guardrails (Step 4): max 3 open javari/ PRs per repo, CI must pass before merge
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { route }        from '@/lib/javari/model-router'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 60

const GH_ORG       = 'CR-AudioViz-AI'
const MAX_OPEN_PRS = 3   // guardrail: max open javari/ PRs per repo

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function ghHeaders() {
  const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN
  return {
    Authorization: `Bearer ${token}`,
    Accept:        'application/vnd.github+json',
    'Content-Type':'application/json',
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
    const prs = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=30`) as
      Array<{ head: { ref: string } }>
    return prs.filter(p => p.head.ref.startsWith('javari/')).length
  } catch { return 0 }
}

async function getCIFailureSummary(repo: string, workflowName: string): Promise<string> {
  try {
    const runs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs?per_page=5&status=failure`
    ) as { workflow_runs: Array<{ id: number; name: string }> }

    const run = runs.workflow_runs.find(r => r.name === workflowName) ?? runs.workflow_runs[0]
    if (!run) return `No recent failures for ${workflowName}`

    const jobs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs/${run.id}/jobs`
    ) as { jobs: Array<{ id: number; name: string; conclusion: string; steps: Array<{ name: string; conclusion: string | null }> }> }

    const failed  = jobs.jobs.filter(j => j.conclusion === 'failure')
    const summary = [`Failing run: ${run.name} (run_id=${run.id})`]

    for (const job of failed.slice(0, 2)) {
      summary.push(`Job: ${job.name}`)
      job.steps.filter(s => s.conclusion === 'failure').forEach(s => summary.push(`  Failed step: ${s.name}`))
      try {
        const logRes = await fetch(
          `https://api.github.com/repos/${GH_ORG}/${repo}/actions/jobs/${job.id}/logs`,
          { headers: ghHeaders() }
        )
        if (logRes.ok || logRes.status === 302) {
          const logUrl  = logRes.headers.get('location') ?? logRes.url
          const logText = await fetch(logUrl).then(r => r.text()).catch(() => '')
          summary.push(`Log tail:\n${logText.slice(-1200).replace(/\u001b\[[0-9;]*m/g, '')}`)
        }
      } catch {}
    }
    return summary.join('\n')
  } catch (err: unknown) {
    return `Could not read CI logs: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function getMainSHA(repo: string): Promise<string> {
  const b = await ghFetch(`/repos/${GH_ORG}/${repo}/git/ref/heads/main`) as { object: { sha: string } }
  return b.object.sha
}

async function createBranch(repo: string, branchName: string, sha: string): Promise<void> {
  try {
    await ghFetch(`/repos/${GH_ORG}/${repo}/git/refs`, 'POST', { ref: `refs/heads/${branchName}`, sha })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('422') && !msg.includes('already exists')) throw err
  }
}

async function commitFile(
  repo: string, branch: string, path: string, content: string, message: string
): Promise<void> {
  let existingSha: string | undefined
  try {
    const e = await ghFetch(`/repos/${GH_ORG}/${repo}/contents/${path}?ref=${branch}`) as { sha: string }
    existingSha = e.sha
  } catch {}
  const body: Record<string, unknown> = { message, branch, content: Buffer.from(content).toString('base64') }
  if (existingSha) body.sha = existingSha
  await ghFetch(`/repos/${GH_ORG}/${repo}/contents/${path}`, 'PUT', body)
}

async function openPR(repo: string, branch: string, title: string, body: string): Promise<number> {
  const pr = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls`, 'POST', {
    title, body, head: branch, base: 'main',
  }) as { number: number }
  return pr.number
}

async function pollCI(repo: string, branch: string, maxWaitMs = 90_000): Promise<'passed' | 'failed' | 'timeout'> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8000))
    try {
      const runs = await ghFetch(
        `/repos/${GH_ORG}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=5`
      ) as { workflow_runs: Array<{ conclusion: string | null; status: string }> }
      const latest = runs.workflow_runs[0]
      if (!latest || latest.status === 'queued' || latest.status === 'in_progress') continue
      if (latest.conclusion === 'success') return 'passed'
      if (latest.conclusion === 'failure' || latest.conclusion === 'cancelled') return 'failed'
    } catch {}
  }
  return 'timeout'
}

async function mergePR(repo: string, prNumber: number): Promise<void> {
  await ghFetch(`/repos/${GH_ORG}/${repo}/pulls/${prNumber}/merge`, 'PUT', {
    merge_method: 'squash',
    commit_title: `fix: autonomous fix via Javari AI (#${prNumber})`,
  })
}

// ── POST — select next eligible task and run full PR workflow ────────────────
export async function POST(req: NextRequest) {
  const start    = Date.now()
  const supabase = db()
  const body     = await req.json().catch(() => ({}))

  // ── Reset any tasks stuck in 'running' > 10 minutes ──────────────────────
  // Defensive: serverless function timeouts can leave tasks stuck
  await supabase.from('roadmap_tasks')
    .update({ status: 'pending', error: 'reset: stuck in running > 10min', updated_at: Date.now() })
    .eq('status', 'running')
    .eq('source', 'roadmap_master')
    .lt('updated_at', Date.now() - 10 * 60 * 1000)

  // ── Task selection ────────────────────────────────────────────────────────
  type TaskRecord = {
    id: string; title: string; description: string; source?: string
    metadata: { repo?: string; issue_type?: string; file?: string; task_type?: string
                module?: string; phase?: string; priority?: string }
  }
  let taskRecord: TaskRecord | null = null

  const taskId = body.task_id as string | undefined

  if (taskId) {
    // Manual: specific task_id in body
    const { data } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata, source').eq('id', taskId).single()
    taskRecord = data
  } else {
    // ── Priority 1: scanner tasks with fixable issue_type ───────────────────
    const { data: scannerTask } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata, source')
      .eq('status', 'pending')
      .filter('metadata->>issue_type', 'in', '("failing_build","stub_file","todo","unimplemented_route")')
      .order('id', { ascending: true })
      .limit(1)
      .single()

    // ── Priority 2: roadmap_master build tasks ───────────────────────────────
    const { data: roadmapTask } = scannerTask ? { data: null } :
      await supabase.from('roadmap_tasks')
        .select('id, title, description, metadata, source')
        .eq('status', 'pending')
        .eq('source', 'roadmap_master')
        .order('id', { ascending: true })
        .limit(1)
        .single()

    taskRecord = scannerTask ?? roadmapTask ?? null
  }

  if (!taskRecord) {
    return NextResponse.json({
      status:  'no_eligible_tasks',
      message: 'No pending scanner tasks (issue_type) or roadmap_master tasks found',
    })
  }

  const meta       = taskRecord.metadata ?? {}
  const isRoadmap  = taskRecord.source === 'roadmap_master'
  const repo       = meta.repo ?? (isRoadmap ? 'javari-ai' : null)

  if (!repo) {
    return NextResponse.json({ error: 'Task has no repo in metadata', task_id: taskRecord.id }, { status: 400 })
  }

  // Guardrail: max 3 open javari/ PRs per repo
  const openCount = await countOpenJavariPRs(repo)
  if (openCount >= MAX_OPEN_PRS) {
    return NextResponse.json({
      status:  'guardrail_hit',
      message: `${openCount} open javari/ PRs in ${repo} (max ${MAX_OPEN_PRS})`,
      task_id: taskRecord.id,
    })
  }

  // Mark running
  await supabase.from('roadmap_tasks').update({ status: 'running', updated_at: Date.now() })
    .eq('id', taskRecord.id)

  const branchName = `javari/task-${taskRecord.id.slice(0, 40)}`
  let prNumber: number | null = null
  let ciResult: 'passed' | 'failed' | 'timeout' | 'no_ci' = 'no_ci'
  let fixContent = ''
  let fixPath    = ''

  try {
    let fixPrompt: string
    let prBody: string

    if (isRoadmap) {
      // ── Roadmap build task: plan + scaffold, don't look for CI failure ──────
      const module   = meta.module ?? taskRecord.title
      const phase    = meta.phase ?? '?'
      const priority = meta.priority ?? 'high'

      fixPrompt = [
        `You are Javari AI building the CR AudioViz AI platform for Roy & Cindy Henderson.`,
        `Mission: "Your Story. Our Design."`,
        ``,
        `ROADMAP BUILD TASK`,
        `Phase: ${phase}`,
        `Module: ${module}`,
        `Priority: ${priority}`,
        `Repo: ${GH_ORG}/${repo}`,
        ``,
        `Task: ${taskRecord.title}`,
        `Description: ${taskRecord.description}`,
        ``,
        `Generate a COMPLETE, production-ready TypeScript implementation file for this module.`,
        `Requirements:`,
        `- Next.js 14 App Router, TypeScript strict mode`,
        `- Supabase for database (use env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`,
        `- Tailwind CSS + shadcn/ui for UI components`,
        `- WCAG 2.2 AA accessibility`,
        `- Full error handling — no unhandled rejections`,
        `- Export as default the main component/function`,
        `Start with: // [JAVARI-BUILD] ${module}`,
        `Return ONLY the TypeScript file content. No markdown fences.`,
      ].join('\n')

      // Target file: lib/javari/modules/{slug}.ts
      const slug = module.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      fixPath = `lib/javari/modules/${slug}.ts`

      prBody = [
        `## 🤖 Javari Autonomous Build`,
        ``,
        `**Phase:** ${phase} — ${meta.phase ? `Phase ${meta.phase}` : 'Platform Infrastructure'}`,
        `**Module:** ${module}`,
        `**Priority:** ${priority}`,
        `**Task ID:** \`${taskRecord.id}\``,
        ``,
        `### What this PR does`,
        `${taskRecord.description}`,
        ``,
        `### File created`,
        `\`${fixPath}\``,
        ``,
        `CI must pass before merge. If CI fails, this PR remains open for review.`,
        ``,
        `_Generated by Javari AI autonomous build layer — CR AudioViz AI platform_`,
      ].join('\n')
    } else {
      // ── Scanner task: read CI logs, generate targeted fix ───────────────────
      const ciLogs = meta.issue_type === 'failing_build'
        ? await getCIFailureSummary(repo, taskRecord.title.replace(/^Fix failing CI: /, '').split(' in ')[0])
        : `Task: ${taskRecord.description}`

      fixPrompt = [
        `You are Javari AI fixing a code issue in repo: ${GH_ORG}/${repo}`,
        `Task: ${taskRecord.title}`,
        `Description: ${taskRecord.description}`,
        meta.file ? `File to fix: ${meta.file}` : '',
        `Issue type: ${meta.issue_type ?? 'unknown'}`,
        ciLogs ? `CI failure details:\n${ciLogs}` : '',
        '',
        `Generate a COMPLETE, working file fix.`,
        `Return ONLY valid TypeScript/JavaScript/YAML — no markdown fences, no explanation.`,
        `Start with: // [JAVARI-FIX] filename`,
      ].filter(Boolean).join('\n')

      fixPath = meta.file
        ?? (meta.issue_type === 'failing_build' ? 'scripts/system-audit.ts' : 'lib/javari/generated-fix.ts')

      prBody = [
        `## Autonomous Fix`,
        ``,
        `Task: \`${taskRecord.id}\``,
        `**Issue:** ${meta.issue_type ?? 'unknown'}`,
        `**AI-generated fix applied to \`${fixPath}\`**`,
        ``,
        `CI must pass before merge.`,
        ``,
        `_Generated by Javari AI autonomous execution layer_`,
      ].join('\n')
    }

    // Generate fix
    const aiResult = await route('coding', fixPrompt, {
      systemPrompt: 'You are Javari AI. Generate precise, production-ready code. Return only the file content, no markdown.',
      maxTier: meta.priority === 'critical' ? 'moderate' : 'low',
    })
    fixContent = aiResult.content

    // Create branch, commit, open PR
    const mainSHA = await getMainSHA(repo)
    await createBranch(repo, branchName, mainSHA)
    await commitFile(repo, branchName, fixPath, fixContent,
      `${isRoadmap ? 'feat' : 'fix'}: ${taskRecord.title} [javari-autonomous]`)
    prNumber = await openPR(repo, branchName,
      `[Javari] ${taskRecord.title}`, prBody)

    // Log job
    await supabase.from('javari_jobs').insert({
      task: taskRecord.title, priority: meta.priority ?? 'normal',
      status: 'running', dry_run: false, triggered_by: 'pr_workflow',
      metadata: { task_id: taskRecord.id, repo, branch: branchName, pr_number: prNumber, source: taskRecord.source },
      started_at: new Date().toISOString(),
    })

    // Poll CI
    ciResult = await pollCI(repo, branchName, 90_000)

    if (ciResult === 'passed') {
      await mergePR(repo, prNumber)
      await supabase.from('roadmap_tasks').update({
        status: 'completed', assigned_model: aiResult.model,
        completed_at: new Date().toISOString(),
        result: `PR #${prNumber} merged after CI passed. File: ${fixPath}`,
        cost: aiResult.cost, updated_at: Date.now(),
      }).eq('id', taskRecord.id)
      await supabase.from('javari_memory').insert({
        memory_type: isRoadmap ? 'fact' : 'fact',
        key:         `pr:${repo}:${prNumber}:merged`,
        value:       `PR #${prNumber} merged. ${fixPath} in ${repo}. CI passed.`,
        source:      'pr_workflow', content: fixContent.slice(0, 4000),
      })
    } else {
      await supabase.from('roadmap_tasks').update({
        status:     'failed',
        error:      `CI ${ciResult} on PR #${prNumber}. Branch: ${branchName}. PR open for review.`,
        updated_at: Date.now(),
      }).eq('id', taskRecord.id)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('roadmap_tasks').update({
      status: 'failed', error: msg.slice(0, 500), updated_at: Date.now(),
    }).eq('id', taskRecord.id)
    return NextResponse.json({ error: msg, task_id: taskRecord.id, duration_ms: Date.now() - start }, { status: 500 })
  }

  return NextResponse.json({
    task_id:    taskRecord.id,
    task_title: taskRecord.title,
    task_source:taskRecord.source,
    repo, branch: branchName, fix_path: fixPath,
    pr_number: prNumber, ci_result: ciResult,
    status: ciResult === 'passed' ? 'merged'
          : ciResult === 'timeout' ? 'pr_open_awaiting_ci'
          : 'pr_open_ci_failed',
    duration_ms: Date.now() - start,
  })
}

// ── GET — open javari/ PR status ─────────────────────────────────────────────
export async function GET() {
  const repos = ['javari-ai','javari-omni-media','javari-forge','javari-sites',
                 'javari-faith-communities','javari-games-hub','javari-social','javari-news']
  const result: Array<{ repo: string; open_prs: number; prs: Array<{ number: number; title: string; branch: string }> }> = []

  for (const repo of repos) {
    try {
      const prs = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=10`) as
        Array<{ number: number; title: string; head: { ref: string } }>
      const javariPRs = prs.filter(p => p.head.ref.startsWith('javari/'))
      if (javariPRs.length > 0)
        result.push({ repo, open_prs: javariPRs.length,
          prs: javariPRs.map(p => ({ number: p.number, title: p.title, branch: p.head.ref })) })
    } catch {}
  }

  return NextResponse.json({
    total_open_javari_prs: result.reduce((s, r) => s + r.open_prs, 0),
    guardrail_limit:       MAX_OPEN_PRS,
    repos:                 result,
    timestamp:             new Date().toISOString(),
  })
}
