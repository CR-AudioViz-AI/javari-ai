// app/api/autonomy/pr-workflow/route.ts
// Javari PR Workflow — for coding tasks:
//   1. Read CI failure logs (don't guess — read the actual error)
//   2. Generate targeted fix via router
//   3. Commit to javari/task-{id} branch
//   4. Open PR
//   5. Poll CI — if passes: merge + mark completed; if fails: mark failed
// Guardrail: max 3 open javari/ PRs simultaneously
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { route }        from '@/lib/javari/model-router'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 60

const GH_ORG    = 'CR-AudioViz-AI'
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

// ── Count open javari/ PRs across org repos ───────────────────────────────────
async function countOpenJavariPRs(repo: string): Promise<number> {
  try {
    const prs = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=30`) as Array<{ head: { ref: string } }>
    return prs.filter(p => p.head.ref.startsWith('javari/')).length
  } catch { return 0 }
}

// ── Read actual CI failure logs ───────────────────────────────────────────────
async function getCIFailureSummary(repo: string, workflowName: string): Promise<string> {
  try {
    const runs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs?per_page=5&status=failure`
    ) as { workflow_runs: Array<{ id: number; name: string; conclusion: string }> }

    const run = runs.workflow_runs.find(r => r.name === workflowName) ?? runs.workflow_runs[0]
    if (!run) return `No recent failures found for ${workflowName}`

    const jobs = await ghFetch(
      `/repos/${GH_ORG}/${repo}/actions/runs/${run.id}/jobs`
    ) as { jobs: Array<{ id: number; name: string; conclusion: string; steps: Array<{ name: string; conclusion: string | null }> }> }

    const failedJobs = jobs.jobs.filter(j => j.conclusion === 'failure')
    const summary: string[] = [`Failing run: ${run.name} (run_id=${run.id})`]

    for (const job of failedJobs.slice(0, 2)) {
      summary.push(`Job: ${job.name}`)
      const failedSteps = job.steps.filter(s => s.conclusion === 'failure')
      failedSteps.forEach(s => summary.push(`  Failed step: ${s.name}`))

      // Try to get logs
      try {
        const logRes = await fetch(
          `https://api.github.com/repos/${GH_ORG}/${repo}/actions/jobs/${job.id}/logs`,
          { headers: ghHeaders() }
        )
        if (logRes.ok || logRes.status === 302) {
          // Follow redirect
          const logUrl = logRes.headers.get('location') ?? logRes.url
          const logText = await fetch(logUrl).then(r => r.text()).catch(() => '')
          // Extract error section — last 1200 chars
          const relevant = logText.slice(-1200).replace(/\u001b\[[0-9;]*m/g, '')
          summary.push(`Log tail:\n${relevant}`)
        }
      } catch {}
    }
    return summary.join('\n')
  } catch (err: unknown) {
    return `Could not read CI logs: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── Get current default branch SHA ────────────────────────────────────────────
async function getMainSHA(repo: string): Promise<string> {
  const branch = await ghFetch(`/repos/${GH_ORG}/${repo}/git/ref/heads/main`) as { object: { sha: string } }
  return branch.object.sha
}

// ── Create branch ─────────────────────────────────────────────────────────────
async function createBranch(repo: string, branchName: string, sha: string): Promise<void> {
  try {
    await ghFetch(`/repos/${GH_ORG}/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`, sha,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('422') && !msg.includes('already exists')) throw err
  }
}

// ── Commit a file to branch ───────────────────────────────────────────────────
async function commitFile(
  repo: string, branch: string, path: string, content: string, message: string
): Promise<void> {
  // Get existing SHA if file exists
  let existingSha: string | undefined
  try {
    const existing = await ghFetch(
      `/repos/${GH_ORG}/${repo}/contents/${path}?ref=${branch}`
    ) as { sha: string }
    existingSha = existing.sha
  } catch {}

  const body: Record<string, unknown> = {
    message, branch,
    content: Buffer.from(content).toString('base64'),
  }
  if (existingSha) body.sha = existingSha

  await ghFetch(`/repos/${GH_ORG}/${repo}/contents/${path}`, 'PUT', body)
}

// ── Open PR ───────────────────────────────────────────────────────────────────
async function openPR(
  repo: string, branch: string, title: string, body: string
): Promise<number> {
  const pr = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls`, 'POST', {
    title, body, head: branch, base: 'main',
  }) as { number: number }
  return pr.number
}

