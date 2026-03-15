// app/api/autonomy/scan/route.ts
// Javari Autonomous Scanner — scans CR-AudioViz-AI repos, generates roadmap tasks
// Runs every 10 minutes via Vercel cron
// Guardrail: max 10 tasks per scan, deduplicates by task hash
// Saturday, March 14, 2026
import { NextResponse }  from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { createHash }    from 'crypto'
export const dynamic    = 'force-dynamic'
export const runtime    = 'nodejs'
export const maxDuration = 60

const GH_ORG      = 'CR-AudioViz-AI'
const MAX_TASKS   = 10
const MAX_REPOS   = 15   // scan newest-pushed repos per cycle

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function ghFetch(path: string): Promise<unknown> {
  const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN
  const res   = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept:        'application/vnd.github+json',
    },
    // Next.js cache: revalidate every 5 min
    next: { revalidate: 300 },
  } as RequestInit)
  if (!res.ok) return null
  return res.json()
}

// ── Task hash for deduplication ───────────────────────────────────────────────
function taskHash(repo: string, issue: string): string {
  return createHash('sha256').update(`${repo}:${issue}`).digest('hex').slice(0, 16)
}

// ── Detect issues in a repo ───────────────────────────────────────────────────
interface DetectedIssue {
  type:        'failing_build' | 'stub_file' | 'todo' | 'missing_tests' | 'unimplemented_route' | 'build_error'
  severity:    'low' | 'medium' | 'high'
  title:       string
  description: string
  file?:       string
  taskType:    'coding' | 'planning' | 'verification'
}

async function scanRepo(repoName: string): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = []

  // Check latest workflow run — failing builds
  const runs = await ghFetch(
    `/repos/${GH_ORG}/${repoName}/actions/runs?per_page=3&status=failure`
  ) as { workflow_runs?: Array<{ name: string; conclusion: string; html_url: string }> } | null

  if (runs?.workflow_runs?.length) {
    for (const run of runs.workflow_runs.slice(0, 2)) {
      issues.push({
        type:        'failing_build',
        severity:    'high',
        title:       `Fix failing CI: ${run.name} in ${repoName}`,
        description: `Workflow "${run.name}" is failing in repo ${repoName}. Diagnose and fix the build error. Check the workflow logs and fix the root cause.`,
        taskType:    'coding',
      })
    }
  }

  // Scan top-level file tree for stubs and TODOs
  const tree = await ghFetch(
    `/repos/${GH_ORG}/${repoName}/git/trees/HEAD?recursive=0`
  ) as { tree?: Array<{ path: string; type: string }> } | null

  const tsFiles = (tree?.tree ?? [])
    .filter(f => f.type === 'blob' &&
      (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) &&
      !f.path.includes('node_modules') && !f.path.includes('.next'))
    .slice(0, 30)

  // Sample up to 8 files for TODO/stub detection
  let checked = 0
  for (const file of tsFiles) {
    if (checked >= 8 || issues.length >= 6) break
    const content = await ghFetch(
      `/repos/${GH_ORG}/${repoName}/contents/${file.path}`
    ) as { content?: string } | null
    if (!content?.content) continue
    const src = Buffer.from(content.content, 'base64').toString()
    checked++

    // Detect auto-stubs
    if (src.includes('auto-stub') && src.includes('export default {}')) {
      issues.push({
        type:        'stub_file',
        severity:    'medium',
        title:       `Implement stub: ${file.path} in ${repoName}`,
        description: `File ${file.path} in repo ${repoName} is an auto-stub (returns empty/null). Implement the actual functionality based on the file name and existing type definitions.`,
        file:        file.path,
        taskType:    'coding',
      })
    }

    // Detect TODO/FIXME/HACK
    const todos = src.match(/\/\/\s*(TODO|FIXME|HACK|XXX|UNIMPLEMENTED)[^\n]{5,80}/gi) ?? []
    if (todos.length > 2) {
      issues.push({
        type:        'todo',
        severity:    'low',
        title:       `Resolve ${todos.length} TODOs in ${file.path} (${repoName})`,
        description: `File ${file.path} in repo ${repoName} has ${todos.length} unresolved TODO/FIXME comments. Resolve each one: ${todos.slice(0, 3).join(' | ')}`,
        file:        file.path,
        taskType:    'coding',
      })
    }

    // Detect unimplemented route handlers
    if (src.includes('return NextResponse.json({ ok: true })') &&
        src.includes('export async function POST')) {
      issues.push({
        type:        'unimplemented_route',
        severity:    'medium',
        title:       `Implement API route: ${file.path} in ${repoName}`,
        description: `Route file ${file.path} in repo ${repoName} returns stub { ok: true } for POST requests. Implement the actual business logic based on the route path and surrounding code context.`,
        file:        file.path,
        taskType:    'coding',
      })
    }

    if (issues.length >= 6) break
  }

  // Check for missing test coverage (no __tests__ or .test. files)
  const hasTests = (tree?.tree ?? []).some(
    f => f.path.includes('__tests__') || f.path.includes('.test.') || f.path.includes('.spec.')
  )
  if (!hasTests && tsFiles.length > 5) {
    issues.push({
      type:        'missing_tests',
      severity:    'low',
      title:       `Add test coverage to ${repoName}`,
      description: `Repo ${repoName} has ${tsFiles.length} TypeScript files but no test files detected. Add unit tests for the core business logic functions.`,
      taskType:    'verification',
    })
  }

  return issues.slice(0, 4)  // max 4 issues per repo
}

