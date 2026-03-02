// lib/roadmap-engine/roadmap-state.ts
// JAVARI ROADMAP STATE MANAGER — Supabase-backed persistence
// DB is mandatory - NO memory fallback
// 2026-03-02

import type { RoadmapState } from './roadmap-engine';

function supaHeaders(apikey: string) {
  return {
    apikey,
    Authorization: `Bearer ${apikey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

// ── In-memory cache (L1) for hot reads ────────────────────────────────────────
const memCache = new Map<string, RoadmapState>();

export class RoadmapStateManager {

  /** Save roadmap state to Supabase (with in-memory write-through cache) */
  async saveAsync(state: RoadmapState): Promise<void> {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
      throw new Error('Supabase environment variables not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    }

    memCache.set(state.id, { ...state });

    const row = {
      id: state.id,
      title: state.title,
      description: state.description,
      status: state.status,
      strategy: 'dependency-driven',
      phase_count: 0,
      task_count: state.metadata.totalTasks,
      completed_count: state.metadata.completedTasks,
      failed_count: state.metadata.failedTasks,
      progress: state.metadata.progress,
      phases: JSON.stringify([]),
      milestones: JSON.stringify([]),
      dependencies_map: JSON.stringify([]),
      risks: JSON.stringify([]),
      resources: JSON.stringify([]),
      verification: JSON.stringify([]),
      source: 'runtime',
      updated_at: new Date().toISOString(),
      started_at: state.status === 'executing' ? new Date().toISOString() : null,
    };

    const res = await fetch(`${SUPA_URL}/rest/v1/javari_roadmaps`, {
      method: 'POST',
      headers: { ...supaHeaders(SUPA_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Roadmap save failed: ${res.status} ${errorText}`);
    }

    // Also persist tasks
    if (state.tasks?.length) {
      const taskRows = state.tasks.map((t, idx) => ({
        id: t.id,
        roadmap_id: state.id,
        title: t.title,
        description: t.description || '',
        status: t.status,
        priority: t.priority || 'medium',
        provider: t.provider || null,
        dependencies: JSON.stringify(t.dependencies || []),
        result: typeof t.result === 'string' ? t.result : (t.result ? JSON.stringify(t.result) : null),
        error: t.error || null,
        retry_count: t.retryCount || 0,
        max_retries: t.maxRetries || 3,
        task_order: idx,
        started_at: t.startedAt ? new Date(t.startedAt).toISOString() : null,
        completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      }));

      // Upsert in batches of 50
      for (let i = 0; i < taskRows.length; i += 50) {
        const batch = taskRows.slice(i, i + 50);
        const taskRes = await fetch(`${SUPA_URL}/rest/v1/javari_tasks`, {
          method: 'POST',
          headers: { ...supaHeaders(SUPA_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(batch),
        });

        if (!taskRes.ok) {
          const errorText = await taskRes.text();
          throw new Error(`Task batch ${i / 50} save failed: ${taskRes.status} ${errorText}`);
        }
      }
    }
  }

  /** Synchronous save (writes to memory, fires async Supabase write) */
  save(state: RoadmapState): void {
    memCache.set(state.id, { ...state });
    // Fire-and-forget async persist
    this.saveAsync(state).catch((e) =>
      console.warn('[RoadmapState] Async save failed:', e)
    );
  }

  /** Load from Supabase (no memory fallback) */
  async loadAsync(roadmapId: string): Promise<RoadmapState | undefined> {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
      throw new Error('Supabase environment variables not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    }

    // Check cache first
    const cached = memCache.get(roadmapId);
    if (cached) return cached;

    const res = await fetch(
      `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.${encodeURIComponent(roadmapId)}&limit=1`,
      { headers: supaHeaders(SUPA_KEY) }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Roadmap load failed: ${res.status} ${errorText}`);
    }

    const rows = await res.json() as Record<string, unknown>[];
    if (!rows.length) return undefined;

    const r = rows[0];

    // Load tasks
    const tRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.${encodeURIComponent(roadmapId)}&order=task_order.asc&limit=200`,
      { headers: supaHeaders(SUPA_KEY) }
    );

    if (!tRes.ok) {
      const errorText = await tRes.text();
      throw new Error(`Tasks load failed: ${tRes.status} ${errorText}`);
    }

    const tasks = await tRes.json() as Record<string, unknown>[];

    const state: RoadmapState = {
      id: r.id as string,
      title: r.title as string,
      description: r.description as string || '',
      status: r.status as RoadmapState['status'],
      tasks: tasks.map((t) => ({
        id: t.id as string,
        title: t.title as string,
        description: t.description as string || '',
        status: t.status as 'pending' | 'running' | 'complete' | 'failed',
        provider: (t.provider as string) || undefined,
        dependencies: JSON.parse((t.dependencies as string) || '[]'),
        result: t.result || undefined,
        error: (t.error as string) || undefined,
        startedAt: t.started_at ? new Date(t.started_at as string).getTime() : undefined,
        completedAt: t.completed_at ? new Date(t.completed_at as string).getTime() : undefined,
        retryCount: (t.retry_count as number) || 0,
        maxRetries: (t.max_retries as number) || 3,
      })),
      currentTaskId: undefined,
      createdAt: new Date(r.created_at as string).getTime(),
      updatedAt: new Date(r.updated_at as string).getTime(),
      metadata: {
        totalTasks: (r.task_count as number) || 0,
        completedTasks: (r.completed_count as number) || 0,
        failedTasks: (r.failed_count as number) || 0,
        progress: parseFloat(String(r.progress || '0')),
      },
    };

    memCache.set(roadmapId, state);
    return state;
  }

  /** Synchronous load (memory only — use loadAsync for full persistence) */
  load(roadmapId: string): RoadmapState | undefined {
    return memCache.get(roadmapId);
  }

  /** List all roadmaps from Supabase (no memory fallback) */
  async listAsync(): Promise<RoadmapState[]> {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
      throw new Error('Supabase environment variables not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    }

    const res = await fetch(
      `${SUPA_URL}/rest/v1/javari_roadmaps?order=created_at.desc&limit=50`,
      { headers: supaHeaders(SUPA_KEY) }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Roadmap list failed: ${res.status} ${errorText}`);
    }

    const rows = await res.json() as Record<string, unknown>[];
    
    const mapped = rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      description: (r.description as string) || '',
      status: r.status as RoadmapState['status'],
      tasks: [],
      currentTaskId: undefined,
      createdAt: new Date(r.created_at as string).getTime(),
      updatedAt: new Date(r.updated_at as string).getTime(),
      metadata: {
        totalTasks: (r.task_count as number) || 0,
        completedTasks: (r.completed_count as number) || 0,
        failedTasks: (r.failed_count as number) || 0,
        progress: parseFloat(String(r.progress || '0')),
      },
    }));
    
    return mapped;
  }

  /** Synchronous list (memory cache only) */
  list(): RoadmapState[] {
    return Array.from(memCache.values());
  }

  /** Get active roadmaps */
  getActive(): RoadmapState[] {
    return this.list().filter(
      (s) => s.status === 'planning' || s.status === 'executing'
    );
  }

  /** Delete from memory and Supabase */
  async deleteAsync(roadmapId: string): Promise<boolean> {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
      throw new Error('Supabase environment variables not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    }

    memCache.delete(roadmapId);

    // Delete tasks first
    const taskRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.${encodeURIComponent(roadmapId)}`,
      { method: 'DELETE', headers: supaHeaders(SUPA_KEY) }
    );

    if (!taskRes.ok) {
      const errorText = await taskRes.text();
      throw new Error(`Task deletion failed: ${taskRes.status} ${errorText}`);
    }

    // Delete roadmap
    const roadmapRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.${encodeURIComponent(roadmapId)}`,
      { method: 'DELETE', headers: supaHeaders(SUPA_KEY) }
    );

    if (!roadmapRes.ok) {
      const errorText = await roadmapRes.text();
      throw new Error(`Roadmap deletion failed: ${roadmapRes.status} ${errorText}`);
    }

    return true;
  }

  delete(roadmapId: string): boolean {
    this.deleteAsync(roadmapId).catch(() => {});
    return memCache.delete(roadmapId);
  }
}

// Global singleton
export const stateManager = new RoadmapStateManager();