// ── Poll CI status ────────────────────────────────────────────────────────────
async function pollCI(repo: string, branch: string, maxWaitMs = 90_000): Promise<'passed' | 'failed' | 'timeout'> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8000))
    try {
      const runs = await ghFetch(
        `/repos/${GH_ORG}/${repo}/actions/runs?branch=${branch}&per_page=5`
      ) as { workflow_runs: Array<{ conclusion: string | null; status: string }> }

      const latestRun = runs.workflow_runs[0]
      if (!latestRun || latestRun.status === 'queued' || latestRun.status === 'in_progress') continue
      if (latestRun.conclusion === 'success') return 'passed'
      if (latestRun.conclusion === 'failure' || latestRun.conclusion === 'cancelled') return 'failed'
    } catch {}
  }
  return 'timeout'
}

// ── Merge PR ──────────────────────────────────────────────────────────────────
async function mergePR(repo: string, prNumber: number): Promise<void> {
  await ghFetch(`/repos/${GH_ORG}/${repo}/pulls/${prNumber}/merge`, 'PUT', {
    merge_method: 'squash',
    commit_title: `fix: autonomous fix via Javari AI (#${prNumber})`,
  })
}

// ── Main PR workflow ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const start    = Date.now()
  const supabase = db()
  const body     = await req.json().catch(() => ({}))

  // Accept task_id directly, or pull next pending coding task
  let taskId     = body.task_id as string | undefined
  let taskRecord: {
    id: string; title: string; description: string
    metadata: { repo?: string; issue_type?: string; file?: string; task_type?: string }; source?: string
  } | null = null

  if (taskId) {
    const { data } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata').eq('id', taskId).single()
    taskRecord = data
  } else {
    // Priority 1: scanner tasks with fixable issue_type
    const { data: scannerTask } = await supabase.from('roadmap_tasks')
      .select('id, title, description, metadata')
      .eq('status', 'pending')
      .filter('metadata->>issue_type', 'in', '("failing_build","stub_file","todo","unimplemented_route")')
      .order('id', { ascending: true })
      .limit(1)
      .single()

    // Priority 2: roadmap_master build tasks (source='roadmap_master')
    const { data: roadmapTask } = scannerTask ? { data: null } :
      await supabase.from('roadmap_tasks')
        .select('id, title, description, metadata')
        .eq('status', 'pending')
        .eq('source', 'roadmap_master')
        .order('id', { ascending: true })
        .limit(1)
        .single()

    taskRecord = scannerTask ?? roadmapTask ?? null
  }

  if (!taskRecord) {
    return NextResponse.json({ status: 'no_eligible_tasks',
      message: 'No pending coding tasks with fixable issue types' })
  }

  const meta = taskRecord.metadata ?? {}
  const repo = meta.repo
  if (!repo) {
    return NextResponse.json({ error: 'Task has no repo in metadata', task_id: taskRecord.id }, { status: 400 })
  }

  // Step 5 guardrail: max 3 open javari/ PRs
  const openCount = await countOpenJavariPRs(repo)
  if (openCount >= MAX_OPEN_PRS) {
    return NextResponse.json({
      status:  'guardrail_hit',
      message: `${openCount} open javari/ PRs in ${repo} (max ${MAX_OPEN_PRS})`,
      task_id: taskRecord.id,
    })
  }

  // Mark task as running
  await supabase.from('roadmap_tasks').update({
    status: 'running', updated_at: Date.now(),
  }).eq('id', taskRecord.id)

  const branchName = `javari/task-${taskRecord.id.slice(0, 40)}`
  let prNumber: number | null = null
  let ciResult: 'passed' | 'failed' | 'timeout' | 'no_ci' = 'no_ci'
  let fixContent = ''
  let fixPath    = ''

  try {
    // Step 1: Read actual CI failure logs
    const ciLogs = meta.issue_type === 'failing_build'
      ? await getCIFailureSummary(repo, taskRecord.title.replace(/^Fix failing CI: /, '').split(' in ')[0])
      : 'No CI failure — task is: ' + taskRecord.description

    // Step 2: Generate fix via AI router
    const fixPrompt = [
      `You are Javari AI fixing a real code issue in repo: ${GH_ORG}/${repo}`,
      `Task: ${taskRecord.title}`,
      `Description: ${taskRecord.description}`,
      meta.file ? `File to fix: ${meta.file}` : '',
      `Issue type: ${meta.issue_type}`,
      ciLogs ? `CI failure details:\n${ciLogs}` : '',
      '',
      'Generate a COMPLETE, working file fix.',
      'Return ONLY valid TypeScript/JavaScript code — no markdown fences, no explanation.',
      'If fixing a workflow file, return the complete YAML.',
      'Start with a comment: // [JAVARI-FIX] filename',
    ].filter(Boolean).join('\n')

    const aiResult = await route('coding', fixPrompt, {
      systemPrompt: 'You are Javari AI. Generate precise, production-ready code fixes. Return only the fixed file content, no markdown.',
      maxTier:      'low',
    })

    fixContent = aiResult.content
    // Determine which file to fix
    if (meta.file) {
      fixPath = meta.file
    } else if (meta.issue_type === 'failing_build') {
      fixPath = 'scripts/system-audit.ts'  // default for audit failures
    } else {
      fixPath = 'lib/javari/generated-fix.ts'
    }

    // Step 1: Create branch
    const mainSHA = await getMainSHA(repo)
    await createBranch(repo, branchName, mainSHA)

    // Step 2: Commit fix
    await commitFile(repo, branchName, fixPath, fixContent,
      `fix: ${taskRecord.title} [javari-autonomous]`)

    // Step 4: Open PR
    prNumber = await openPR(repo, branchName,
      `[Javari] ${taskRecord.title}`,
      `## Autonomous Fix\n\nTask: \`${taskRecord.id}\`\n\n**Issue:** ${meta.issue_type}\n\n**AI-generated fix applied to \`${fixPath}\`**\n\nCI must pass before merge.\n\n_Generated by Javari AI autonomous execution layer_`
    )

    // Write PR to jobs table
    await supabase.from('javari_jobs').insert({
      task:         taskRecord.title,
      priority:     'normal',
      status:       'running',
      dry_run:      false,
      triggered_by: 'pr_workflow',
      metadata:     { task_id: taskRecord.id, repo, branch: branchName, pr_number: prNumber },
      started_at:   new Date().toISOString(),
    })

    // Step 3: Poll CI
    ciResult = await pollCI(repo, branchName, 90_000)

    if (ciResult === 'passed') {
      // Step 4: Merge PR
      await mergePR(repo, prNumber)
      await supabase.from('roadmap_tasks').update({
        status:         'completed',
        assigned_model: aiResult.model,
        completed_at:   new Date().toISOString(),
        result:         `PR #${prNumber} merged after CI passed. Fixed: ${fixPath}`,
        cost:           aiResult.cost,
        updated_at:     Date.now(),
      }).eq('id', taskRecord.id)

      await supabase.from('javari_memory').insert({
        memory_type: 'fact',
        key:         `pr:${repo}:${prNumber}:merged`,
        value:       `PR #${prNumber} merged. Fixed ${fixPath} in ${repo}. CI passed.`,
        source:      'pr_workflow',
        content:     fixContent.slice(0, 4000),
      })
    } else {
      // CI failed or timeout — mark task as failed, leave PR open for review
      await supabase.from('roadmap_tasks').update({
        status:     'failed',
        error:      `CI ${ciResult} on PR #${prNumber}. Branch: ${branchName}. PR left open for review.`,
        updated_at: Date.now(),
      }).eq('id', taskRecord.id)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('roadmap_tasks').update({
      status:     'failed',
      error:      msg.slice(0, 500),
      updated_at: Date.now(),
    }).eq('id', taskRecord.id)
    return NextResponse.json({ error: msg, task_id: taskRecord.id, duration_ms: Date.now() - start }, { status: 500 })
  }

  return NextResponse.json({
    task_id:     taskRecord.id,
    task_title:  taskRecord.title,
    repo,
    branch:      branchName,
    fix_path:    fixPath,
    pr_number:   prNumber,
    ci_result:   ciResult,
    status:      ciResult === 'passed' ? 'merged' : ciResult === 'timeout' ? 'pr_open_awaiting_ci' : 'pr_open_ci_failed',
    duration_ms: Date.now() - start,
  })
}

// ── GET — status of open javari PRs ──────────────────────────────────────────
export async function GET() {
  // Return overview of open javari/ PRs across recently-scanned repos
  const repos = ['javari-ai', 'javari-omni-media', 'javari-forge', 'javari-sites',
                 'javari-faith-communities', 'javari-games-hub', 'javari-social']
  const result: Array<{ repo: string; open_prs: number; prs: Array<{ number: number; title: string; branch: string }> }> = []

  for (const repo of repos) {
    try {
      const prs = await ghFetch(`/repos/${GH_ORG}/${repo}/pulls?state=open&per_page=10`) as
        Array<{ number: number; title: string; head: { ref: string } }>
      const javariPRs = prs.filter(p => p.head.ref.startsWith('javari/'))
      if (javariPRs.length > 0) {
        result.push({
          repo,
          open_prs: javariPRs.length,
          prs:      javariPRs.map(p => ({ number: p.number, title: p.title, branch: p.head.ref })),
        })
      }
    } catch {}
  }

  return NextResponse.json({
    total_open_javari_prs: result.reduce((s, r) => s + r.open_prs, 0),
    guardrail_limit:       MAX_OPEN_PRS,
    repos:                 result,
    timestamp:             new Date().toISOString(),
  })
}
