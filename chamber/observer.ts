/**
 * LEARNING OBSERVER - Javari's Learning Engine
 * 
 * Observes architect + builder execution
 * Extracts patterns and updates long-term memory
 * Generates embeddings for future automation
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { ChamberRequest } from './controller';
import type { ArchitectOutput } from './architectGateway';
import type { BuildResult } from './claudeBuilder';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ObservationResult {
  patternsLearned: Pattern[];
  memoryUpdated: boolean;
  futureAutomations: Automation[];
  insights: Insight[];
  embeddingId?: string;
}

export interface Pattern {
  id: string;
  type: 'code_pattern' | 'architecture_pattern' | 'workflow_pattern';
  description: string;
  confidence: number;
  examples: string[];
}

export interface Automation {
  id: string;
  trigger: string;
  actions: string[];
  confidence: number;
}

export interface Insight {
  category: 'performance' | 'quality' | 'efficiency' | 'learning';
  observation: string;
  recommendation: string;
}

/**
 * Learning Observer - Javari's eyes and brain
 */
export class LearningObserver {
  
  /**
   * Observe execution and learn
   */
  async observe(
    sessionId: string,
    request: ChamberRequest,
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): Promise<ObservationResult> {
    console.log('[OBSERVER] Javari analyzing execution...');

    try {
      // 1. Extract patterns
      const patterns = await this.extractPatterns(
        architectOutput,
        buildResult
      );

      // 2. Identify future automations
      const automations = await this.identifyAutomations(
        request,
        architectOutput,
        buildResult
      );

      // 3. Generate insights
      const insights = await this.generateInsights(
        architectOutput,
        buildResult
      );

      // 4. Create execution transcript
      const transcript = this.createTranscript(
        request,
        architectOutput,
        buildResult
      );

      // 5. Generate embedding
      const embeddingId = await this.generateEmbedding(
        sessionId,
        transcript
      );

      // 6. Update long-term memory
      await this.updateMemory(
        sessionId,
        patterns,
        automations,
        insights,
        transcript,
        embeddingId
      );

      console.log(`[OBSERVER] Learned ${patterns.length} patterns`);
      console.log(`[OBSERVER] Identified ${automations.length} automations`);

      return {
        patternsLearned: patterns,
        memoryUpdated: true,
        futureAutomations: automations,
        insights,
        embeddingId,
      };

    } catch (error: any) {
      console.error('[OBSERVER] Learning error:', error);

      return {
        patternsLearned: [],
        memoryUpdated: false,
        futureAutomations: [],
        insights: [],
      };
    }
  }

