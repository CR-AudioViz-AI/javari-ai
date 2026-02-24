// =============================================================================
// JAVARI AI - AUTONOMOUS BRAIN
// =============================================================================
// Self-learning, self-optimizing AI decision system
// Production Ready - Sunday, December 14, 2025
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============ TYPE DEFINITIONS ============

export interface BrainDecision {
  action: string;
  confidence: number;
  reasoning: string;
  alternativeActions: string[];
  metadata: Record<string, any>;
}

export interface LearningSignal {
  interactionId: string;
  outcome: 'success' | 'partial' | 'failure';
  userFeedback?: 'positive' | 'negative' | 'neutral';
  responseTime: number;
  tokensUsed: number;
  modelUsed: string;
  context: Record<string, any>;
}

export interface ModelPerformance {
  modelName: string;
  successRate: number;
  avgResponseTime: number;
  avgCost: number;
  avgSatisfaction: number;
  totalInteractions: number;
  bestForCategories: string[];
}

export interface AutonomousInsight {
  type: 'optimization' | 'pattern' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedAction?: Record<string, any>;
}

// ============ INTENT DETECTION ============

export class IntentDetector {
  private intents: Map<string, RegExp[]> = new Map();
  
  constructor() {
    this.initializeIntents();
  }
  
  private initializeIntents() {
    // Weather intents
    this.intents.set('weather', [
      /\b(weather|temperature|forecast|rain|sunny|cloudy|snow|humidity)\b/i,
      /\b(how (hot|cold|warm)|what('s| is) the temp)/i,
      /\bweather (in|for|at)\b/i
    ]);
    
    // News intents
    this.intents.set('news', [
      /\b(news|headlines|latest|breaking|current events)\b/i,
      /\bwhat('s| is) happening\b/i,
      /\b(today's|recent) (news|stories|articles)\b/i
    ]);
    
    // Stock/Finance intents
    this.intents.set('stock', [
      /\b(stock|share|equity|ticker|nasdaq|nyse|s&p)\b/i,
      /\$[A-Z]{1,5}\b/,
      /\b(price of|how is|check) [A-Z]{1,5}\b/i,
      /\b(buy|sell|invest|trading)\b/i
    ]);
    
    // Crypto intents
    this.intents.set('crypto', [
      /\b(crypto|bitcoin|ethereum|btc|eth|cryptocurrency|blockchain)\b/i,
      /\b(coin|token|defi|nft)\b/i
    ]);
    
    // Knowledge/Wikipedia intents
    this.intents.set('wikipedia', [
      /\b(who (is|was)|what (is|are|was|were)|explain|tell me about)\b/i,
      /\b(define|definition|meaning of)\b/i,
      /\b(history of|biography|background)\b/i
    ]);
    
    // Translation intents
    this.intents.set('translate', [
      /\b(translate|translation|say .+ in|how do you say)\b/i,
      /\b(spanish|french|german|italian|portuguese|chinese|japanese|korean|arabic|russian)\b/i
    ]);
    
    // Code/Development intents
    this.intents.set('code', [
      /\b(code|programming|developer|api|function|debug|error|bug)\b/i,
      /\b(javascript|python|typescript|react|node|css|html)\b/i,
      /\b(github|npm|package|library|framework)\b/i
    ]);
    
    // Image intents
    this.intents.set('images', [
      /\b(image|photo|picture|pic|visual)\b/i,
      /\b(show me|find|search for) .*(image|photo|picture)/i
    ]);
    
    // Fun/Entertainment intents
    this.intents.set('entertainment', [
      /\b(joke|funny|humor|laugh|entertain)\b/i,
      /\b(quote|inspiration|motivation)\b/i,
      /\b(fact|trivia|did you know)\b/i
    ]);
    
    // Help/Support intents
    this.intents.set('help', [
      /\b(help|support|assist|how (do|can|to))\b/i,
      /\b(problem|issue|trouble|error|fix)\b/i
    ]);
    
    // Creative intents
    this.intents.set('creative', [
      /\b(write|create|generate|compose|draft)\b/i,
      /\b(story|poem|essay|article|blog|email)\b/i
    ]);
  }
  
  detectIntent(message: string): { intent: string; confidence: number; entities: string[] }[] {
    const results: { intent: string; confidence: number; entities: string[] }[] = [];
    
    for (const [intent, patterns] of this.intents) {
      let matchCount = 0;
      const entities: string[] = [];
      
      for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
          matchCount++;
          if (match[0]) entities.push(match[0]);
        }
      }
      
      if (matchCount > 0) {
        const confidence = Math.min(matchCount / patterns.length * 1.5, 1);
        results.push({ intent, confidence, entities });
      }
    }
    
    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  extractEntities(message: string): Record<string, string[]> {
    const entities: Record<string, string[]> = {
      tickers: [],
      locations: [],
      languages: [],
      numbers: [],
      urls: [],
      emails: []
    };
    
    // Stock tickers ($AAPL, TSLA, etc.)
    const tickers = message.match(/\$?[A-Z]{1,5}\b/g);
    if (tickers) entities.tickers = tickers.map(t => t.replace('$', ''));
    
    // Numbers
    const numbers = message.match(/\b\d+(\.\d+)?\b/g);
    if (numbers) entities.numbers = numbers;
    
    // URLs
    const urls = message.match(/https?:\/\/[^\s]+/g);
    if (urls) entities.urls = urls;
    
    // Emails
    const emails = message.match(/[\w.-]+@[\w.-]+\.\w+/g);
    if (emails) entities.emails = emails;
    
    // Languages
    const languages = ['spanish', 'french', 'german', 'italian', 'portuguese', 
                      'chinese', 'japanese', 'korean', 'arabic', 'russian', 'hindi'];
    for (const lang of languages) {
      if (message.toLowerCase().includes(lang)) {
        entities.languages.push(lang);
      }
    }
    
    return entities;
  }
}

// ============ MODEL ROUTER ============

export class ModelRouter {
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  
  async selectBestModel(params: {
    intent: string;
    complexity: 'simple' | 'moderate' | 'complex';
    requiresSpeed: boolean;
    requiresAccuracy: boolean;
    budget?: 'low' | 'medium' | 'high';
  }): Promise<{ model: string; provider: string; confidence: number; reasoning: string }> {
    
    // Model configurations
    const models = [
      {
        name: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        speed: 0.8,
        accuracy: 0.95,
        cost: 0.003,
        bestFor: ['creative', 'code', 'analysis', 'complex']
      },
      {
        name: 'gpt-4-turbo-preview',
        provider: 'openai',
        speed: 0.7,
        accuracy: 0.93,
        cost: 0.01,
        bestFor: ['general', 'conversation', 'code']
      },
      {
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        speed: 0.95,
        accuracy: 0.85,
        cost: 0.0005,
        bestFor: ['simple', 'quick', 'chat']
      },
      {
        name: 'gemini-pro',
        provider: 'google',
        speed: 0.85,
        accuracy: 0.88,
        cost: 0.0005,
        bestFor: ['general', 'multimodal', 'analysis']
      }
    ];
    
    // Score each model
    const scores = models.map(model => {
      let score = 0;
      let reasons: string[] = [];
      
      // Speed preference
      if (params.requiresSpeed) {
        score += model.speed * 30;
        if (model.speed > 0.9) reasons.push('Fast response time');
      }
      
      // Accuracy preference
      if (params.requiresAccuracy) {
        score += model.accuracy * 40;
        if (model.accuracy > 0.9) reasons.push('High accuracy');
      }
      
      // Budget preference
      if (params.budget === 'low' && model.cost < 0.001) {
        score += 20;
        reasons.push('Cost-effective');
      } else if (params.budget === 'high' && model.accuracy > 0.9) {
        score += 15;
        reasons.push('Premium quality');
      }
      
      // Intent matching
      if (model.bestFor.includes(params.intent) || model.bestFor.includes(params.complexity)) {
        score += 25;
        reasons.push(`Optimized for ${params.intent}`);
      }
      
      // Complexity matching
      if (params.complexity === 'complex' && model.accuracy > 0.9) {
        score += 20;
        reasons.push('Handles complex tasks well');
      } else if (params.complexity === 'simple' && model.speed > 0.9) {
        score += 15;
        reasons.push('Efficient for simple tasks');
      }
      
      return {
        ...model,
        score,
        reasoning: reasons.join(', ')
      };
    });
    
    // Sort by score and select best
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    return {
      model: best.name,
      provider: best.provider,
      confidence: Math.min(best.score / 100, 0.99),
      reasoning: best.reasoning || 'Default selection'
    };
  }
  
  async recordPerformance(signal: LearningSignal): Promise<void> {
    try {
      const existing = this.modelPerformance.get(signal.modelUsed);
      
      const successValue = signal.outcome === 'success' ? 1 : signal.outcome === 'partial' ? 0.5 : 0;
      const satisfactionValue = signal.userFeedback === 'positive' ? 1 : 
                                signal.userFeedback === 'negative' ? 0 : 0.5;
      
      if (existing) {
        const total = existing.totalInteractions + 1;
        existing.successRate = (existing.successRate * existing.totalInteractions + successValue) / total;
        existing.avgResponseTime = (existing.avgResponseTime * existing.totalInteractions + signal.responseTime) / total;
        existing.avgSatisfaction = (existing.avgSatisfaction * existing.totalInteractions + satisfactionValue) / total;
        existing.totalInteractions = total;
      } else {
        this.modelPerformance.set(signal.modelUsed, {
          modelName: signal.modelUsed,
          successRate: successValue,
          avgResponseTime: signal.responseTime,
          avgCost: 0,
          avgSatisfaction: satisfactionValue,
          totalInteractions: 1,
          bestForCategories: []
        });
      }
      
      // Persist to database
      await supabase.from('model_performance_stats').upsert({
        model_name: signal.modelUsed,
        total_interactions: this.modelPerformance.get(signal.modelUsed)?.totalInteractions || 1,
        success_rate: this.modelPerformance.get(signal.modelUsed)?.successRate || 0,
        avg_response_time_ms: this.modelPerformance.get(signal.modelUsed)?.avgResponseTime || 0,
        avg_satisfaction: this.modelPerformance.get(signal.modelUsed)?.avgSatisfaction || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'model_name' });
      
    } catch (e) {
      console.error('Performance recording error:', e);
    }
  }
}

// ============ LEARNING ENGINE ============

export class LearningEngine {
  private patterns: Map<string, number> = new Map();
  
  async learn(signal: LearningSignal): Promise<AutonomousInsight[]> {
    const insights: AutonomousInsight[] = [];
    
    try {
      // Store the learning signal
      await supabase.from('learning_feedback').insert({
        interaction_id: signal.interactionId,
        interaction_type: 'chat',
        outcome: signal.outcome,
        context: signal.context,
        metrics: {
          response_time_ms: signal.responseTime,
          tokens_used: signal.tokensUsed,
          model: signal.modelUsed,
          feedback: signal.userFeedback
        },
        created_at: new Date().toISOString()
      });
      
      // Analyze for patterns
      const patternKey = `${signal.context.intent || 'general'}:${signal.outcome}`;
      const currentCount = (this.patterns.get(patternKey) || 0) + 1;
      this.patterns.set(patternKey, currentCount);
      
      // Generate insights
      if (signal.outcome === 'failure' && currentCount > 3) {
        insights.push({
          type: 'pattern',
          title: `Recurring failures for ${signal.context.intent || 'general'} queries`,
          description: `Detected ${currentCount} failures for this query type. Consider investigating.`,
          confidence: Math.min(0.6 + (currentCount * 0.1), 0.95),
          impact: 'high',
          actionable: true,
          suggestedAction: {
            action: 'investigate_failures',
            intent: signal.context.intent,
            count: currentCount
          }
        });
      }
      
      if (signal.responseTime > 5000) {
        insights.push({
          type: 'anomaly',
          title: 'Slow response detected',
          description: `Response time of ${signal.responseTime}ms exceeds threshold`,
          confidence: 0.9,
          impact: 'medium',
          actionable: true,
          suggestedAction: {
            action: 'optimize_response',
            currentTime: signal.responseTime,
            targetTime: 3000
          }
        });
      }
      
      if (signal.userFeedback === 'negative') {
        insights.push({
          type: 'recommendation',
          title: 'User dissatisfaction detected',
          description: 'Consider reviewing the response quality for this type of query',
          confidence: 0.8,
          impact: 'high',
          actionable: true
        });
      }
      
      // Store insights
      for (const insight of insights) {
        await supabase.from('learning_insights').insert({
          insight_type: insight.type,
          title: insight.title,
          description: insight.description,
          confidence: insight.confidence,
          impact: insight.impact,
          actionable: insight.actionable,
          suggested_action: insight.suggestedAction,
          status: 'new',
          created_at: new Date().toISOString()
        });
      }
      
    } catch (e) {
      console.error('Learning error:', e);
    }
    
    return insights;
  }
  
  async getInsights(limit: number = 10): Promise<AutonomousInsight[]> {
    try {
      const { data } = await supabase
        .from('learning_insights')
        .select('*')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      return (data || []).map(row => ({
        type: row.insight_type,
        title: row.title,
        description: row.description,
        confidence: row.confidence,
        impact: row.impact,
        actionable: row.actionable,
        suggestedAction: row.suggested_action
      }));
    } catch (e) {
      return [];
    }
  }
}

// ============ AUTONOMOUS BRAIN ============

export class AutonomousBrain {
  private intentDetector: IntentDetector;
  private modelRouter: ModelRouter;
  private learningEngine: LearningEngine;
  
  constructor() {
    this.intentDetector = new IntentDetector();
    this.modelRouter = new ModelRouter();
    this.learningEngine = new LearningEngine();
  }
  
  async think(message: string, context: Record<string, any> = {}): Promise<BrainDecision> {
    // Detect intent
    const intents = this.intentDetector.detectIntent(message);
    const entities = this.intentDetector.extractEntities(message);
    
    const primaryIntent = intents[0] || { intent: 'general', confidence: 0.5, entities: [] };
    
    // Determine complexity
    const wordCount = message.split(/\s+/).length;
    const complexity: 'simple' | 'moderate' | 'complex' = 
      wordCount < 10 ? 'simple' : wordCount < 50 ? 'moderate' : 'complex';
    
    // Select best model
    const modelSelection = await this.modelRouter.selectBestModel({
      intent: primaryIntent.intent,
      complexity,
      requiresSpeed: context.requiresSpeed || false,
      requiresAccuracy: context.requiresAccuracy || true,
      budget: context.budget || 'medium'
    });
    
    // Build decision
    const decision: BrainDecision = {
      action: this.mapIntentToAction(primaryIntent.intent),
      confidence: primaryIntent.confidence * modelSelection.confidence,
      reasoning: `Detected ${primaryIntent.intent} intent with ${(primaryIntent.confidence * 100).toFixed(0)}% confidence. ${modelSelection.reasoning}`,
      alternativeActions: intents.slice(1, 4).map(i => this.mapIntentToAction(i.intent)),
      metadata: {
        intent: primaryIntent.intent,
        entities,
        complexity,
        selectedModel: modelSelection.model,
        selectedProvider: modelSelection.provider,
        allIntents: intents
      }
    };
    
    return decision;
  }
  
  private mapIntentToAction(intent: string): string {
    const actionMap: Record<string, string> = {
      weather: 'fetch_weather',
      news: 'fetch_news',
      stock: 'fetch_stock',
      crypto: 'fetch_crypto',
      wikipedia: 'fetch_knowledge',
      translate: 'translate_text',
      code: 'assist_coding',
      images: 'search_images',
      entertainment: 'provide_entertainment',
      help: 'provide_help',
      creative: 'generate_content',
      general: 'chat_response'
    };
    
    return actionMap[intent] || 'chat_response';
  }
  
  async learn(signal: LearningSignal): Promise<AutonomousInsight[]> {
    await this.modelRouter.recordPerformance(signal);
    return this.learningEngine.learn(signal);
  }
  
  async getInsights(): Promise<AutonomousInsight[]> {
    return this.learningEngine.getInsights();
  }
  
  getIntentDetector(): IntentDetector {
    return this.intentDetector;
  }
  
  getModelRouter(): ModelRouter {
    return this.modelRouter;
  }
}

// ============ SINGLETON INSTANCE ============

let brainInstance: AutonomousBrain | null = null;

export function getAutonomousBrain(): AutonomousBrain {
  if (!brainInstance) {
    brainInstance = new AutonomousBrain();
  }
  return brainInstance;
}

export default AutonomousBrain;
