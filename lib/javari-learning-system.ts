// lib/javari-learning-system.ts
// Autonomous learning and improvement system

export interface LearningEvent {
  timestamp: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  model_used?: string;
  missing_info?: string[];
  user_feedback?: string;
  error_details?: string;
}

export interface LearningPattern {
  pattern_type: string;
  frequency: number;
  success_rate: number;
  common_missing_inputs: string[];
  recommended_questions: string[];
}

export class JavariLearningSystem {
  private events: LearningEvent[] = [];
  private patterns: Map<string, LearningPattern> = new Map();

  // Track action outcome
  trackAction(action: string, outcome: 'success' | 'failure' | 'partial', details?: {
    model?: string;
    missing_info?: string[];
    feedback?: string;
    error?: string;
  }) {
    const event: LearningEvent = {
      timestamp: new Date().toISOString(),
      action,
      outcome,
      model_used: details?.model,
      missing_info: details?.missing_info,
      user_feedback: details?.feedback,
      error_details: details?.error,
    };
    
    this.events.push(event);
    this.updatePatterns(action, outcome, details?.missing_info);
  }

  // Update learned patterns
  private updatePatterns(action: string, outcome: string, missing_info?: string[]) {
    const pattern = this.patterns.get(action) || {
      pattern_type: action,
      frequency: 0,
      success_rate: 0,
      common_missing_inputs: [],
      recommended_questions: [],
    };

    pattern.frequency++;
    const successes = this.events.filter(e => e.action === action && e.outcome === 'success').length;
    pattern.success_rate = successes / pattern.frequency;

    if (missing_info) {
      missing_info.forEach(info => {
        if (!pattern.common_missing_inputs.includes(info)) {
          pattern.common_missing_inputs.push(info);
        }
      });
    }

    this.patterns.set(action, pattern);
  }

  // Get recommended questions for action type
  getRecommendedQuestions(action: string): string[] {
    const pattern = this.patterns.get(action);
    if (!pattern) return [];
    
    // Generate smart questions based on common missing inputs
    return pattern.common_missing_inputs.slice(0, 4);
  }

  // Get success rate for action
  getSuccessRate(action: string): number {
    const pattern = this.patterns.get(action);
    return pattern?.success_rate || 0;
  }

  // Export learning data
  exportLearningData() {
    return {
      total_events: this.events.length,
      patterns: Array.from(this.patterns.values()),
      recent_events: this.events.slice(-20),
    };
  }
}

// Global learning system instance
export const javariLearning = new JavariLearningSystem();
