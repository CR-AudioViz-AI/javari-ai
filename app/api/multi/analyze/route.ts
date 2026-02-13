// app/api/multi/analyze/route.ts
// Multi-AI analysis endpoint for task classification and model recommendation

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const maxDuration = 10;

import { NextRequest, NextResponse } from 'next/server';
import { routeRequest, RoutingContext } from '@/lib/javari/multi-ai/router';
import { getAvailableModels, selectModelByTask } from '@/lib/javari/multi-ai/model-registry';

interface AnalyzeRequest {
  prompt: string;
  mode?: 'single' | 'super' | 'advanced' | 'roadmap' | 'council';
  policy?: {
    maxCostPerRequest?: number;
    preferredProviders?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    
    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }
    
    // Analyze prompt characteristics
    const analysis = analyzePromptCharacteristics(body.prompt);
    
    // Get routing decision
    const context: RoutingContext = {
      prompt: body.prompt,
      mode: body.mode || 'single',
      policy: body.policy
    };
    
    const decision = routeRequest(context);
    
    // Get alternative recommendations
    const alternatives = getAlternativeModels(analysis);
    
    return NextResponse.json({
      analysis: {
        complexity: analysis.complexity,
        estimatedTokens: analysis.estimatedTokens,
        characteristics: analysis.characteristics,
        keywords: analysis.keywords
      },
      recommendation: {
        primary: {
          model: decision.selectedModel.name,
          modelId: decision.selectedModel.id,
          provider: decision.selectedModel.provider,
          reason: decision.reason,
          costEstimate: decision.costEstimate,
          confidence: decision.confidence,
          capabilities: decision.selectedModel.capabilities,
          speed: decision.selectedModel.speed,
          cost: decision.selectedModel.cost
        },
        alternatives: alternatives.map(alt => ({
          model: alt.name,
          modelId: alt.id,
          provider: alt.provider,
          speed: alt.speed,
          cost: alt.cost,
          capabilities: alt.capabilities,
          useCase: getUseCase(alt)
        }))
      },
      routing: {
        shouldUseCouncil: analysis.complexity === 'high' && analysis.characteristics.needsCoding,
        suggestedMode: getSuggestedMode(analysis)
      }
    });
    
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const models = getAvailableModels();
  
  return NextResponse.json({
    status: 'healthy',
    runtime: 'edge',
    version: '1.0-ANALYZE',
    features: [
      'prompt analysis',
      'model recommendation',
      'cost estimation',
      'task classification'
    ],
    availableModels: models.length,
    modelsByProvider: models.reduce((acc, m) => {
      acc[m.provider] = (acc[m.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });
}

function analyzePromptCharacteristics(prompt: string) {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;
  
  // Keyword detection
  const keywords = {
    reasoning: ['analyze', 'explain', 'why', 'reason', 'compare', 'evaluate'],
    coding: ['code', 'function', 'implement', 'build', 'create', 'debug', 'api'],
    speed: ['quick', 'fast', 'urgent', 'asap', 'brief'],
    creative: ['write', 'story', 'design', 'creative', 'imagine'],
    data: ['data', 'table', 'chart', 'graph', 'statistics', 'analyze']
  };
  
  const detectedKeywords: string[] = [];
  const characteristics = {
    needsReasoning: false,
    needsCoding: false,
    needsSpeed: false,
    needsCreativity: false,
    needsDataAnalysis: false
  };
  
  Object.entries(keywords).forEach(([category, words]) => {
    const found = words.filter(kw => lower.includes(kw));
    if (found.length > 0) {
      detectedKeywords.push(...found);
      
      if (category === 'reasoning') characteristics.needsReasoning = true;
      if (category === 'coding') characteristics.needsCoding = true;
      if (category === 'speed') characteristics.needsSpeed = true;
      if (category === 'creative') characteristics.needsCreativity = true;
      if (category === 'data') characteristics.needsDataAnalysis = true;
    }
  });
  
  // Complexity assessment
  let complexity: 'low' | 'medium' | 'high' = 'low';
  
  if (wordCount > 50) complexity = 'medium';
  if (wordCount > 150 || characteristics.needsReasoning) complexity = 'medium';
  if (wordCount > 300 || (characteristics.needsReasoning && characteristics.needsCoding)) {
    complexity = 'high';
  }
  
  return {
    complexity,
    estimatedTokens: Math.ceil(wordCount * 1.3),
    characteristics,
    keywords: Array.from(new Set(detectedKeywords))
  };
}

function getAlternativeModels(analysis: ReturnType<typeof analyzePromptCharacteristics>) {
  const models = getAvailableModels();
  
  // Score each model
  const scored = models.map(model => {
    let score = 0;
    
    if (analysis.characteristics.needsReasoning) {
      score += model.capabilities.reasoning;
    }
    if (analysis.characteristics.needsCoding) {
      score += model.capabilities.coding;
    }
    if (analysis.characteristics.needsSpeed) {
      score += model.capabilities.speed;
    }
    
    // Diversity bonus (prefer different providers)
    score += model.reliability * 5;
    
    return { model, score };
  });
  
  // Return top 3 alternatives
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.model);
}

function getUseCase(model: any): string {
  if (model.cost === 'free' && model.speed === 'ultra-fast') {
    return 'Fast, free inference for simple tasks';
  }
  if (model.capabilities.reasoning >= 9) {
    return 'Complex reasoning and analysis';
  }
  if (model.capabilities.coding >= 9) {
    return 'Code generation and debugging';
  }
  if (model.speed === 'ultra-fast') {
    return 'Real-time applications';
  }
  if (model.cost === 'free' || model.cost === 'low') {
    return 'Cost-effective general purpose';
  }
  return 'General purpose AI tasks';
}

function getSuggestedMode(analysis: ReturnType<typeof analyzePromptCharacteristics>): string {
  if (analysis.complexity === 'high' && analysis.characteristics.needsCoding) {
    return 'council';
  }
  if (analysis.complexity === 'high') {
    return 'advanced';
  }
  if (analysis.complexity === 'medium') {
    return 'super';
  }
  return 'single';
}
