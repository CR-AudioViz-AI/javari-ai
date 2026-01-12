// lib/javari-roadmap-engine.ts
// Roadmap Engine v1 with Supabase persistence

import { createClient } from '@supabase/supabase-js';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'blocked' | 'completed';
  owner?: string;
  dependencies?: string[];
  evidence_links?: string[];
  created_at: string;
  updated_at: string;
}

export class RoadmapEngine {
  private supabase: any;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.FEATURE_ROADMAP_WRITE === '1';
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * List all roadmap items
   */
  async listRoadmap(filters?: {
    status?: RoadmapItem['status'];
    priority?: RoadmapItem['priority'];
    owner?: string;
  }): Promise<RoadmapItem[]> {
    if (!this.enabled || !this.supabase) {
      return [];
    }

    try {
      let query = this.supabase
        .from('javari_roadmap')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.owner) {
        query = query.eq('owner', filters.owner);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Roadmap] List error:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('[Roadmap] List exception:', error);
      return [];
    }
  }

  /**
   * Add new roadmap item
   */
  async addItem(item: Omit<RoadmapItem, 'id' | 'created_at' | 'updated_at'>): Promise<RoadmapItem | null> {
    if (!this.enabled || !this.supabase) {
      console.warn('[Roadmap] Write disabled - item not added:', item.title);
      return null;
    }

    try {
      const newItem = {
        ...item,
        id: `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('javari_roadmap')
        .insert([newItem])
        .select()
        .single();

      if (error) {
        console.error('[Roadmap] Add error:', error);
        return null;
      }

      return data;

    } catch (error) {
      console.error('[Roadmap] Add exception:', error);
      return null;
    }
  }

  /**
   * Update roadmap item status
   */
  async updateItemStatus(
    id: string,
    status: RoadmapItem['status'],
    evidence?: string
  ): Promise<boolean> {
    if (!this.enabled || !this.supabase) {
      console.warn('[Roadmap] Write disabled - status not updated');
      return false;
    }

    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (evidence) {
        // Append evidence link
        const { data: existing } = await this.supabase
          .from('javari_roadmap')
          .select('evidence_links')
          .eq('id', id)
          .single();

        if (existing) {
          const links = existing.evidence_links || [];
          updates.evidence_links = [...links, evidence];
        }
      }

      const { error } = await this.supabase
        .from('javari_roadmap')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('[Roadmap] Update error:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('[Roadmap] Update exception:', error);
      return false;
    }
  }

  /**
   * Get next action based on priorities and dependencies
   */
  async getNextAction(): Promise<{ action: string; item: RoadmapItem } | null> {
    const items = await this.listRoadmap({
      status: 'planned',
    });

    if (items.length === 0) {
      return null;
    }

    // Priority order: critical > high > medium > low
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    // Filter out blocked items and items with unmet dependencies
    const actionable = items.filter(item => {
      if (item.status === 'blocked') return false;
      
      // Check dependencies
      if (item.dependencies && item.dependencies.length > 0) {
        // For now, skip items with dependencies
        // In production, check if dependencies are completed
        return false;
      }

      return true;
    });

    if (actionable.length === 0) {
      return null;
    }

    // Sort by priority
    actionable.sort((a, b) => {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const nextItem = actionable[0];

    return {
      action: `NEXT ACTION STARTED: ${nextItem.title}`,
      item: nextItem,
    };
  }

  /**
   * Mark item as in progress
   */
  async startItem(id: string): Promise<boolean> {
    return await this.updateItemStatus(id, 'in_progress');
  }

  /**
   * Mark item as completed
   */
  async completeItem(id: string, evidence?: string): Promise<boolean> {
    return await this.updateItemStatus(id, 'completed', evidence);
  }

  /**
   * Mark item as blocked
   */
  async blockItem(id: string, reason?: string): Promise<boolean> {
    return await this.updateItemStatus(id, 'blocked', reason);
  }
}

// Export singleton
export const roadmapEngine = new RoadmapEngine();
