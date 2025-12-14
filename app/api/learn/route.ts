// =============================================================================
// JAVARI AI - LEARNING FEEDBACK LOOP API
// =============================================================================
// The brain of autonomous self-improvement:
// - Tracks successful vs failed interactions
// - Learns which prompts/approaches work best
// - Adjusts AI routing based on performance
// - Enables A/B testing of different strategies
// 
// Endpoints:
//   POST /api/learn/feedback     - Record interaction outcome
//   POST /api/learn/optimize     - Get optimized parameters based on learning
//   GET  /api/learn/insights     - Get learning insights and recommendations
//   POST /api/learn/experiment   - Create/evaluate A/B experiments
//
// Created: Saturday, December 13, 2025 - 6:28 PM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FeedbackPayload {
  interaction_id: string;
  interaction_type: 'chat' | 'code_gen' | 'analysis' | 'search' | 'tool_use';
  outcome: 'success' | 'partial' | 'failure' | 'abandoned';
  
  // What was attempted
  context: {
    model_used: string;
    prompt_template?: string;
    temperature?: number;
    max_tokens?: number;
    tools_enabled?: string[];
    user_intent?: string;
  };
  
  // Metrics
  metrics: {
    response_time_ms?: number;
    tokens_used?: number;
    cost_usd?: number;
    user_satisfaction?: number; // 1-5 scale
    task_completed?: boolean;
    required_retries?: number;
    error_occurred?: boolean;
  };
  
  // Optional detailed feedback
  feedback?: {
    what_worked?: string;
    what_failed?: string;
    user_correction?: string;
    suggested_improvement?: string;
  };
}

interface LearningInsight {
  insight_id: string;
  insight_type: 'model_performance' | 'prompt_effectiveness' | 'cost_efficiency' | 'error_pattern' | 'user_preference';
  title: string;
  description: string;
  confidence: number; // 0-100
  data_points: number;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggested_action?: {
    action_type: 'config_change' | 'prompt_update' | 'model_switch' | 'feature_flag';
    current_value?: string;
    suggested_value?: string;
    expected_improvement?: string;
  };
}

interface OptimizationParams {
  interaction_type: string;
  user_context?: {
    expertise_level?: 'beginner' | 'intermediate' | 'expert';
    preferred_style?: 'concise' | 'detailed' | 'code_heavy';
    history_success_rate?: number;
  };
  constraints?: {
    max_cost_usd?: number;
    max_response_time_ms?: number;
    require_streaming?: boolean;
  };
}

interface OptimizedConfig {
  recommended_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt_additions: string[];
  tools_to_enable: string[];
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    model: string;
    reason: string;
  }>;
}

interface Experiment {
  experiment_id: string;
  name: string;
  hypothesis: string;
  variants: ExperimentVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  start_date?: string;
  end_date?: string;
  sample_size_target: number;
  current_sample_size: number;
  winner?: string;
  statistical_significance?: number;
}

interface ExperimentVariant {
  variant_id: string;
  name: string;
  config: Record<string, unknown>;
  traffic_percentage: number;
  metrics: {
    impressions: number;
    successes: number;
    success_rate: number;
    avg_satisfaction: number;
    avg_response_time: number;
  };
}

// -----------------------------------------------------------------------------
// Learning Data Store (In-Memory + Database)
// -----------------------------------------------------------------------------

interface LearningStore {
  interactions: Map<string, FeedbackPayload[]>;
  modelPerformance: Map<string, { success: number; total: number; avgTime: number; avgCost: number }>;
  promptEffectiveness: Map<string, { success: number; total: number }>;
  experiments: Map<string, Experiment>;
}

const learningStore: LearningStore = {
  interactions: new Map(),
  modelPerformance: new Map(),
  promptEffectiveness: new Map(),
  experiments: new Map(),
};

// -----------------------------------------------------------------------------
// Helper: Get Supabase Client
// -----------------------------------------------------------------------------

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// -----------------------------------------------------------------------------
// Helper: Update Learning Store
// -----------------------------------------------------------------------------

