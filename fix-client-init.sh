#!/bin/bash
# fix-client-init.sh
# Systematic fix for all module-level AI client initializations
# Roy Henderson - CR AudioViz AI
# 2026-02-24 03:30 AM ET

set -e

echo "════════════════════════════════════════════════════════════════"
echo "JAVARI AI - MODULE-LEVEL CLIENT INITIALIZATION FIX"
echo "════════════════════════════════════════════════════════════════"
echo ""

FIXED_COUNT=0

# Fix chamber/architectGateway.ts
echo "[1/3] Fixing chamber/architectGateway.ts..."
cat > chamber/architectGateway.ts << 'EOF'
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
EOF
((FIXED_COUNT++))
echo "✓ Fixed chamber/architectGateway.ts"

# Fix chamber/observer.ts  
echo "[2/3] Fixing chamber/observer.ts..."
cat > chamber/observer.ts << 'EOF'
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

function getAnthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });
}

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface LearningEvent {
  sessionId: string;
  goal: string;
  architectOutput: ArchitectOutput;
  buildResult: BuildResult;
  success: boolean;
  timestamp: Date;
}

export class LearningObserver {
  /**
   * Observe and learn from chamber execution
   */
  async observe(event: LearningEvent): Promise<void> {
    console.log('[OBSERVER] Learning from session:', event.sessionId);

    try {
      // Extract patterns
      const patterns = await this.extractPatterns(event);
      
      // Generate embedding
      const embeddingId = await this.generateEmbedding(
        event.sessionId,
        JSON.stringify(patterns)
      );

      // Store in database
      await this.storeObservation(event, patterns, embeddingId);

      console.log('[OBSERVER] Learning complete');
    } catch (error) {
      console.error('[OBSERVER ERROR]', error);
      // Non-fatal - don't block chamber execution
    }
  }

  private async extractPatterns(event: LearningEvent): Promise<any> {
    // Pattern extraction logic
    return {
      goal_type: this.classifyGoal(event.goal),
      commands_used: event.architectOutput.commands.map(c => c.type),
      success: event.success,
      complexity: event.architectOutput.estimatedComplexity,
    };
  }

  private classifyGoal(goal: string): string {
    // Simple classification
    if (goal.includes('create') || goal.includes('build')) return 'creation';
    if (goal.includes('fix') || goal.includes('debug')) return 'repair';
    if (goal.includes('analyze') || goal.includes('explain')) return 'analysis';
    return 'other';
  }

  private async generateEmbedding(
    sessionId: string,
    transcript: string
  ): Promise<string> {
    try {
      const openai = getOpenAI();
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
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('[EMBEDDING ERROR]', error);
      return '';
    }
  }

  private async storeObservation(
    event: LearningEvent,
    patterns: any,
    embeddingId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('chamber_observations')
      .insert({
        session_id: event.sessionId,
        goal: event.goal,
        patterns,
        embedding_id: embeddingId,
        success: event.success,
        created_at: event.timestamp.toISOString(),
      });

    if (error) {
      console.error('[STORAGE ERROR]', error);
    }
  }
}
EOF
((FIXED_COUNT++))
echo "✓ Fixed chamber/observer.ts"

# Fix chamber/claudeBuilder.ts
echo "[3/3] Fixing chamber/claudeBuilder.ts..."
sed -i 's/^const anthropic = new Anthropic/function getAnthropic() { return new Anthropic/' chamber/claudeBuilder.ts
sed -i 's/apiKey: process\.env\.ANTHROPIC_API_KEY!/apiKey: process.env.ANTHROPIC_API_KEY || '\'\'' }); }/' chamber/claudeBuilder.ts
# Add call to getAnthropic where used
sed -i '/async build(/a\    const anthropic = getAnthropic();' chamber/claudeBuilder.ts
((FIXED_COUNT++))
echo "✓ Fixed chamber/claudeBuilder.ts"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✓ FIXED $FIXED_COUNT FILES"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next: Run build test"
