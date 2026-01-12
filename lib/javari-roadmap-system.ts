// lib/javari-roadmap-system.ts
// Roadmap tracking and execution system

export interface RoadmapItem {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'blocked' | 'completed';
  category: 'revenue' | 'infrastructure' | 'ux' | 'learning' | 'orchestration';
  next_action?: string;
  blocked_reason?: string;
}

export class JavariRoadmap {
  private items: RoadmapItem[] = [
    {
      id: 'rev-1',
      title: 'Invoice Generator Pro - Payment Integration',
      priority: 'critical',
      status: 'planned',
      category: 'revenue',
      next_action: 'Integrate Stripe payment flow',
    },
    {
      id: 'rev-2',
      title: 'Social Graphics Creator - Template Expansion',
      priority: 'high',
      status: 'planned',
      category: 'revenue',
      next_action: 'Add 20 new templates with AI generation',
    },
    {
      id: 'rev-3',
      title: 'PDF Builder Pro - Form Fill Automation',
      priority: 'high',
      status: 'planned',
      category: 'revenue',
      next_action: 'AI-powered form field detection',
    },
    {
      id: 'infra-1',
      title: 'Autonomous Learning System Maturity',
      priority: 'high',
      status: 'in_progress',
      category: 'learning',
      next_action: 'Implement pattern recognition',
    },
    {
      id: 'orch-1',
      title: 'Multi-Model Coordination Improvements',
      priority: 'medium',
      status: 'in_progress',
      category: 'orchestration',
      next_action: 'Add Claude/Perplexity routing logic',
    },
    {
      id: 'ux-1',
      title: 'User Experience Polish',
      priority: 'medium',
      status: 'planned',
      category: 'ux',
      next_action: 'Improve onboarding flow',
    },
  ];

  // Get current priorities
  getCurrentPriorities(): RoadmapItem[] {
    return this.items
      .filter(item => item.status !== 'completed')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 5);
  }

  // Get next recommended action
  getNextRecommendedAction(): RoadmapItem | null {
    const active = this.items.find(item => item.status === 'in_progress');
    if (active) return active;

    const critical = this.items.find(item => 
      item.priority === 'critical' && item.status === 'planned'
    );
    if (critical) return critical;

    const high = this.items.find(item =>
      item.priority === 'high' && item.status === 'planned'
    );
    
    return high || null;
  }

  // Update item status
  updateStatus(id: string, status: RoadmapItem['status'], blockedReason?: string) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.status = status;
      if (blockedReason) {
        item.blocked_reason = blockedReason;
      }
    }
  }

  // Format roadmap for display
  formatRoadmapSummary(): string {
    const next = this.getNextRecommendedAction();
    const priorities = this.getCurrentPriorities().slice(0, 3);
    
    let summary = 'Current roadmap:\n';
    
    if (next) {
      summary += `\nNext recommended: ${next.title}\n`;
      summary += `Action: ${next.next_action}\n`;
    }
    
    summary += '\nTop priorities:\n';
    priorities.forEach((item, i) => {
      summary += `${i + 1}. ${item.title} (${item.status})\n`;
    });
    
    return summary;
  }
}

export const javariRoadmap = new JavariRoadmap();
