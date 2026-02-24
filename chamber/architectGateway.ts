/**
 * ARCHITECT GATEWAY - ChatGPT o-series (o1/o3)
 * 
 * Analyzes goals and creates detailed build plans
 * Uses OpenAI's reasoning models for system design
 */

import OpenAI from 'openai';

// Lazy init to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

// Use o1-preview (or o3-mini when available)
const ARCHITECT_MODEL = 'o1-preview';

export interface BuildCommand {
  id: string;
  type: 'create_file' | 'modify_file' | 'delete_file' | 'run_command';
  target: string;
  content?: string;
  reasoning: string;
}

export interface ArchitectOutput {
  goal: string;
  analysis: string;
  architecture: string;
  commands: BuildCommand[];
  risks: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export class ArchitectGateway {
  /**
   * Analyze goal and generate build plan
   */
  async design(goal: string, context?: any): Promise<ArchitectOutput> {
    console.log('[ARCHITECT] Analyzing goal with ChatGPT o-series...');

    const prompt = this.buildPrompt(goal, context);
    const openai = getOpenAI();

    try {
      const completion = await openai.chat.completions.create({
        model: ARCHITECT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = completion.choices[0]?.message?.content || '';
      return this.parseResponse(response, goal);
    } catch (error: any) {
      console.error('[ARCHITECT ERROR]', error);
      throw new Error(`Architect failed: ${error.message}`);
    }
  }

  private buildPrompt(goal: string, context?: any): string {
    return `You are an expert software architect. Analyze this goal and create a detailed build plan.

GOAL: ${goal}

${context ? `CONTEXT:\n${JSON.stringify(context, null, 2)}` : ''}

Provide:
1. Analysis of the goal
2. Architecture approach
3. Step-by-step build commands
4. Potential risks
5. Complexity estimate

Format your response as JSON.`;
  }

  private parseResponse(response: string, goal: string): ArchitectOutput {
    try {
      const parsed = JSON.parse(response);
      return {
        goal,
        analysis: parsed.analysis || '',
        architecture: parsed.architecture || '',
        commands: parsed.commands || [],
        risks: parsed.risks || [],
        estimatedComplexity: parsed.complexity || 'medium',
      };
    } catch {
      // Fallback if not JSON
      return {
        goal,
        analysis: response,
        architecture: '',
        commands: [],
        risks: [],
        estimatedComplexity: 'medium',
      };
    }
  }
}
