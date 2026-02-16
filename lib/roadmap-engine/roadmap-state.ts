// lib/roadmap-engine/roadmap-state.ts
/**
 * ROADMAP STATE MANAGER
 * 
 * Persistent state management for roadmap execution
 * Supports pause/resume and state persistence
 */

import type { RoadmapState } from './roadmap-engine';

export class RoadmapStateManager {
  private states: Map<string, RoadmapState> = new Map();

  /**
   * Save roadmap state
   */
  save(state: RoadmapState): void {
    this.states.set(state.id, { ...state });
  }

  /**
   * Load roadmap state
   */
  load(roadmapId: string): RoadmapState | undefined {
    return this.states.get(roadmapId);
  }

  /**
   * List all roadmaps
   */
  list(): RoadmapState[] {
    return Array.from(this.states.values());
  }

  /**
   * Delete roadmap state
   */
  delete(roadmapId: string): boolean {
    return this.states.delete(roadmapId);
  }

  /**
   * Get active roadmaps
   */
  getActive(): RoadmapState[] {
    return this.list().filter(s => 
      s.status === 'planning' || s.status === 'executing'
    );
  }
}

// Global state manager instance
export const stateManager = new RoadmapStateManager();
