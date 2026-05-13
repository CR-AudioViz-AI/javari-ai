// lib/ai/router.ts
// Updated May 12, 2026 — all calls route through dispatchAI (single OpenAI call path)
import { dispatchAI } from '@/lib/javari/dispatcher/ai-dispatcher'

type TaskType = 'simple' | 'reasoning' | 'validation'

function modelForTask(taskType: TaskType): string {
  switch (taskType) {
    case 'reasoning':   return 'gpt-4o-mini'   // gpt-4o retired from direct use
    case 'validation':  return 'gpt-4o-mini'
    default:            return 'gpt-4o-mini'
  }
}

// runAI — now routes through dispatchAI. Single OpenAI call path.
export async function runAI(taskType: TaskType, prompt: string) {
  const model = modelForTask(taskType)
  const result = await dispatchAI({
    role:      'architect',    // closest semantic match for generic AI calls
    objective: prompt,
    inputs:    [],
    max_cost:  0.01,
  })
  const parsed = (() => { try { return JSON.parse(result.output) } catch { return null } })()
  return {
    model,
    output: parsed?.artifact ?? parsed?.result ?? parsed?.output ?? result.output,
  }
}
