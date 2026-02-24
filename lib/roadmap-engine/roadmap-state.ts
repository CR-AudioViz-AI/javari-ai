// lib/roadmap-engine/roadmap-state.ts
// JAVARI ROADMAP STATE MANAGER — Supabase-backed persistence
// Replaces in-memory Map() with Supabase for cold-start survival
// 2026-02-19

import type { RoadmapState } from './roadmap-engine';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function supaHeaders() {
  return {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

// ── In-memory cache (L1) for hot reads ────────────────────────────────────────
const memCache = new Map<string, RoadmapState>();

export class RoadmapStateManager {

  /** Save roadmap state to Supabase (with in-memory write-through cache) */
  async saveAsync(state: RoadmapState): Promise<void> {
    memCache.set(state.id, { ...state });
    if (!SUPA_URL || !SUPA_KEY) return; // graceful no-op if DB not configured

    try {
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

      await fetch(`${SUPA_URL}/rest/v1/javari_roadmaps`, {
        method: 'POST',
        headers: { ...supaHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      });

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
          await fetch(`${SUPA_URL}/rest/v1/javari_tasks`, {
            method: 'POST',
            headers: { ...supaHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(batch),
          });
        }
      }
    } catch (err) {
      console.warn('[RoadmapState] Supabase save failed (using memory only):', err);
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

  /** Load from memory cache first, then Supabase */
  async loadAsync(roadmapId: string): Promise<RoadmapState | undefined> {
    const cached = memCache.get(roadmapId);
    if (cached) return cached;
    if (!SUPA_URL || !SUPA_KEY) return undefined;

    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.${encodeURIComponent(roadmapId)}&limit=1`,
        { headers: supaHeaders() }
      );
      if (!res.ok) return undefined;
      const rows = await res.json() as Record<string, unknown>[];
      if (!rows.length) return undefined;

      const r = rows[0];

      // Load tasks
      const tRes = await fetch(
        `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.${encodeURIComponent(roadmapId)}&order=task_order.asc&limit=200`,
        { headers: supaHeaders() }
      );
      const tasks = tRes.ok ? (await tRes.json() as Record<string, unknown>[]) : [];

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
    } catch (err) {
      console.warn('[RoadmapState] Supabase load failed:', err);
      return undefined;
    }
  }

  /** Synchronous load (memory only — use loadAsync for full persistence) */
  load(roadmapId: string): RoadmapState | undefined {
    return memCache.get(roadmapId);
  }

  /** List all roadmaps from Supabase */
  async listAsync(): Promise<RoadmapState[]> {
    if (!SUPA_URL || !SUPA_KEY) return this.list();
    try {
      const res = await fetch(
        `${SUPA_URL}/rest/v1/javari_roadmaps?order=created_at.desc&limit=50`,
        { headers: supaHeaders() }
      );
      if (!res.ok) return this.list();
      const rows = await res.json() as Record<string, unknown>[];
      return rows.map((r) => ({
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
    } catch {
      return this.list();
    }
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
    memCache.delete(roadmapId);
    if (!SUPA_URL || !SUPA_KEY) return true;
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.${encodeURIComponent(roadmapId)}`,
        { method: 'DELETE', headers: supaHeaders() }
      );
      await fetch(
        `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.${encodeURIComponent(roadmapId)}`,
        { method: 'DELETE', headers: supaHeaders() }
      );
      return true;
    } catch {
      return false;
    }
  }

  delete(roadmapId: string): boolean {
    this.deleteAsync(roadmapId).catch(() => {});
    return memCache.delete(roadmapId);
  }
}

// Global singleton
export const stateManager = new RoadmapStateManager();
