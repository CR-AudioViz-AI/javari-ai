// app/api/javari/roadmap/activate/route.ts
// JAVARI ROADMAP ENGINE — ACTIVATION ENDPOINT
// POST /api/javari/roadmap/activate
// Activates the canonical Master Roadmap V2.0 and returns full OS execution plan
// 2026-02-19

import { NextRequest, NextResponse } from 'next/server';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';
import type {
  Task,
  Phase,
  Milestone,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ExecutionScheduleItem,
  RoadmapActivationResponse,
  TaskStatus,
} from '@/lib/javari/roadmap/canonical-types';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDependencyGraph(tasks: Task[]): DependencyGraph {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const nodes: DependencyNode[] = tasks.map((t) => ({
    id: t.id,
    label: t.title,
    status: t.status,
    priority: t.priority,
    phaseId: t.phaseId,
  }));

  const edges: DependencyEdge[] = JAVARI_CANONICAL_ROADMAP.dependencies.map((d) => ({
    from: d.from,
    to: d.to,
    type: d.type,
  }));

  // Critical path = longest dependency chain starting from critical tasks
  const visited = new Set<string>();
  const criticalPath: string[] = [];

  function dfs(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    criticalPath.push(taskId);
    const enabledBy = edges.filter((e) => e.from === taskId).map((e) => e.to);
    for (const next of enabledBy) {
      const nextTask = taskMap.get(next);
      if (nextTask && nextTask.priority === 'critical') dfs(next);
    }
  }

  // Start from critical tasks with no dependencies
  tasks
    .filter((t) => t.priority === 'critical' && t.dependencies.length === 0)
    .forEach((t) => dfs(t.id));

  return { nodes, edges, criticalPath };
}

function buildExecutionSchedule(tasks: Task[], phases: Phase[]): ExecutionScheduleItem[] {
  const phaseMap = new Map(phases.map((p) => [p.id, p]));
  const completedIds = new Set(tasks.filter((t) => t.status === 'complete').map((t) => t.id));

  return tasks
    .filter((t) => t.status !== 'complete')
    .map((t) => {
      const blockedBy = t.dependencies.filter((dep) => !completedIds.has(dep));
      const phase = phaseMap.get(t.phaseId);
      return {
        taskId: t.id,
        taskTitle: t.title,
        phaseId: t.phaseId,
        phaseName: phase?.name || t.phaseId,
        priority: t.priority,
        status: t.status,
        provider: t.provider,
        estimatedHours: t.estimatedHours,
        canStartNow: blockedBy.length === 0 && t.status === 'pending',
        blockedBy,
      } as ExecutionScheduleItem;
    })
    .sort((a, b) => {
      // Sort: critical first, then by can-start, then by phase order
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (pOrder[a.priority] !== pOrder[b.priority])
        return pOrder[a.priority] - pOrder[b.priority];
      if (a.canStartNow !== b.canStartNow) return a.canStartNow ? -1 : 1;
      return 0;
    });
}

function getPhaseProgress(phaseId: string, tasks: Task[]) {
  const phaseTasks = tasks.filter((t) => t.phaseId === phaseId);
  if (!phaseTasks.length) return 0;
  const done = phaseTasks.filter((t) => t.status === 'complete').length;
  return Math.round((done / phaseTasks.length) * 100);
}

function generateSummary(tasks: Task[], phases: Phase[]): string {
  const total = tasks.length;
  const complete = tasks.filter((t) => t.status === 'complete').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const canStart = tasks.filter(
    (t) =>
      t.status === 'pending' &&
      t.dependencies.every((d) =>
        tasks.find((tt) => tt.id === d && tt.status === 'complete')
      )
  ).length;

  const currentPhase = phases.find((p) => p.status === 'active') || phases[0];
  const overallProgress = Math.round((complete / total) * 100);

  return (
    `Javari OS Roadmap activated. ${total} tasks across ${phases.length} phases. ` +
    `Overall progress: ${overallProgress}% (${complete}/${total} complete). ` +
    `Current phase: ${currentPhase.name}. ` +
    `${inProgress} tasks in progress, ${canStart} ready to start now, ${blocked} blocked. ` +
    `Critical path includes ${phases[0].taskIds.filter((id) =>
      tasks.find((t) => t.id === id && t.priority === 'critical')
    ).length} critical Phase-0 tasks. ` +
    `Target: ${JAVARI_CANONICAL_ROADMAP.milestones[JAVARI_CANONICAL_ROADMAP.milestones.length - 1].name}.`
  );
}

