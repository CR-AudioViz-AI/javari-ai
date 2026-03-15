// app/api/autonomy/scan/route.ts
// Javari Autonomous Scanner — respects SYSTEM_MODE and SCAN_ENABLED config
// When SYSTEM_MODE=BUILD, SCAN_ENABLED=false → returns immediately
// Saturday, March 14, 2026
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash }   from 'crypto'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 60

const GH_ORG    = 'CR-AudioViz-AI'
const MAX_TASKS = 10
const MAX_REPOS = 15

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getConfig(supabase: ReturnType<typeof db>): Promise<Record<string, string>> {
  const { data } = await supabase.from('javari_system_config').select('key,value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

async function ghFetch(path: string): Promise<unknown> {
  const token = process.env.GH_PAT ?? process.env.GITHUB_TOKEN
  const res   = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '', Accept: 'application/vnd.github+json' },
    next: { revalidate: 300 },
  } as RequestInit)
  if (!res.ok) return null
  return res.json()
}

function taskHash(repo: string, issue: string): string {
  return createHash('sha256').update(`${repo}:${issue}`).digest('hex').slice(0, 16)
}

interface DetectedIssue {
  type: 'failing_build' | 'stub_file' | 'todo' | 'missing_tests' | 'unimplemented_route'
  severity: 'low' | 'medium' | 'high'
  title: string; description: string; file?: string
  taskType: 'coding' | 'planning' | 'verification'
}

async function scanRepo(repoName: string): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = []
  const runs = await ghFetch(`/repos/${GH_ORG}/${repoName}/actions/runs?per_page=3&status=failure`) as
    { workflow_runs?: Array<{ name: string }> } | null
  if (runs?.workflow_runs?.length) {
    for (const run of runs.workflow_runs.slice(0, 2)) {
      issues.push({ type: 'failing_build', severity: 'high',
        title: `Fix failing CI: ${run.name} in ${repoName}`,
        description: `Workflow "${run.name}" is failing in repo ${repoName}. Diagnose and fix the build error.`,
        taskType: 'coding' })
    }
  }
  const tree = await ghFetch(`/repos/${GH_ORG}/${repoName}/git/trees/HEAD?recursive=0`) as
    { tree?: Array<{ path: string; type: string }> } | null
  const tsFiles = (tree?.tree ?? [])
    .filter(f => f.type === 'blob' && (f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
      && !f.path.includes('node_modules')).slice(0, 30)
  const hasTests = (tree?.tree ?? []).some(f =>
    f.path.includes('__tests__') || f.path.includes('.test.') || f.path.includes('.spec.'))
  let checked = 0
  for (const file of tsFiles) {
    if (checked >= 6 || issues.length >= 4) break
    const content = await ghFetch(`/repos/${GH_ORG}/${repoName}/contents/${file.path}`) as
      { content?: string } | null
    if (!content?.content) continue
    const src = Buffer.from(content.content, 'base64').toString()
    checked++
    if (src.includes('auto-stub') && src.includes('export default {}'))
      issues.push({ type: 'stub_file', severity: 'medium',
        title: `Implement stub: ${file.path} in ${repoName}`,
        description: `File ${file.path} in ${repoName} is an auto-stub. Implement the actual functionality.`,
        file: file.path, taskType: 'coding' })
  }
  if (!hasTests && tsFiles.length > 5)
    issues.push({ type: 'missing_tests', severity: 'low',
      title: `Add test coverage to ${repoName}`,
      description: `${repoName} has ${tsFiles.length} TS files but no tests. Add unit tests.`,
      taskType: 'verification' })
  return issues.slice(0, 4)
}

export async function GET() {
  const start    = Date.now()
  const supabase = db()
  const config   = await getConfig(supabase)
  const mode     = config['SYSTEM_MODE'] ?? 'SCAN'
  const scanEnabled = config['SCAN_ENABLED'] !== 'false'

  // Step 5: Pause scanner when SYSTEM_MODE=BUILD and SCAN_ENABLED=false
  if (!scanEnabled || mode === 'BUILD') {
    return NextResponse.json({
      status:  'paused',
      reason:  `SYSTEM_MODE=${mode}, SCAN_ENABLED=${config['SCAN_ENABLED'] ?? 'true'}`,
      message: 'Scanner paused in BUILD mode. Set SCAN_ENABLED=true to re-enable.',
      mode,
    })
  }

  const report = { repos_scanned: 0, tasks_generated: 0, tasks_skipped: 0,
                   repos: [] as string[], tasks: [] as unknown[], errors: [] as string[] }

  const repos = await ghFetch(
    `/orgs/${GH_ORG}/repos?per_page=${MAX_REPOS}&sort=pushed&direction=desc&type=all`
  ) as Array<{ name: string; pushed_at: string; archived: boolean }> | null
  if (!repos?.length) return NextResponse.json({ error: 'GitHub API unavailable' })

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const active = repos.filter(r => !r.archived && new Date(r.pushed_at) > cutoff)

  for (const repo of active) {
    if (report.tasks_generated >= MAX_TASKS) break
    try {
      const issues = await scanRepo(repo.name)
      report.repos_scanned++; report.repos.push(repo.name)
      for (const issue of issues) {
        if (report.tasks_generated >= MAX_TASKS) break
        const hash   = taskHash(repo.name, issue.title)
        const taskId = `scan-${repo.name.slice(0, 20)}-${hash}`
        const { data: existing } = await supabase.from('roadmap_tasks').select('id').eq('id', taskId).single()
        if (existing) { report.tasks_skipped++; continue }
        const { error } = await supabase.from('roadmap_tasks').insert({
          id: taskId, phase_id: `scan_${issue.type}`, title: issue.title,
          description: issue.description, status: 'pending', source: 'javari_scanner',
          metadata: { repo: repo.name, file: issue.file ?? null, issue_type: issue.type,
                      severity: issue.severity, task_type: issue.taskType,
                      scanned_at: new Date().toISOString() }, updated_at: Date.now(),
        })
        if (!error) { report.tasks_generated++; report.tasks.push({ id: taskId, title: issue.title }) }
      }
    } catch (err: unknown) {
      report.errors.push(`${repo.name}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 100))
    }
  }

  return NextResponse.json({ status: report.tasks_generated > 0 ? 'tasks_generated' : 'no_new_tasks',
    mode, ...report, duration_ms: Date.now() - start, timestamp: new Date().toISOString() })
}