// ── Main scan handler ─────────────────────────────────────────────────────────
export async function GET() {
  const start    = Date.now()
  const supabase = db()
  const report   = {
    repos_scanned:  0,
    tasks_generated: 0,
    tasks_skipped:  0,
    repos:          [] as string[],
    tasks:          [] as Array<{ id: string; title: string; repo: string; type: string }>,
    errors:         [] as string[],
  }

  // Fetch recently-active repos
  const repos = await ghFetch(
    `/orgs/${GH_ORG}/repos?per_page=${MAX_REPOS}&sort=pushed&direction=desc&type=all`
  ) as Array<{ name: string; pushed_at: string; archived: boolean }> | null

  if (!repos?.length) {
    return NextResponse.json({ error: 'GitHub API unavailable', duration_ms: Date.now() - start })
  }

  // Filter: active, non-archived repos pushed in last 7 days
  const cutoff     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const activeRepos = repos.filter(r => !r.archived && new Date(r.pushed_at) > cutoff)

  for (const repo of activeRepos) {
    if (report.tasks_generated >= MAX_TASKS) break

    try {
      const issues = await scanRepo(repo.name)
      report.repos_scanned++
      report.repos.push(repo.name)

      for (const issue of issues) {
        if (report.tasks_generated >= MAX_TASKS) break

        // Build task ID from hash — deterministic dedup
        const hash   = taskHash(repo.name, issue.title)
        const taskId = `scan-${repo.name.slice(0, 20)}-${hash}`

        // Skip if already exists (any status)
        const { data: existing } = await supabase
          .from('roadmap_tasks')
          .select('id, status')
          .eq('id', taskId)
          .single()

        if (existing) {
          report.tasks_skipped++
          continue
        }

        // Insert new pending task
        const { error: insertErr } = await supabase.from('roadmap_tasks').insert({
          id:          taskId,
          phase_id:    `scan_${issue.type}`,
          title:       issue.title,
          description: issue.description,
          status:      'pending',
          source:      'javari_scanner',
          metadata:    {
            repo:      repo.name,
            file:      issue.file ?? null,
            issue_type:issue.type,
            severity:  issue.severity,
            task_type: issue.taskType,
            scanned_at:new Date().toISOString(),
          },
          updated_at:  Date.now(),
        })

        if (insertErr) {
          report.errors.push(`${taskId}: ${insertErr.message}`)
        } else {
          report.tasks_generated++
          report.tasks.push({ id: taskId, title: issue.title, repo: repo.name, type: issue.type })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`${repo.name}: ${msg.slice(0, 100)}`)
    }
  }

  return NextResponse.json({
    status:          report.tasks_generated > 0 ? 'tasks_generated' : 'no_new_tasks',
    repos_scanned:   report.repos_scanned,
    tasks_generated: report.tasks_generated,
    tasks_skipped:   report.tasks_skipped,
    repos:           report.repos,
    tasks:           report.tasks,
    errors:          report.errors.slice(0, 5),
    duration_ms:     Date.now() - start,
    timestamp:       new Date().toISOString(),
  })
}