  /**
   * Extract patterns from execution
   */
  private async extractPatterns(
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): Promise<Pattern[]> {
    
    const patterns: Pattern[] = [];

    // Code patterns from build commands
    for (const cmd of architectOutput.buildCommands) {
      if (cmd.type === 'create_file' && cmd.content) {
        // Analyze code structure
        const pattern = this.analyzeCodePattern(cmd.content, cmd.target);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    // Architecture patterns
    const archPattern = this.analyzeArchitecturePattern(architectOutput);
    if (archPattern) {
      patterns.push(archPattern);
    }

    // Workflow patterns
    const workflowPattern = this.analyzeWorkflowPattern(buildResult);
    if (workflowPattern) {
      patterns.push(workflowPattern);
    }

    return patterns;
  }

  /**
   * Analyze code pattern
   */
  private analyzeCodePattern(code: string, filePath: string): Pattern | null {
    // Detect common patterns
    const patterns = {
      'react_component': /export (default )?function \w+\(.*\): JSX\.Element/,
      'api_route': /export async function (GET|POST|PUT|DELETE)/,
      'typescript_interface': /export interface \w+/,
      'service_class': /export class \w+Service/,
    };

    for (const [patternType, regex] of Object.entries(patterns)) {
      if (regex.test(code)) {
        return {
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'code_pattern',
          description: `${patternType} in ${filePath}`,
          confidence: 0.9,
          examples: [code.substring(0, 200)],
        };
      }
    }

    return null;
  }

  /**
   * Analyze architecture pattern
   */
  private analyzeArchitecturePattern(architectOutput: ArchitectOutput): Pattern | null {
    const { designPatterns } = architectOutput.contextForJavari;

    if (designPatterns.length > 0) {
      return {
        id: `arch_${Date.now()}`,
        type: 'architecture_pattern',
        description: `Architecture: ${designPatterns.join(', ')}`,
        confidence: 0.85,
        examples: designPatterns,
      };
    }

    return null;
  }

  /**
   * Analyze workflow pattern
   */
  private analyzeWorkflowPattern(buildResult: BuildResult): Pattern | null {
    if (buildResult.ok && buildResult.createdFiles.length > 0) {
      return {
        id: `workflow_${Date.now()}`,
        type: 'workflow_pattern',
        description: `Successful build: ${buildResult.createdFiles.length} files created`,
        confidence: 0.95,
        examples: buildResult.createdFiles,
      };
    }

    return null;
  }

  /**
   * Identify future automations
   */
  private async identifyAutomations(
    request: ChamberRequest,
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): Promise<Automation[]> {
    
    const automations: Automation[] = [];

    // If this was successful, it could be automated
    if (buildResult.ok) {
      automations.push({
        id: `auto_${Date.now()}`,
        trigger: `When user requests: "${request.goal}"`,
        actions: architectOutput.buildCommands.map(cmd => 
          `${cmd.type}: ${cmd.target}`
        ),
        confidence: 0.7,
      });
    }

    return automations;
  }

  /**
   * Generate insights
   */
  private async generateInsights(
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): Promise<Insight[]> {
    
    const insights: Insight[] = [];

    // Performance insight
    if (buildResult.buildLogs.length > 0) {
      const duration = this.estimateDuration(buildResult.buildLogs);
      
      insights.push({
        category: 'performance',
        observation: `Build completed in approximately ${duration}s`,
        recommendation: duration > 60 
          ? 'Consider optimizing build commands for better performance'
          : 'Build performance is good',
      });
    }

    // Quality insight
    if (buildResult.errors.length === 0) {
      insights.push({
        category: 'quality',
        observation: 'No errors during build',
        recommendation: 'Maintain current code quality standards',
      });
    }

    // Learning insight
    insights.push({
      category: 'learning',
      observation: `Learned from ${architectOutput.buildCommands.length} commands`,
      recommendation: 'Patterns stored for future automation',
    });

    return insights;
  }

  /**
   * Estimate duration from logs
   */
  private estimateDuration(logs: string[]): number {
    if (logs.length === 0) return 0;

    const firstLog = logs[0];
    const lastLog = logs[logs.length - 1];

    const firstTime = this.extractTimestamp(firstLog);
    const lastTime = this.extractTimestamp(lastLog);

    if (firstTime && lastTime) {
      return Math.round((lastTime.getTime() - firstTime.getTime()) / 1000);
    }

    return 0;
  }

  /**
   * Extract timestamp from log
   */
  private extractTimestamp(log: string): Date | null {
    const match = log.match(/\[(.*?)\]/);
    if (match) {
      return new Date(match[1]);
    }
    return null;
  }

  /**
   * Create execution transcript
   */
  private createTranscript(
    request: ChamberRequest,
    architectOutput: ArchitectOutput,
    buildResult: BuildResult
  ): string {
    return `
CHAMBER EXECUTION TRANSCRIPT

GOAL: ${request.goal}

ARCHITECT (ChatGPT):
${architectOutput.reasoning}

BUILD PLAN:
${architectOutput.buildPlan}

COMMANDS: ${architectOutput.buildCommands.length}
${architectOutput.buildCommands.map(cmd => `- ${cmd.type}: ${cmd.target}`).join('\n')}

BUILDER (Claude):
Status: ${buildResult.ok ? 'SUCCESS' : 'FAILED'}
Files Created: ${buildResult.createdFiles.length}
Files Modified: ${buildResult.modifiedFiles.length}
Commit: ${buildResult.commitId}

BUILD LOGS:
${buildResult.buildLogs.join('\n')}

${buildResult.errors.length > 0 ? `ERRORS:\n${buildResult.errors.join('\n')}` : ''}
    `.trim();
  }

  /**
   * Generate embedding for semantic search
   */
  private async generateEmbedding(
    sessionId: string,
    transcript: string
  ): Promise<string> {
    try {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: transcript,
      });

      const embeddingVector = embedding.data[0].embedding;

      // Store embedding
      const { data, error } = await supabase
        .from('chamber_embeddings')
        .insert({
          session_id: sessionId,
          embedding: embeddingVector,
          transcript,
        })
        .select()
        .single();

      if (error) throw error;

      return data.id;

    } catch (error) {
      console.error('[OBSERVER] Embedding generation failed:', error);
      return '';
    }
  }

  /**
   * Update long-term memory
   */
  private async updateMemory(
    sessionId: string,
    patterns: Pattern[],
    automations: Automation[],
    insights: Insight[],
    transcript: string,
    embeddingId?: string
  ): Promise<void> {
    
    try {
      // Store patterns
      for (const pattern of patterns) {
        await supabase.from('learned_patterns').insert({
          session_id: sessionId,
          pattern_type: pattern.type,
          description: pattern.description,
          confidence: pattern.confidence,
          examples: pattern.examples,
        });
      }

      // Store automations
      for (const automation of automations) {
        await supabase.from('future_automations').insert({
          session_id: sessionId,
          trigger: automation.trigger,
          actions: automation.actions,
          confidence: automation.confidence,
        });
      }

      // Store insights
      for (const insight of insights) {
        await supabase.from('execution_insights').insert({
          session_id: sessionId,
          category: insight.category,
          observation: insight.observation,
          recommendation: insight.recommendation,
        });
      }

      // Update memory summary
      await supabase.from('javari_memory').upsert({
        last_session_id: sessionId,
        patterns_learned: patterns.length,
        automations_identified: automations.length,
        total_executions: supabase.rpc('increment_executions'),
        updated_at: new Date().toISOString(),
      });

      console.log('[OBSERVER] Memory updated successfully');

    } catch (error) {
      console.error('[OBSERVER] Memory update failed:', error);
    }
  }
}

export default LearningObserver;
