// lib/javari/session-bootstrap.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari Session Bootstrap
// Fetches MASTER_STATUS.md + MASTER_CONTEXT.md from master-docs repo at the
// start of every automated session. Gives Claude/Javari full context
// without the user needing to explain anything.
// Created: May 14, 2026
// ─────────────────────────────────────────────────────────────────────────────

const MASTER_DOCS_REPO = 'CR-AudioViz-AI/master-docs'
const GITHUB_TOKEN     = process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? ''

export interface SessionContext {
  masterStatus:     string
  masterContext:    string
  masterOperations: string
  loadedAt:         string
  error?:           string
}

async function fetchDoc(filename: string): Promise<string> {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set')
  const res = await fetch(
    `https://api.github.com/repos/${MASTER_DOCS_REPO}/contents/${filename}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  )
  if (!res.ok) throw new Error(`Failed to fetch ${filename}: HTTP ${res.status}`)
  const d = await res.json() as { content: string; encoding: string }
  if (d.encoding === 'base64') return Buffer.from(d.content, 'base64').toString('utf8')
  return d.content
}

export async function loadSessionContext(): Promise<SessionContext> {
  const results = await Promise.allSettled([
    fetchDoc('MASTER_STATUS.md'),
    fetchDoc('MASTER_CONTEXT.md'),
    fetchDoc('MASTER_OPERATIONS.md'),
  ])

  return {
    masterStatus:     results[0].status === 'fulfilled' ? results[0].value : 'UNAVAILABLE',
    masterContext:    results[1].status === 'fulfilled' ? results[1].value : 'UNAVAILABLE',
    masterOperations: results[2].status === 'fulfilled' ? results[2].value : 'UNAVAILABLE',
    loadedAt:         new Date().toISOString(),
    error:            results.some(r => r.status === 'rejected')
      ? results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason?.message).join('; ')
      : undefined,
  }
}

export async function updateMasterStatus(summary: string, prs: string[] = []): Promise<void> {
  if (!GITHUB_TOKEN) { console.warn('[bootstrap] GITHUB_TOKEN not set — cannot update MASTER_STATUS'); return }

  try {
    // Get current SHA
    const res = await fetch(
      `https://api.github.com/repos/${MASTER_DOCS_REPO}/contents/MASTER_STATUS.md`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    )
    const current = await res.json() as { sha: string; content: string }
    const currentContent = Buffer.from(current.content, 'base64').toString('utf8')

    // Prepend session summary
    const timestamp  = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    const sessionEntry = [
      `\n## Session: ${timestamp}`,
      summary,
      ...(prs.length ? [`\nPRs: ${prs.join(', ')}`] : []),
      '\n---',
    ].join('\n')

    const newContent = currentContent.replace('---', `---${sessionEntry}`)

    await fetch(
      `https://api.github.com/repos/${MASTER_DOCS_REPO}/contents/MASTER_STATUS.md`,
      {
        method: 'PUT',
        headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify({
          message:  `chore: session update ${timestamp}`,
          content:  Buffer.from(newContent).toString('base64'),
          sha:      current.sha,
          branch:   'main',
        }),
      }
    )
    console.log('[bootstrap] MASTER_STATUS.md updated')
  } catch (err) {
    console.error('[bootstrap] Failed to update MASTER_STATUS:', err instanceof Error ? err.message : err)
  }
}