function updateLearningStore(feedback: FeedbackPayload): void {
  // Track by interaction type
  const key = feedback.interaction_type;
  if (!learningStore.interactions.has(key)) {
    learningStore.interactions.set(key, []);
  }
  learningStore.interactions.get(key)!.push(feedback);
  
  // Keep only last 1000 per type
  const interactions = learningStore.interactions.get(key)!;
  if (interactions.length > 1000) {
    learningStore.interactions.set(key, interactions.slice(-1000));
  }
  
  // Update model performance
  const model = feedback.context.model_used;
  if (!learningStore.modelPerformance.has(model)) {
    learningStore.modelPerformance.set(model, { success: 0, total: 0, avgTime: 0, avgCost: 0 });
  }
  const perf = learningStore.modelPerformance.get(model)!;
  perf.total++;
  if (feedback.outcome === 'success') perf.success++;
  if (feedback.metrics.response_time_ms) {
    perf.avgTime = (perf.avgTime * (perf.total - 1) + feedback.metrics.response_time_ms) / perf.total;
  }
  if (feedback.metrics.cost_usd) {
    perf.avgCost = (perf.avgCost * (perf.total - 1) + feedback.metrics.cost_usd) / perf.total;
  }
  
  // Update prompt effectiveness
  if (feedback.context.prompt_template) {
    const promptKey = feedback.context.prompt_template;
    if (!learningStore.promptEffectiveness.has(promptKey)) {
      learningStore.promptEffectiveness.set(promptKey, { success: 0, total: 0 });
    }
    const promptPerf = learningStore.promptEffectiveness.get(promptKey)!;
    promptPerf.total++;
    if (feedback.outcome === 'success') promptPerf.success++;
  }
}

// -----------------------------------------------------------------------------
// Helper: Generate Insights
// -----------------------------------------------------------------------------

