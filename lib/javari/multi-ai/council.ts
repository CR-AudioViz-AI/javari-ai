// lib/javari/multi-ai/council.ts
// Multi-AI Council Orchestrator (Registry Safe)

import { ModelMetadata, getModel, initRegistry } from './model-registry';

export interface CouncilStep {
  step: number;
  role: 'architect' | 'builder' | 'validator' | 'summarizer';
  model: ModelMetadata;
  prompt: string;
  response?: string;
  duration?: number;
  success?: boolean;
  error?: string;
}

export interface CouncilResult {
  steps: CouncilStep[];
  finalOutput: string;
  totalDuration: number;
  totalCost: number;
  success: boolean;
}

export interface CouncilConfig {
  architect: string;
  builder: string;
  validator: string;
  summarizer: string;
}

export const DEFAULT_COUNCIL: CouncilConfig = {
  architect: 'gpt-4o-mini',
  builder: 'claude-sonnet-4-20250514',
  validator: 'claude-sonnet-4-20250514',
  summarizer: 'gpt-4o-mini'
};

export class CouncilOrchestrator {
  constructor(private config: CouncilConfig = DEFAULT_COUNCIL) {}

  async executeCouncil(
    userPrompt: string,
    executeModel: (modelId: string, prompt: string) => Promise<string>
  ): Promise<CouncilResult> {

    // 🚨 REQUIRED FIRST LINE
    await initRegistry();

    const startTime = Date.now();
    const steps: CouncilStep[] = [];
    let totalCost = 0;

    const architectModel = getModel(this.config.architect)!;
    const architectPrompt = `Architect:\n${userPrompt}`;
    const architectResponse = await executeModel(this.config.architect, architectPrompt);

    steps.push({
      step: 1,
      role: 'architect',
      model: architectModel,
      prompt: architectPrompt,
      response: architectResponse,
      success: true
    });

    return {
      steps,
      finalOutput: architectResponse,
      totalDuration: Date.now() - startTime,
      totalCost,
      success: true
    };
  }
}
