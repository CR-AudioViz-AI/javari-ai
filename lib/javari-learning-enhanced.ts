// lib/javari-learning-enhanced.ts
// 24x7 Continuous Learning System

export interface InteractionEvent {
  id: string;
  timestamp: string;
  intent: string;
  plan: string[];
  actions_taken: string[];
  result: 'success' | 'failure' | 'partial';
  cost: number;
  model_used: string;
  failure_reason?: string;
}

export interface ToolEvent {
  id: string;
  timestamp: string;
  tool: string;
  input: any;
  output: any;
  duration_ms: number;
  success: boolean;
}

export interface FailureEvent {
  id: string;
  timestamp: string;
  context: string;
  error: string;
  recovery_action: string;
  recovered: boolean;
}

export interface CompetitorEvent {
  id: string;
  timestamp: string;
  competitor: string;
  feature_snapshot: any;
  diff: string[];
  opportunities: string[];
}

export class JavariLearningEnhanced {
  private interactions: InteractionEvent[] = [];
  private tools: ToolEvent[] = [];
  private failures: FailureEvent[] = [];
  private competitors: CompetitorEvent[] = [];
  
  // Track complete interaction
  trackInteraction(event: Omit<InteractionEvent, 'id' | 'timestamp'>) {
    this.interactions.push({
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    });
    
    // Auto-learn: update heuristics
    this.updateHeuristics(event);
  }
  
  // Track tool usage
  trackTool(event: Omit<ToolEvent, 'id' | 'timestamp'>) {
    this.tools.push({
      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    });
  }
  
  // Track failures for learning
  trackFailure(event: Omit<FailureEvent, 'id' | 'timestamp'>) {
    this.failures.push({
      id: `fail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    });
  }
  
  // Track competitor intel
  trackCompetitor(event: Omit<CompetitorEvent, 'id' | 'timestamp'>) {
    this.competitors.push({
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    });
  }
  
  // Update heuristics based on outcomes
  private updateHeuristics(event: Omit<InteractionEvent, 'id' | 'timestamp'>) {
    // Build pattern recognition:
    // If success, remember what model + plan worked
    // If failure, remember what to avoid
    
    const pattern = `${event.intent}_${event.model_used}`;
    
    // Stub - in production, store in persistent DB
    console.log(`[Learning] Pattern: ${pattern} → ${event.result}`);
  }
  
  // Get insights for similar request
  getInsights(intent: string): {
    recommended_model: string;
    common_pitfalls: string[];
    success_rate: number;
  } {
    const similar = this.interactions.filter(i => 
      i.intent.toLowerCase().includes(intent.toLowerCase())
    );
    
    if (similar.length === 0) {
      return {
        recommended_model: 'gpt-4',
        common_pitfalls: [],
        success_rate: 0,
      };
    }
    
    const successes = similar.filter(i => i.result === 'success');
    const successRate = successes.length / similar.length;
    
    // Find most successful model
    const modelCounts: Record<string, number> = {};
    successes.forEach(s => {
      modelCounts[s.model_used] = (modelCounts[s.model_used] || 0) + 1;
    });
    
    const bestModel = Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'gpt-4';
    
    const failures = similar.filter(i => i.result === 'failure');
    const pitfalls = [...new Set(failures.map(f => f.failure_reason).filter(Boolean))];
    
    return {
      recommended_model: bestModel,
      common_pitfalls: pitfalls as string[],
      success_rate: successRate,
    };
  }
  
  // Export all learning data
  exportAll() {
    return {
      total_interactions: this.interactions.length,
      total_tools: this.tools.length,
      total_failures: this.failures.length,
      total_competitors: this.competitors.length,
      success_rate: this.calculateSuccessRate(),
      recent_failures: this.failures.slice(-10),
      competitor_opportunities: this.getLatestOpportunities(),
    };
  }
  
  private calculateSuccessRate(): number {
    if (this.interactions.length === 0) return 0;
    const successes = this.interactions.filter(i => i.result === 'success').length;
    return successes / this.interactions.length;
  }
  
  private getLatestOpportunities(): string[] {
    return this.competitors
      .slice(-5)
      .flatMap(c => c.opportunities);
  }
}

export const javariLearningEnhanced = new JavariLearningEnhanced();