function generateInsights(): LearningInsight[] {
  const insights: LearningInsight[] = [];
  
  // Model Performance Insights
  const modelData = Array.from(learningStore.modelPerformance.entries());
  if (modelData.length > 1) {
    const sorted = modelData.sort((a, b) => {
      const rateA = a[1].total > 0 ? a[1].success / a[1].total : 0;
      const rateB = b[1].total > 0 ? b[1].success / b[1].total : 0;
      return rateB - rateA;
    });
    
    const [bestModel, bestPerf] = sorted[0];
    const [worstModel, worstPerf] = sorted[sorted.length - 1];
    
    if (bestPerf.total >= 10 && worstPerf.total >= 10) {
      const bestRate = (bestPerf.success / bestPerf.total * 100).toFixed(1);
      const worstRate = (worstPerf.success / worstPerf.total * 100).toFixed(1);
      
      if (parseFloat(bestRate) - parseFloat(worstRate) > 10) {
        insights.push({
          insight_id: `model_perf_${Date.now()}`,
          insight_type: 'model_performance',
          title: `${bestModel} Outperforming Other Models`,
          description: `${bestModel} has a ${bestRate}% success rate vs ${worstModel}'s ${worstRate}%`,
          confidence: Math.min(bestPerf.total, 100),
          data_points: bestPerf.total + worstPerf.total,
          recommendation: `Consider routing more traffic to ${bestModel} for better outcomes`,
          impact: 'high',
          actionable: true,
          suggested_action: {
            action_type: 'model_switch',
            current_value: worstModel,
            suggested_value: bestModel,
            expected_improvement: `+${(parseFloat(bestRate) - parseFloat(worstRate)).toFixed(1)}% success rate`
          }
        });
      }
    }
  }
  
  // Cost Efficiency Insights
  const costData = modelData.filter(([, perf]) => perf.avgCost > 0 && perf.total >= 5);
  if (costData.length > 1) {
    const sorted = costData.sort((a, b) => {
      const effA = a[1].total > 0 ? (a[1].success / a[1].total) / a[1].avgCost : 0;
      const effB = b[1].total > 0 ? (b[1].success / b[1].total) / b[1].avgCost : 0;
      return effB - effA;
    });
    
    const [mostEfficient, efficientPerf] = sorted[0];
    const successRate = efficientPerf.total > 0 ? efficientPerf.success / efficientPerf.total : 0;
    
    insights.push({
      insight_id: `cost_eff_${Date.now()}`,
      insight_type: 'cost_efficiency',
      title: `${mostEfficient} Most Cost-Effective`,
      description: `Best balance of success rate (${(successRate * 100).toFixed(1)}%) and cost ($${efficientPerf.avgCost.toFixed(4)}/request)`,
      confidence: Math.min(efficientPerf.total * 2, 100),
      data_points: efficientPerf.total,
      recommendation: `Use ${mostEfficient} as default for non-critical tasks`,
      impact: 'medium',
      actionable: true,
      suggested_action: {
        action_type: 'config_change',
        current_value: 'variable',
        suggested_value: mostEfficient,
        expected_improvement: `Estimated 20-40% cost reduction`
      }
    });
  }
  
  // Response Time Insights
  const slowModels = modelData.filter(([, perf]) => perf.avgTime > 5000 && perf.total >= 5);
  for (const [model, perf] of slowModels) {
    insights.push({
      insight_id: `slow_model_${model}_${Date.now()}`,
      insight_type: 'model_performance',
      title: `${model} Response Time Concern`,
      description: `Average response time of ${(perf.avgTime / 1000).toFixed(1)}s may impact user experience`,
      confidence: Math.min(perf.total * 5, 100),
      data_points: perf.total,
      recommendation: 'Consider using faster models for time-sensitive operations',
      impact: 'medium',
      actionable: true
    });
  }
  
  // Prompt Effectiveness Insights
  const promptData = Array.from(learningStore.promptEffectiveness.entries())
    .filter(([, perf]) => perf.total >= 10);
  
  for (const [prompt, perf] of promptData) {
    const rate = perf.total > 0 ? perf.success / perf.total : 0;
    if (rate < 0.5) {
      insights.push({
        insight_id: `prompt_eff_${Date.now()}`,
        insight_type: 'prompt_effectiveness',
        title: `Low-Performing Prompt Template`,
        description: `Template "${prompt.substring(0, 30)}..." has only ${(rate * 100).toFixed(1)}% success rate`,
        confidence: Math.min(perf.total * 3, 100),
        data_points: perf.total,
        recommendation: 'Review and revise this prompt template',
        impact: 'high',
        actionable: true,
        suggested_action: {
          action_type: 'prompt_update',
          current_value: prompt,
          suggested_value: 'Needs revision',
          expected_improvement: 'Target 70%+ success rate'
        }
      });
    }
  }
  
  return insights;
}

// -----------------------------------------------------------------------------
// Helper: Get Optimized Config
// -----------------------------------------------------------------------------

