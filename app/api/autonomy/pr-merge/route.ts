// app/api/autonomy/pr-merge/route.ts
// Phase 2 — CI verification and merge.
// Runs every 3 minutes via cron. Checks all open Javari PRs.
// For each: query GitHub check-runs → if passed: merge + complete task
//           if failed: mark task failed, close PR
//           if pending: do nothing (check again next cycle)
// No CI polling loop — one status check per invocation, returns immediately.
// Saturday, March 14, 2026
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 30   // fast — no polling loops

const GH_ORG = 'CR-AudioViz-AI'

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

type CIStatus = 'passed' | 'failed' | 'pending' | 'no_checks'

async function getCIStatus(repo: string, branch: string): Promise<CIStatus> {
  try {
    // Get the HEAD commit SHA of the branch
    const ref = await ghFetch(
      `/repos/${GH_ORG}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
    ) as { object: { sha: string } }
    const sha = ref.object.sha

    // Check combined status + check-runs
    const [statusRes, checkRunsRes] = await Promise.all([
      ghFetch(`/repos/${GH_ORG}/${repo}/commits/${sha}/status`) as
        Promise<{ state: string; total_count: number }>,
      ghFetch(`/repos/${GH_ORG}/${repo}/commits/${sha}/check-runs`) as
        Promise<{ check_runs: Array<{ status: string; conclusion: string | null; name: string }> }>,
    ])

    const checkRuns   = checkRunsRes.check_runs ?? []
    const totalChecks = checkRuns.length

    if (totalChecks === 0 && statusRes.total_count === 0) return 'no_checks'

    // Check-runs: all must be completed
    const incomplete = checkRuns.filter(c => c.status !== 'completed')
    if (incomplete.length > 0) return 'pending'

    // Any failure?
    const failures = checkRuns.filter(
      c => c.conclusion === 'failure' || c.conclusion === 'cancelled'
    )
    if (failures.length > 0) return 'failed'

    // Combined status
    if (statusRes.state === 'failure') return 'failed'
    if (statusRes.state === 'pending') return 'pending'

    return 'passed'
  } catch (err: unknown) {
    // Can't read CI state — treat as pending (check next cycle)
    console.warn('[pr-merge] getCIStatus error:', err instanceof Error ? err.message : err)
    return 'pending'
  }
}

async function mergePR(repo: string, prNumber: number, title: string): Promise<void> {
  await ghFetch(`/repos/${GH_ORG}/${repo}/pulls/${prNumber}/merge`, 'PUT', {
    merge_method:  'squash',
    commit_title:  `fix: ${title} [javari-autonomous] (#${prNumber})`,
  })
}

async function closePR(repo: string, prNumber: number): Promise<void> {
  await ghFetch(`/repos/${GH_ORG}/${repo}/pulls/${prNumber}`, 'PATCH', {
    state: 'closed',
  })
}

// ── GET — called by cron every 3 minutes ──────────────────────────────────────
export async function GET() {
  const start    = Date.now()
  const supabase = db()
  const results: Array<{
    job_id: string; pr: number; repo: string; ci: CIStatus; action: string
  }> = []

  // Find all javari_jobs with status='pr_open'
  const { data: openJobs } = await supabase
    .from('javari_jobs')
    .select('id, task, metadata, started_at')
    .eq('status', 'pr_open')
    .order('started_at', { ascending: true })
    .limit(10)

  if (!openJobs?.length) {
    return NextResponse.json({
      status:    'idle',
      message:   'No open PR jobs to check',
      checked:   0,
      timestamp: new Date().toISOString(),
    })
  }

  for (const job of openJobs) {
    const meta     = (job.metadata ?? {}) as Record<string, unknown>
    const repo     = meta.repo     as string
    const branch   = meta.branch   as string
    const prNumber = meta.pr_number as number
    const taskId   = meta.task_id  as string
    const fixPath  = meta.fix_path as string

    if (!repo || !branch || !prNumber || !taskId) continue

    let action = 'checked'

    try {
      const ciStatus = await getCIStatus(repo, branch)

      if (ciStatus === 'passed' || ciStatus === 'no_checks') {
        // Merge PR
        await mergePR(repo, prNumber, job.task ?? 'Javari fix')

        // Mark job complete
        await supabase.from('javari_jobs')
          .update({
            status:       'complete',
            completed_at: new Date().toISOString(),
            result:       {
              ci_status: ciStatus,
              merged_pr: prNumber,
              fix_path:  fixPath,
            },
          }).eq('id', job.id)

        // Mark roadmap task completed
        await supabase.from('roadmap_tasks')
          .update({
            status:         'completed',
            assigned_model: meta.ai_model as string ?? 'gpt-4o-mini',
            completed_at:   new Date().toISOString(),
            result:         `PR #${prNumber} merged. CI: ${ciStatus}. File: ${fixPath}`,
            cost:           meta.ai_cost as number ?? 0,
            updated_at:     Date.now(),
          }).eq('id', taskId)

        // Write memory
        await supabase.from('javari_memory').insert({
          memory_type: 'fact',
          key:         `pr:${repo}:${prNumber}:merged`,
          value:       `PR #${prNumber} merged in ${repo}. CI ${ciStatus}. Task: ${taskId}`,
          source:      'pr_merge_phase2',
        })

        action = 'merged'

      } else if (ciStatus === 'failed') {
        // Close PR, mark task failed
        await closePR(repo, prNumber)

        await supabase.from('javari_jobs')
          .update({
            status:       'failed',
            completed_at: new Date().toISOString(),
            result:       { ci_status: 'failed', pr_number: prNumber },
          }).eq('id', job.id)

        await supabase.from('roadmap_tasks')
          .update({
            status:     'failed',
            error:      `CI failed on PR #${prNumber}. Branch: ${branch}. PR closed.`,
            updated_at: Date.now(),
          }).eq('id', taskId)

        action = 'ci_failed_closed'

      } else {
        // pending — do nothing, check next cycle
        action = 'pending_ci'
      }

      results.push({ job_id: job.id, pr: prNumber, repo, ci: ciStatus, action })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ job_id: job.id, pr: prNumber, repo, ci: 'pending', action: `error:${msg.slice(0,60)}` })
    }
  }

  const merged  = results.filter(r => r.action === 'merged').length
  const pending = results.filter(r => r.action === 'pending_ci').length
  const failed  = results.filter(r => r.action === 'ci_failed_closed').length

  return NextResponse.json({
    status:      merged > 0 ? 'merged' : pending > 0 ? 'waiting_for_ci' : 'checked',
    checked:     results.length,
    merged, pending, failed,
    results,
    duration_ms: Date.now() - start,
    timestamp:   new Date().toISOString(),
  })
}
