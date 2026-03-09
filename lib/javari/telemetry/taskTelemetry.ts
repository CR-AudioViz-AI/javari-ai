// lib/javari/telemetry/taskTelemetry.ts
// Purpose: Telemetry Engine — records structured metrics for every autonomy task execution.
// Date: 2026-03-09

export interface TaskTelemetry {
  taskId: string
  title: string
  phase: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  modelUsed?: string
  tokensPrompt?: number
  tokensCompletion?: number
  costUsd?: number
  status: "started" | "completed" | "failed"
  error?: string
}

export const telemetryStore: TaskTelemetry[] = []

export function startTelemetry(taskId: string, title: string, phase: string): TaskTelemetry {
  const record: TaskTelemetry = {
    taskId,
    title,
    phase,
    startedAt: Date.now(),
    status: "started"
  }
  telemetryStore.push(record)
  return record
}

export function completeTelemetry(taskId: string, metrics?: Partial<TaskTelemetry>) {
  const record = telemetryStore.find(t => t.taskId === taskId)
  if (!record) return
  record.completedAt = Date.now()
  record.durationMs = record.completedAt - record.startedAt
  record.status = "completed"
  Object.assign(record, metrics)
}

export function failTelemetry(taskId: string, error: string) {
  const record = telemetryStore.find(t => t.taskId === taskId)
  if (!record) return
  record.completedAt = Date.now()
  record.durationMs = record.completedAt - record.startedAt
  record.status = "failed"
  record.error = error
}