function getOptimizedConfig(params: OptimizationParams): OptimizedConfig {
  const modelData = Array.from(learningStore.modelPerformance.entries());
  
  // Default configuration
  let recommended = {
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    max_tokens: 4096,
    system_additions: [] as string[],
    tools: [] as string[],
    confidence: 50,
    reasoning: 'Default configuration - insufficient data for optimization'
  };
  
  // Filter models by constraints
  let eligibleModels = modelData.filter(([, perf]) => {
    if (params.constraints?.max_response_time_ms && perf.avgTime > params.constraints.max_response_time_ms) {
      return false;
    }
    if (params.constraints?.max_cost_usd && perf.avgCost > params.constraints.max_cost_usd) {
      return false;
    }
    return perf.total >= 5; // Need minimum data
  });
  
  if (eligibleModels.length > 0) {
    // Sort by success rate
    eligibleModels.sort((a, b) => {
      const rateA = a[1].total > 0 ? a[1].success / a[1].total : 0;
      const rateB = b[1].total > 0 ? b[1].success / b[1].total : 0;
      return rateB - rateA;
    });
    
    const [bestModel, bestPerf] = eligibleModels[0];
    const successRate = bestPerf.total > 0 ? bestPerf.success / bestPerf.total : 0;
    
    recommended = {
      model: bestModel,
      temperature: successRate > 0.8 ? 0.7 : 0.5, // Lower temp if struggling
      max_tokens: params.interaction_type === 'code_gen' ? 8192 : 4096,
      system_additions: [],
      tools: params.interaction_type === 'code_gen' ? ['code_interpreter'] : [],
      confidence: Math.min(bestPerf.total * 2, 95),
      reasoning: `${bestModel} selected based on ${(successRate * 100).toFixed(1)}% success rate across ${bestPerf.total} interactions`
    };
  }
  
  // Adjust for user context
  if (params.user_context?.expertise_level === 'beginner') {
    recommended.system_additions.push('Provide detailed explanations with examples');
    recommended.temperature = Math.max(recommended.temperature - 0.1, 0.3);
  } else if (params.user_context?.expertise_level === 'expert') {
    recommended.system_additions.push('Be concise, skip basic explanations');
  }
  
  if (params.user_context?.preferred_style === 'code_heavy') {
    recommended.system_additions.push('Prioritize code examples over prose');
    recommended.tools.push('code_interpreter');
  }
  
  // Build alternatives
  const alternatives = eligibleModels.slice(1, 4).map(([model, perf]) => ({
    model,
    reason: `${(perf.total > 0 ? perf.success / perf.total * 100 : 0).toFixed(1)}% success, $${perf.avgCost.toFixed(4)}/req`
  }));
  
  return {
    recommended_model: recommended.model,
    temperature: recommended.temperature,
    max_tokens: recommended.max_tokens,
    system_prompt_additions: recommended.system_additions,
    tools_to_enable: recommended.tools,
    confidence: recommended.confidence,
    reasoning: recommended.reasoning,
    alternatives
  };
}