// ── GET — return current roadmap state ────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const roadmap = JAVARI_CANONICAL_ROADMAP;
    const tasks = roadmap.tasks;
    const phases = roadmap.phases;
    const schedule = buildExecutionSchedule(tasks, phases);
    const depGraph = buildDependencyGraph(tasks);

    const response: RoadmapActivationResponse = {
      success: true,
      roadmapId: roadmap.id,
      status: 'idle',
      phases: phases.map((p) => p.status),
      currentPhase: phases.find((p) => p.status === 'active') || phases[0],
      activeTasks: tasks.filter((t) => t.status === 'in-progress'),
      blockedTasks: tasks.filter((t) => t.status === 'blocked'),
      pendingTasks: tasks.filter((t) => t.status === 'pending'),
      completedTasks: tasks.filter((t) => t.status === 'complete'),
      milestones: roadmap.milestones,
      dependencyGraph: depGraph,
      executionSchedule: schedule,
      verificationRequirements: roadmap.verification,
      risks: roadmap.risks,
      resources: roadmap.resources,
      summary: generateSummary(tasks, phases),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST — activate roadmap execution ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'activate', taskId, override } = body as {
      action?: 'activate' | 'update-task' | 'reset' | 'status';
      taskId?: string;
      override?: Partial<Task>;
    };

    const roadmap = JAVARI_CANONICAL_ROADMAP;

    if (action === 'reset') {
      // Reset all non-blocked tasks to pending
      roadmap.tasks.forEach((t) => {
        if (t.status !== 'blocked') t.status = 'pending';
      });
      return NextResponse.json({ success: true, message: 'Roadmap reset to pending.' });
    }

    if (action === 'update-task' && taskId) {
      const task = roadmap.tasks.find((t) => t.id === taskId);
      if (!task) {
        return NextResponse.json({ error: `Task ${taskId} not found` }, { status: 404 });
      }
      if (override) Object.assign(task, override);

      // Persist to Supabase
      const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (SUPA_URL && SUPA_KEY) {
        await fetch(`${SUPA_URL}/rest/v1/javari_tasks?id=eq.${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPA_KEY,
            Authorization: `Bearer ${SUPA_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            status: task.status,
            result: task.result || null,
            error: task.error || null,
            updated_at: new Date().toISOString(),
            completed_at: task.status === 'complete' ? new Date().toISOString() : null,
          }),
        });
      }

      return NextResponse.json({ success: true, task });
    }

    // ── ACTIVATE ──────────────────────────────────────────────────────────
    // Persist the canonical roadmap to Supabase on activation
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    let persisted = false;
    if (SUPA_URL && SUPA_KEY) {
      try {
        const headers = {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        };

        // Upsert roadmap record
        await fetch(`${SUPA_URL}/rest/v1/javari_roadmaps`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: roadmap.id,
            title: roadmap.title,
            description: roadmap.objective,
            objective: roadmap.objective,
            status: 'executing',
            strategy: 'dependency-driven',
            phase_count: roadmap.phases.length,
            task_count: roadmap.tasks.length,
            completed_count: roadmap.tasks.filter((t) => t.status === 'complete').length,
            failed_count: roadmap.tasks.filter((t) => t.status === 'failed').length,
            progress: Math.round(
              (roadmap.tasks.filter((t) => t.status === 'complete').length /
                roadmap.tasks.length) *
                100
            ),
            phases: JSON.stringify(roadmap.phases),
            milestones: JSON.stringify(roadmap.milestones),
            dependencies_map: JSON.stringify(roadmap.dependencies),
            risks: JSON.stringify(roadmap.risks),
            resources: JSON.stringify(roadmap.resources),
            verification: JSON.stringify(roadmap.verification),
            source: 'canonical',
            activated_by: 'javari-system',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });

        // Upsert all tasks in batches
        const taskRows = roadmap.tasks.map((t, idx) => ({
          id: t.id,
          roadmap_id: roadmap.id,
          title: t.title,
          description: t.description,
          phase_id: t.phaseId,
          task_order: idx,
          status: t.status,
          priority: t.priority,
          provider: t.provider,
          dependencies: JSON.stringify(t.dependencies),
          estimated_hours: t.estimatedHours,
          verification_criteria: JSON.stringify(t.verificationCriteria),
          tags: JSON.stringify(t.tags),
          updated_at: new Date().toISOString(),
        }));

        for (let i = 0; i < taskRows.length; i += 50) {
          const batch = taskRows.slice(i, i + 50);
          await fetch(`${SUPA_URL}/rest/v1/javari_tasks`, {
            method: 'POST',
            headers,
            body: JSON.stringify(batch),
          });
        }

        persisted = true;
      } catch (e) {
        console.warn('[RoadmapActivate] Supabase persist failed:', e);
      }
    }

    // Build response
    const tasks = roadmap.tasks;
    const phases = roadmap.phases;
    const schedule = buildExecutionSchedule(tasks, phases);
    const depGraph = buildDependencyGraph(tasks);

    const response: RoadmapActivationResponse = {
      success: true,
      roadmapId: roadmap.id,
      status: 'executing',
      phases: phases.map((p) => p.status),
      currentPhase: phases.find((p) => p.status === 'active') || phases[0],
      activeTasks: tasks.filter((t) => t.status === 'in-progress'),
      blockedTasks: tasks.filter((t) => t.status === 'blocked'),
      pendingTasks: tasks.filter((t) => t.status === 'pending'),
      completedTasks: tasks.filter((t) => t.status === 'complete'),
      milestones: roadmap.milestones,
      dependencyGraph: depGraph,
      executionSchedule: schedule,
      verificationRequirements: roadmap.verification,
      risks: roadmap.risks,
      resources: roadmap.resources,
      summary: generateSummary(tasks, phases),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      ...response,
      persisted,
      meta: {
        version: roadmap.version,
        source: roadmap.source,
        totalPhases: phases.length,
        totalTasks: tasks.length,
        totalMilestones: roadmap.milestones.length,
        criticalPathLength: depGraph.criticalPath.length,
        tasksReadyNow: schedule.filter((s) => s.canStartNow).length,
        estimatedTotalHours: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
      },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[RoadmapActivate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
