/**
 * ARCHITECT GATEWAY - ChatGPT o-series (o1/o3)
 * 
 * Analyzes goals and creates detailed build plans
 * Uses OpenAI's reasoning models for system design
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Use o1-preview (or o3-mini when available)
const ARCHITECT_MODEL = 'o1-preview';

export interface BuildCommand {
  id: string;
  type: 'create_file' | 'modify_file' | 'delete_file' | 'run_command';
  target: string;
  content?: string;
  description: string;
  dependencies?: string[];
}

export interface ArchitectOutput {
  reasoning: string;
  buildPlan: string;
  buildCommands: BuildCommand[];
  estimatedDuration: number;
  risks: string[];
  contextForJavari: {
    designPatterns: string[];
    technicalDecisions: Record<string, string>;
    learningOpportunities: string[];
  };
}

/**
 * Architect Gateway - Uses ChatGPT for high-level design
 */
export class ArchitectGateway {
  
  /**
   * Design solution from goal
   */
  async design(goal: string, context?: any): Promise<ArchitectOutput> {
    console.log('[ARCHITECT] Analyzing goal with ChatGPT o-series...');

    const prompt = this.buildPrompt(goal, context);

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

      const response = completion.choices[0].message.content!;
      
      return this.parseResponse(response);

    } catch (error: any) {
      console.error('[ARCHITECT] OpenAI error:', error);
      throw new Error(`Architect failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for architect
   */
  private buildPrompt(goal: string, context?: any): string {
    return `You are the ARCHITECT in a multi-AI system. Your job is to analyze the user's goal and create a detailed build plan.

USER GOAL:
${goal}

${context ? `CONTEXT:
${JSON.stringify(context, null, 2)}
` : ''}

Your response MUST be valid JSON in this EXACT format:
{
  "reasoning": "Your step-by-step reasoning process",
  "buildPlan": "High-level description of the solution",
  "buildCommands": [
    {
      "id": "cmd_1",
      "type": "create_file",
      "target": "path/to/file.ts",
      "content": "Full file content here",
      "description": "What this file does",
      "dependencies": []
    }
  ],
  "estimatedDuration": 300,
  "risks": ["Potential risk 1", "Potential risk 2"],
  "contextForJavari": {
    "designPatterns": ["pattern1", "pattern2"],
    "technicalDecisions": {
      "decision1": "rationale1"
    },
    "learningOpportunities": ["learning1"]
  }
}

COMMAND TYPES:
- create_file: Create new file with content
- modify_file: Modify existing file (include full new content)
- delete_file: Delete file
- run_command: Execute shell command

RULES:
1. Break complex goals into atomic file operations
2. Order commands by dependency (foundational files first)
3. Include COMPLETE file contents (no placeholders)
4. Use TypeScript for code files
5. Follow existing project structure
6. Each command must be independently executable
7. Output ONLY the JSON, no markdown, no explanations

Begin:`;
  }

  /**
   * Parse architect response
   */
  private parseResponse(response: string): ArchitectOutput {
    try {
      // Clean response
      let cleaned = response.trim();
      
      // Remove markdown code blocks if present
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n/g, '').replace(/\n```/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n/g, '').replace(/\n```/g, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.buildPlan || !parsed.buildCommands || !Array.isArray(parsed.buildCommands)) {
        throw new Error('Invalid response structure from architect');
      }

      // Validate each command
      for (const cmd of parsed.buildCommands) {
        if (!cmd.id || !cmd.type || !cmd.target || !cmd.description) {
          throw new Error(`Invalid build command: ${JSON.stringify(cmd)}`);
        }

        if (!['create_file', 'modify_file', 'delete_file', 'run_command'].includes(cmd.type)) {
          throw new Error(`Invalid command type: ${cmd.type}`);
        }

        if ((cmd.type === 'create_file' || cmd.type === 'modify_file') && !cmd.content) {
          throw new Error(`Command ${cmd.id} requires content`);
        }
      }

      return {
        reasoning: parsed.reasoning || 'No reasoning provided',
        buildPlan: parsed.buildPlan,
        buildCommands: parsed.buildCommands,
        estimatedDuration: parsed.estimatedDuration || 60,
        risks: parsed.risks || [],
        contextForJavari: parsed.contextForJavari || {
          designPatterns: [],
          technicalDecisions: {},
          learningOpportunities: [],
        },
      };

    } catch (error: any) {
      console.error('[ARCHITECT] Parse error:', error);
      console.error('[ARCHITECT] Raw response:', response.substring(0, 500));
      throw new Error(`Failed to parse architect response: ${error.message}`);
    }
  }
}

export default ArchitectGateway;
