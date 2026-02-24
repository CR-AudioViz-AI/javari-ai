// lib/javari-roadmap-enhanced.ts
// Roadmap engine with competitor-driven priorities

import { javariLearningEnhanced } from './javari-learning-enhanced';

export interface RoadmapItem {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'blocked' | 'completed';
  category: 'revenue' | 'infrastructure' | 'ux' | 'learning' | 'competitive';
  next_action?: string;
  blocked_reason?: string;
  source: 'user' | 'competitor' | 'internal';
  created_at: string;
}

export class RoadmapEngineEnhanced {
  private items: RoadmapItem[] = [];
  
  constructor() {
    // Initialize with base roadmap
    this.initializeRoadmap();
  }
  
  private initializeRoadmap() {
    this.items = [
      {
        id: 'rev-1',
        title: 'Invoice Generator - Payment Integration',
        priority: 'critical',
        status: 'planned',
        category: 'revenue',
        next_action: 'Stripe integration',
        source: 'user',
        created_at: new Date().toISOString(),
      },
      {
        id: 'comp-1',
        title: 'Live Preview (like bolt.new)',
        priority: 'high',
        status: 'planned',
        category: 'competitive',
        next_action: 'Research iframe sandboxing',
        source: 'competitor',
        created_at: new Date().toISOString(),
      },
    ];
  }
  
  // Add opportunity from competitor intel
  addOpportunity(opportunity: string, competitor: string) {
    const item: RoadmapItem = {
      id: `comp_${Date.now()}`,
      title: opportunity,
      priority: 'medium',
      status: 'planned',
      category: 'competitive',
      next_action: `Evaluate ${opportunity} from ${competitor}`,
      source: 'competitor',
      created_at: new Date().toISOString(),
    };
    
    this.items.push(item);
  }
  
  // Get next best action using learning insights
  getNextBestAction(): RoadmapItem | null {
    // Prioritize based on:
    // 1. Critical items
    // 2. Items with high success rate (from learning)
    // 3. Competitive gaps
    
    const critical = this.items.find(i =>
      i.priority === 'critical' && i.status === 'planned'
    );
    
    if (critical) return critical;
    
    // Check learning insights for high-success items
    const highSuccess = this.items
      .filter(i => i.status === 'planned')
      .sort((a, b) => {
        // Stub - in production, query learning system
        return 0;
      })[0];
    
    return highSuccess || null;
  }
  
  // Generate proactive suggestion
  suggestNextAction(): string {
    const next = this.getNextBestAction();
    
    if (!next) {
      return 'Roadmap clear! All priorities addressed. What should we build next?';
    }
    
    return `Next recommended: ${next.title} (${next.category}). Action: ${next.next_action}. Ready to start?`;
  }
  
  // Update from user feedback
  updateStatus(id: string, status: RoadmapItem['status']) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.status = status;
    }
  }
  
  // Get roadmap summary
  getSummary() {
    const critical = this.items.filter(i => i.priority === 'critical' && i.status !== 'completed');
    const high = this.items.filter(i => i.priority === 'high' && i.status !== 'completed');
    const competitive = this.items.filter(i => i.category === 'competitive');
    
    return {
      total_items: this.items.length,
      critical_count: critical.length,
      high_count: high.length,
      competitive_gaps: competitive.length,
      next_action: this.suggestNextAction(),
    };
  }
}

export const roadmapEngine = new RoadmapEngineEnhanced();