// -----------------------------------------------------------------------------
// POST /api/learn - Handle all learning operations
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'feedback';
    const body = await request.json();
    
    switch (action) {
      // -----------------------------------------------------------------
      // Record Feedback
      // -----------------------------------------------------------------
      case 'feedback': {
        const feedback = body as FeedbackPayload;
        
        if (!feedback.interaction_id || !feedback.interaction_type || !feedback.outcome) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields: interaction_id, interaction_type, outcome'
          }, { status: 400 });
        }
        
        // Update in-memory store
        updateLearningStore(feedback);
        
        // Try to persist to database
        const supabase = getSupabase();
        let stored = false;
        
        if (supabase) {
          try {
            const { error } = await supabase
              .from('learning_feedback')
              .insert({
                interaction_id: feedback.interaction_id,
                interaction_type: feedback.interaction_type,
                outcome: feedback.outcome,
                context: feedback.context,
                metrics: feedback.metrics,
                feedback: feedback.feedback,
                created_at: new Date().toISOString()
              });
            
            stored = !error;
          } catch {
            // Database storage optional
          }
        }
        
        // Generate immediate insights based on this feedback
        const modelPerf = learningStore.modelPerformance.get(feedback.context.model_used);
        
        return NextResponse.json({
          success: true,
          stored,
          current_model_stats: modelPerf ? {
            model: feedback.context.model_used,
            success_rate: modelPerf.total > 0 ? (modelPerf.success / modelPerf.total * 100).toFixed(1) + '%' : 'N/A',
            avg_response_time: modelPerf.avgTime.toFixed(0) + 'ms',
            total_interactions: modelPerf.total
          } : null,
          learning_active: true
        }, {
          headers: { 'X-Response-Time': `${Date.now() - startTime}ms` }
        });
      }
      
      // -----------------------------------------------------------------
      // Get Optimized Parameters
      // -----------------------------------------------------------------
      case 'optimize': {
        const params = body as OptimizationParams;
        
        if (!params.interaction_type) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: interaction_type'
          }, { status: 400 });
        }
        
        const optimized = getOptimizedConfig(params);
        
        return NextResponse.json({
          success: true,
          optimized,
          data_points: Array.from(learningStore.modelPerformance.values())
            .reduce((sum, p) => sum + p.total, 0)
        }, {
          headers: { 'X-Response-Time': `${Date.now() - startTime}ms` }
        });
      }
      
      // -----------------------------------------------------------------
      // Create/Manage Experiment
      // -----------------------------------------------------------------
      case 'experiment': {
        const { operation, experiment } = body as { 
          operation: 'create' | 'start' | 'stop' | 'evaluate';
          experiment: Partial<Experiment>;
        };
        
        if (operation === 'create') {
          const newExperiment: Experiment = {
            experiment_id: `exp_${Date.now()}`,
            name: experiment.name || 'Unnamed Experiment',
            hypothesis: experiment.hypothesis || '',
            variants: experiment.variants || [],
            status: 'draft',
            sample_size_target: experiment.sample_size_target || 100,
            current_sample_size: 0
          };
          
          learningStore.experiments.set(newExperiment.experiment_id, newExperiment);
          
          return NextResponse.json({
            success: true,
            experiment: newExperiment
          });
        }
        
        if (operation === 'evaluate' && experiment.experiment_id) {
          const exp = learningStore.experiments.get(experiment.experiment_id);
          if (!exp) {
            return NextResponse.json({ success: false, error: 'Experiment not found' }, { status: 404 });
          }
          
          // Calculate winner
          const sorted = exp.variants.sort((a, b) => b.metrics.success_rate - a.metrics.success_rate);
          const winner = sorted[0];
          const runnerUp = sorted[1];
          
          // Simple statistical significance check
          const n1 = winner.metrics.impressions;
          const n2 = runnerUp?.metrics.impressions || 0;
          const p1 = winner.metrics.success_rate;
          const p2 = runnerUp?.metrics.success_rate || 0;
          
          let significance = 0;
          if (n1 > 30 && n2 > 30) {
            const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
            const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
            const z = se > 0 ? Math.abs(p1 - p2) / se : 0;
            significance = Math.min((1 - Math.exp(-0.5 * z * z)) * 100, 99);
          }
          
          exp.winner = winner.variant_id;
          exp.statistical_significance = significance;
          
          return NextResponse.json({
            success: true,
            experiment: exp,
            winner: winner.name,
            significance: `${significance.toFixed(1)}%`,
            recommendation: significance > 95 
              ? `Strong evidence: Implement ${winner.name}`
              : significance > 80
                ? `Moderate evidence: Consider ${winner.name}, gather more data`
                : 'Insufficient evidence: Continue experiment'
          });
        }
        
        return NextResponse.json({ success: false, error: 'Invalid operation' }, { status: 400 });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Learning operation failed'
    }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// GET /api/learn - Get insights
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'insights';
    
    switch (type) {
      case 'insights': {
        const insights = generateInsights();
        
        return NextResponse.json({
          success: true,
          insights,
          total_insights: insights.length,
          actionable_count: insights.filter(i => i.actionable).length,
          high_impact_count: insights.filter(i => i.impact === 'high').length,
          total_data_points: Array.from(learningStore.modelPerformance.values())
            .reduce((sum, p) => sum + p.total, 0),
          generated_at: new Date().toISOString()
        }, {
          headers: { 'X-Response-Time': `${Date.now() - startTime}ms` }
        });
      }
      
      case 'stats': {
        const modelStats = Array.from(learningStore.modelPerformance.entries()).map(([model, perf]) => ({
          model,
          total_interactions: perf.total,
          success_rate: perf.total > 0 ? (perf.success / perf.total * 100).toFixed(1) + '%' : 'N/A',
          avg_response_time_ms: perf.avgTime.toFixed(0),
          avg_cost_usd: perf.avgCost.toFixed(4)
        }));
        
        return NextResponse.json({
          success: true,
          model_stats: modelStats,
          total_models_tracked: modelStats.length,
          total_interactions: modelStats.reduce((sum, m) => sum + m.total_interactions, 0)
        });
      }
      
      case 'experiments': {
        const experiments = Array.from(learningStore.experiments.values());
        return NextResponse.json({
          success: true,
          experiments,
          active_count: experiments.filter(e => e.status === 'running').length,
          completed_count: experiments.filter(e => e.status === 'completed').length
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown type: ${type}`
        }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get insights'
    }, { status: 500 });
  }
}
