// lib/javari/multi-ai/council.ts
// Multi-AI Council Orchestrator

import { ModelMetadata, getModel } from './model-registry';

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
  architect: string; // Model ID for planning
  builder: string; // Model ID for building
  validator: string; // Model ID for validation
  summarizer: string; // Model ID for summary
}

export const DEFAULT_COUNCIL: CouncilConfig = {
  architect: 'gpt-4o-mini', // ChatGPT for planning
  builder: 'claude-sonnet-4', // Claude for building
  validator: 'claude-sonnet-4', // Claude for validation
  summarizer: 'gpt-4o-mini' // ChatGPT for summary
};

export class CouncilOrchestrator {
  private config: CouncilConfig;
  
  constructor(config: CouncilConfig = DEFAULT_COUNCIL) {
    this.config = config;
  }
  
  async executeCouncil(
    userPrompt: string,
    executeModel: (modelId: string, prompt: string) => Promise<string>
  ): Promise<CouncilResult> {
    const startTime = Date.now();
    const steps: CouncilStep[] = [];
    let totalCost = 0;
    
    try {
      // Step 1: Architect (Planning)
      const architectModel = getModel(this.config.architect)!;
      const architectPrompt = this.buildArchitectPrompt(userPrompt);
      
      const architectStep: CouncilStep = {
        step: 1,
        role: 'architect',
        model: architectModel,
        prompt: architectPrompt
      };
      
      const architectStart = Date.now();
      try {
        architectStep.response = await executeModel(
          this.config.architect,
          architectPrompt
        );
        architectStep.duration = Date.now() - architectStart;
        architectStep.success = true;
        totalCost += this.estimateStepCost(architectModel, architectPrompt, architectStep.response);
      } catch (error: any) {
        architectStep.error = error.message;
        architectStep.success = false;
        architectStep.duration = Date.now() - architectStart;
      }
      
      steps.push(architectStep);
      
      if (!architectStep.success) {
        throw new Error('Architect phase failed');
      }
      
      // Step 2: Builder (Implementation)
      const builderModel = getModel(this.config.builder)!;
      const builderPrompt = this.buildBuilderPrompt(
        userPrompt,
        architectStep.response!
      );
      
      const builderStep: CouncilStep = {
        step: 2,
        role: 'builder',
        model: builderModel,
        prompt: builderPrompt
      };
      
      const builderStart = Date.now();
      try {
        builderStep.response = await executeModel(
          this.config.builder,
          builderPrompt
        );
        builderStep.duration = Date.now() - builderStart;
        builderStep.success = true;
        totalCost += this.estimateStepCost(builderModel, builderPrompt, builderStep.response);
      } catch (error: any) {
        builderStep.error = error.message;
        builderStep.success = false;
        builderStep.duration = Date.now() - builderStart;
      }
      
      steps.push(builderStep);
      
      if (!builderStep.success) {
        throw new Error('Builder phase failed');
      }
      
      // Step 3: Validator (Quality Check)
      const validatorModel = getModel(this.config.validator)!;
      const validatorPrompt = this.buildValidatorPrompt(
        userPrompt,
        builderStep.response!
      );
      
      const validatorStep: CouncilStep = {
        step: 3,
        role: 'validator',
        model: validatorModel,
        prompt: validatorPrompt
      };
      
      const validatorStart = Date.now();
      try {
        validatorStep.response = await executeModel(
          this.config.validator,
          validatorPrompt
        );
        validatorStep.duration = Date.now() - validatorStart;
        validatorStep.success = true;
        totalCost += this.estimateStepCost(validatorModel, validatorPrompt, validatorStep.response);
      } catch (error: any) {
        validatorStep.error = error.message;
        validatorStep.success = false;
        validatorStep.duration = Date.now() - validatorStart;
      }
      
      steps.push(validatorStep);
      
      // Step 4: Summarizer (Final Output)
      const summarizerModel = getModel(this.config.summarizer)!;
      const summarizerPrompt = this.buildSummarizerPrompt(
        userPrompt,
        architectStep.response!,
        builderStep.response!,
        validatorStep.response!
      );
      
      const summarizerStep: CouncilStep = {
        step: 4,
        role: 'summarizer',
        model: summarizerModel,
        prompt: summarizerPrompt
      };
      
      const summarizerStart = Date.now();
      try {
        summarizerStep.response = await executeModel(
          this.config.summarizer,
          summarizerPrompt
        );
        summarizerStep.duration = Date.now() - summarizerStart;
        summarizerStep.success = true;
        totalCost += this.estimateStepCost(summarizerModel, summarizerPrompt, summarizerStep.response);
      } catch (error: any) {
        summarizerStep.error = error.message;
        summarizerStep.success = false;
        summarizerStep.duration = Date.now() - summarizerStart;
      }
      
      steps.push(summarizerStep);
      
      return {
        steps,
        finalOutput: summarizerStep.response || builderStep.response || 'Council execution failed',
        totalDuration: Date.now() - startTime,
        totalCost,
        success: summarizerStep.success || false
      };
      
    } catch (error: any) {
      return {
        steps,
        finalOutput: `Council execution error: ${error.message}`,
        totalDuration: Date.now() - startTime,
        totalCost,
        success: false
      };
    }
  }
  
  private buildArchitectPrompt(userPrompt: string): string {
    return `You are the Architect in a Multi-AI Council. Your role is to analyze the request and create a detailed implementation plan.

User Request:
${userPrompt}

Please provide:
1. Analysis of requirements
2. Recommended approach
3. Key components needed
4. Potential challenges
5. Success criteria

Be specific and actionable. The Builder will use your plan to implement the solution.`;
  }
  
  private buildBuilderPrompt(userPrompt: string, architectPlan: string): string {
    return `You are the Builder in a Multi-AI Council. Your role is to implement the solution based on the Architect's plan.

User Request:
${userPrompt}

Architect's Plan:
${architectPlan}

Please implement the solution following the plan. Provide complete, working code or detailed instructions.`;
  }
  
  private buildValidatorPrompt(userPrompt: string, builderOutput: string): string {
    return `You are the Validator in a Multi-AI Council. Your role is to review the Builder's work for quality and correctness.

User Request:
${userPrompt}

Builder's Output:
${builderOutput}

Please review and provide:
1. What works well
2. Potential issues or bugs
3. Suggestions for improvement
4. Overall quality rating (1-10)

Be constructive and specific.`;
  }
  
  private buildSummarizerPrompt(
    userPrompt: string,
    architectPlan: string,
    builderOutput: string,
    validatorFeedback: string
  ): string {
    return `You are the Summarizer in a Multi-AI Council. Your role is to synthesize all council outputs into a final, cohesive response.

User Request:
${userPrompt}

Council Outputs:
- Architect: ${architectPlan.substring(0, 200)}...
- Builder: ${builderOutput.substring(0, 200)}...
- Validator: ${validatorFeedback.substring(0, 200)}...

Provide a final, complete response that:
1. Addresses the user's original request
2. Incorporates the best elements from all council members
3. Applies validator feedback
4. Is production-ready

Be concise but complete.`;
  }
  
  private estimateStepCost(
    model: ModelMetadata,
    prompt: string,
    response: string | undefined
  ): number {
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = response ? Math.ceil(response.length / 4) : 0;
    
    const inputCost = (inputTokens * model.pricing.inputPerMillion) / 1000000;
    const outputCost = (outputTokens * model.pricing.outputPerMillion) / 1000000;
    
    return inputCost + outputCost;
  }
}
