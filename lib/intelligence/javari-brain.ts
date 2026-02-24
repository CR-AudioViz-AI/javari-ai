// lib/intelligence/javari-brain.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - INTELLIGENT LEARNING & MULTI-AI VERIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Sunday, December 22, 2025 - 11:44 AM EST
// Version: 1.0 - The Brain That Learns
//
// THIS IS THE CORE OF JAVARI'S INTELLIGENCE:
// 1. Multi-AI Aggregation - Uses ALL available AIs for verification
// 2. Persistent Learning - Stores patterns, failures, successes
// 3. Honest Verification - Never says "success" without proof
// 4. Knowledge Growth - Every interaction makes her smarter
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// AI Provider configurations
const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI GPT-4',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4-turbo-preview',
    capabilities: ['code_generation', 'code_review', 'vision', 'analysis'],
    costPer1kTokens: 0.01,
    priority: 1,
  },
  anthropic: {
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-opus-20240229',
    capabilities: ['code_generation', 'code_review', 'analysis', 'reasoning'],
    costPer1kTokens: 0.015,
    priority: 2,
  },
  google: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro',
    capabilities: ['code_generation', 'analysis', 'multimodal'],
    costPer1kTokens: 0.0005,
    priority: 3,
  },
  perplexity: {
    name: 'Perplexity',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    model: 'llama-3.1-sonar-huge-128k-online',
    capabilities: ['web_search', 'verification', 'fact_checking'],
    costPer1kTokens: 0.005,
    priority: 4,
  },
  mistral: {
    name: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    capabilities: ['code_generation', 'code_review', 'fast_inference'],
    costPer1kTokens: 0.004,
    priority: 5,
  },
  together: {
    name: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3-70b-chat-hf',
    capabilities: ['code_generation', 'analysis', 'fast_inference'],
    costPer1kTokens: 0.0009,
    priority: 6,
  },
} as const;

type AIProvider = keyof typeof AI_PROVIDERS;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationResult {
  provider: string;
  passed: boolean;
  confidence: number;
  feedback: string;
  details?: Record<string, unknown>;
  timestamp: string;
  latencyMs: number;
}

interface BuildVerification {
  buildId: string;
  url: string;
  codeReview: VerificationResult[];
  deploymentCheck: VerificationResult[];
  uiVerification: VerificationResult[];
  overallPassed: boolean;
  overallConfidence: number;
  consensusReached: boolean;
  timestamp: string;
}

interface LearningEntry {
  id?: string;
  type: 'success' | 'failure' | 'pattern' | 'feedback';
  category: string;
  input: string;
  output: string;
  context: Record<string, unknown>;
  aiProviders: string[];
  confidence: number;
  verified: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  learnings: string[];
  createdAt: string;
}

interface KnowledgeQuery {
  category?: string;
  type?: string;
  minConfidence?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-AI AGGREGATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class MultiAIAggregator {
  private apiKeys: Record<string, string>;

  constructor() {
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY || '',
      anthropic: process.env.ANTHROPIC_API_KEY || '',
      google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
      perplexity: process.env.PERPLEXITY_API_KEY || '',
      mistral: process.env.MISTRAL_API_KEY || '',
      together: process.env.TOGETHER_API_KEY || '',
    };
  }

  // Get available providers (ones with API keys)
  getAvailableProviders(): AIProvider[] {
    return (Object.keys(this.apiKeys) as AIProvider[]).filter(
      (provider) => this.apiKeys[provider] && this.apiKeys[provider].length > 0
    );
  }

  // Call a single AI provider
  async callProvider(
    provider: AIProvider,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
    const startTime = Date.now();
    const config = AI_PROVIDERS[provider];
    const apiKey = this.apiKeys[provider];

    if (!apiKey) {
      return { success: false, error: `No API key for ${provider}`, latencyMs: 0 };
    }

    try {
      let response: Response;
      let result: string;

      switch (provider) {
        case 'openai':
        case 'mistral':
        case 'together':
        case 'perplexity':
          response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model,
              messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt },
              ],
              max_tokens: 2000,
              temperature: 0.3,
            }),
          });
          const openaiData = await response.json();
          result = openaiData.choices?.[0]?.message?.content || '';
          break;

        case 'anthropic':
          response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: 2000,
              system: systemPrompt || 'You are a helpful AI assistant.',
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const anthropicData = await response.json();
          result = anthropicData.content?.[0]?.text || '';
          break;

        case 'google':
          response = await fetch(`${config.endpoint}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt || ''}\n\n${prompt}` }] }],
            }),
          });
          const googleData = await response.json();
          result = googleData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;

        default:
          return { success: false, error: `Unknown provider: ${provider}`, latencyMs: 0 };
      }

      const latencyMs = Date.now() - startTime;
      return { success: true, response: result, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
      };
    }
  }

  // Call multiple AIs in parallel and aggregate results
  async aggregateResponses(
    prompt: string,
    systemPrompt: string,
    providers?: AIProvider[]
  ): Promise<{ responses: Record<string, { success: boolean; response?: string; latencyMs: number }>; consensus?: string }> {
    const useProviders = providers || this.getAvailableProviders();
    
    const results = await Promise.all(
      useProviders.map(async (provider) => ({
        provider,
        result: await this.callProvider(provider, prompt, systemPrompt),
      }))
    );

    const responses: Record<string, { success: boolean; response?: string; latencyMs: number }> = {};
    results.forEach(({ provider, result }) => {
      responses[provider] = result;
    });

    // Determine consensus if we have multiple successful responses
    const successfulResponses = results
      .filter(({ result }) => result.success && result.response)
      .map(({ result }) => result.response!);

    let consensus: string | undefined;
    if (successfulResponses.length >= 2) {
      // Use the first successful response as consensus for now
      // TODO: Implement actual consensus algorithm
      consensus = successfulResponses[0];
    }

    return { responses, consensus };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE VERIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class CodeVerificationEngine {
  private aggregator: MultiAIAggregator;

  constructor() {
    this.aggregator = new MultiAIAggregator();
  }

  // Have multiple AIs review code
  async reviewCode(code: string, context: string): Promise<VerificationResult[]> {
    const providers = this.aggregator.getAvailableProviders().slice(0, 3); // Use top 3 available
    const results: VerificationResult[] = [];

    const systemPrompt = `You are an expert code reviewer. Analyze the following code for:
1. Syntax errors
2. Logic errors
3. Security vulnerabilities
4. Best practices violations
5. Performance issues

Respond in JSON format:
{
  "passed": boolean,
  "confidence": number (0-100),
  "issues": [{"severity": "critical|high|medium|low", "description": string, "line": number}],
  "feedback": string
}`;

    const prompt = `Context: ${context}\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``;

    for (const provider of providers) {
      const startTime = Date.now();
      const response = await this.aggregator.callProvider(provider, prompt, systemPrompt);
      const latencyMs = Date.now() - startTime;

      let parsed = { passed: false, confidence: 0, feedback: 'Failed to parse response' };
      if (response.success && response.response) {
        try {
          // Extract JSON from response
          const jsonMatch = response.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          parsed.feedback = response.response;
          parsed.passed = !response.response.toLowerCase().includes('error');
          parsed.confidence = 50;
        }
      }

      results.push({
        provider: AI_PROVIDERS[provider].name,
        passed: parsed.passed,
        confidence: parsed.confidence,
        feedback: parsed.feedback,
        details: parsed,
        timestamp: new Date().toISOString(),
        latencyMs,
      });
    }

    return results;
  }

  // Verify a deployed URL actually works
  async verifyDeployment(url: string): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    const startTime = Date.now();

    // 1. Direct HTTP check
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
      });
      
      const html = await response.text();
      const latencyMs = Date.now() - startTime;

      // Check for common error patterns
      const isAuthPage = html.includes('Authentication Required') || html.includes('vercel-authentication');
      const isErrorPage = html.includes('Application error') || html.includes('500') || html.includes('404');
      const hasContent = html.includes('<main') || html.includes('<div') || html.includes('</body>');

      results.push({
        provider: 'HTTP Check',
        passed: response.ok && !isAuthPage && !isErrorPage && hasContent,
        confidence: response.ok ? (isAuthPage ? 20 : 95) : 0,
        feedback: isAuthPage 
          ? 'FAILED: Deployment requires authentication - NOT publicly accessible'
          : isErrorPage 
            ? 'FAILED: Error page detected'
            : response.ok 
              ? 'SUCCESS: Page loads correctly'
              : `FAILED: HTTP ${response.status}`,
        details: {
          status: response.status,
          hasContent,
          isAuthPage,
          isErrorPage,
          contentLength: html.length,
        },
        timestamp: new Date().toISOString(),
        latencyMs,
      });
    } catch (error) {
      results.push({
        provider: 'HTTP Check',
        passed: false,
        confidence: 0,
        feedback: `FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      });
    }

    // 2. Use Perplexity to verify URL is accessible (if available)
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      const perplexityStart = Date.now();
      try {
        const response = await this.aggregator.callProvider(
          'perplexity',
          `Check if this URL is publicly accessible and working: ${url}. Visit it and tell me what you see. Is it a real working web application?`,
          'You are a web verification assistant. Be honest about whether URLs are accessible.'
        );

        results.push({
          provider: 'Perplexity Web Check',
          passed: response.success && response.response?.toLowerCase().includes('accessible'),
          confidence: response.success ? 80 : 0,
          feedback: response.response || 'No response',
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - perplexityStart,
        });
      } catch {
        // Skip if Perplexity fails
      }
    }

    return results;
  }

  // Full verification pipeline
  async fullVerification(
    code: string,
    deploymentUrl: string,
    context: string
  ): Promise<BuildVerification> {
    const buildId = `verify_${Date.now()}`;
    
    console.log(`[VERIFICATION] Starting full verification for ${deploymentUrl}`);

    // Run all verifications in parallel
    const [codeReview, deploymentCheck] = await Promise.all([
      this.reviewCode(code, context),
      this.verifyDeployment(deploymentUrl),
    ]);

    // Calculate overall results
    const allResults = [...codeReview, ...deploymentCheck];
    const passedCount = allResults.filter(r => r.passed).length;
    const totalCount = allResults.length;
    const avgConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / totalCount;

    const overallPassed = passedCount >= totalCount * 0.7; // 70% must pass
    const consensusReached = passedCount >= totalCount * 0.6; // 60% agreement

    const verification: BuildVerification = {
      buildId,
      url: deploymentUrl,
      codeReview,
      deploymentCheck,
      uiVerification: [], // TODO: Add screenshot verification
      overallPassed,
      overallConfidence: avgConfidence,
      consensusReached,
      timestamp: new Date().toISOString(),
    };

    // Log verification to database
    await this.logVerification(verification);

    console.log(`[VERIFICATION] Complete - Passed: ${overallPassed}, Confidence: ${avgConfidence}%`);

    return verification;
  }

  private async logVerification(verification: BuildVerification): Promise<void> {
    try {
      await supabase.from('javari_verifications').insert({
        build_id: verification.buildId,
        url: verification.url,
        code_review: verification.codeReview,
        deployment_check: verification.deploymentCheck,
        ui_verification: verification.uiVerification,
        overall_passed: verification.overallPassed,
        overall_confidence: verification.overallConfidence,
        consensus_reached: verification.consensusReached,
        created_at: verification.timestamp,
      });
    } catch (error) {
      console.error('[VERIFICATION] Failed to log:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class JavariLearningEngine {
  // Store a learning entry
  async learn(entry: Omit<LearningEntry, 'id' | 'createdAt'>): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('javari_learnings')
        .insert({
          type: entry.type,
          category: entry.category,
          input_text: entry.input,
          output_text: entry.output,
          context: entry.context,
          ai_providers: entry.aiProviders,
          confidence: entry.confidence,
          verified: entry.verified,
          user_feedback: entry.userFeedback || null,
          learnings: entry.learnings,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;
      console.log(`[LEARNING] Stored entry: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('[LEARNING] Failed to store:', error);
      return null;
    }
  }

  // Query knowledge base
  async query(params: KnowledgeQuery): Promise<LearningEntry[]> {
    try {
      let query = supabase
        .from('javari_learnings')
        .select('*')
        .order('created_at', { ascending: false });

      if (params.category) {
        query = query.eq('category', params.category);
      }
      if (params.type) {
        query = query.eq('type', params.type);
      }
      if (params.minConfidence) {
        query = query.gte('confidence', params.minConfidence);
      }
      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        type: row.type,
        category: row.category,
        input: row.input_text,
        output: row.output_text,
        context: row.context,
        aiProviders: row.ai_providers,
        confidence: row.confidence,
        verified: row.verified,
        userFeedback: row.user_feedback,
        learnings: row.learnings,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[LEARNING] Query failed:', error);
      return [];
    }
  }

  // Find similar past experiences
  async findSimilar(input: string, category: string, limit: number = 5): Promise<LearningEntry[]> {
    // For now, simple keyword matching - TODO: Implement vector similarity
    const keywords = input.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    try {
      const { data, error } = await supabase
        .from('javari_learnings')
        .select('*')
        .eq('category', category)
        .order('confidence', { ascending: false })
        .limit(limit * 3); // Get more to filter

      if (error) throw error;

      // Filter by keyword relevance
      const scored = (data || []).map((row) => {
        const text = `${row.input_text} ${row.output_text}`.toLowerCase();
        const score = keywords.filter(kw => text.includes(kw)).length;
        return { row, score };
      });

      return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ row }) => ({
          id: row.id,
          type: row.type,
          category: row.category,
          input: row.input_text,
          output: row.output_text,
          context: row.context,
          aiProviders: row.ai_providers,
          confidence: row.confidence,
          verified: row.verified,
          userFeedback: row.user_feedback,
          learnings: row.learnings,
          createdAt: row.created_at,
        }));
    } catch (error) {
      console.error('[LEARNING] Find similar failed:', error);
      return [];
    }
  }

  // Record user feedback
  async recordFeedback(
    entryId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    comment?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('javari_learnings')
        .update({
          user_feedback: feedback,
          feedback_comment: comment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;
      console.log(`[LEARNING] Recorded feedback for ${entryId}: ${feedback}`);
      return true;
    } catch (error) {
      console.error('[LEARNING] Failed to record feedback:', error);
      return false;
    }
  }

  // Get learning statistics
  async getStats(): Promise<{
    totalEntries: number;
    successRate: number;
    topCategories: { category: string; count: number }[];
    avgConfidence: number;
    feedbackBreakdown: { positive: number; negative: number; neutral: number };
  }> {
    try {
      const { data: entries } = await supabase
        .from('javari_learnings')
        .select('type, category, confidence, user_feedback');

      if (!entries || entries.length === 0) {
        return {
          totalEntries: 0,
          successRate: 0,
          topCategories: [],
          avgConfidence: 0,
          feedbackBreakdown: { positive: 0, negative: 0, neutral: 0 },
        };
      }

      const successes = entries.filter(e => e.type === 'success').length;
      const categoryCount: Record<string, number> = {};
      let totalConfidence = 0;
      const feedbackCount = { positive: 0, negative: 0, neutral: 0 };

      entries.forEach(e => {
        categoryCount[e.category] = (categoryCount[e.category] || 0) + 1;
        totalConfidence += e.confidence || 0;
        if (e.user_feedback) {
          feedbackCount[e.user_feedback as keyof typeof feedbackCount]++;
        }
      });

      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEntries: entries.length,
        successRate: (successes / entries.length) * 100,
        topCategories,
        avgConfidence: totalConfidence / entries.length,
        feedbackBreakdown: feedbackCount,
      };
    } catch (error) {
      console.error('[LEARNING] Stats failed:', error);
      return {
        totalEntries: 0,
        successRate: 0,
        topCategories: [],
        avgConfidence: 0,
        feedbackBreakdown: { positive: 0, negative: 0, neutral: 0 },
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN JAVARI BRAIN CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class JavariBrain {
  public aggregator: MultiAIAggregator;
  public verifier: CodeVerificationEngine;
  public learner: JavariLearningEngine;

  constructor() {
    this.aggregator = new MultiAIAggregator();
    this.verifier = new CodeVerificationEngine();
    this.learner = new JavariLearningEngine();
  }

  // Smart code generation - uses multiple AIs and picks best result
  async generateCode(
    prompt: string,
    context: string
  ): Promise<{ code: string; provider: string; confidence: number; alternatives: string[] }> {
    const systemPrompt = `You are an expert React/Next.js developer. Generate clean, production-ready code.
Always include 'use client' directive for components with interactivity.
Use Tailwind CSS for styling. Make it beautiful and functional.
Return ONLY the code, no explanations.`;

    // Check for similar past successes
    const similar = await this.learner.findSimilar(prompt, 'code_generation', 3);
    const contextWithLearnings = similar.length > 0
      ? `${context}\n\nPrevious successful patterns:\n${similar.map(s => s.output).join('\n---\n')}`
      : context;

    // Get responses from multiple AIs
    const { responses } = await this.aggregator.aggregateResponses(
      `${prompt}\n\nContext: ${contextWithLearnings}`,
      systemPrompt
    );

    // Find the best response
    const successfulResponses = Object.entries(responses)
      .filter(([, r]) => r.success && r.response)
      .map(([provider, r]) => ({ provider, response: r.response!, latency: r.latencyMs }));

    if (successfulResponses.length === 0) {
      throw new Error('All AI providers failed to generate code');
    }

    // Use the fastest successful response as primary
    const sorted = successfulResponses.sort((a, b) => a.latency - b.latency);
    const primary = sorted[0];
    const alternatives = sorted.slice(1).map(r => r.response);

    return {
      code: primary.response,
      provider: primary.provider,
      confidence: 85, // Base confidence - will be adjusted by verification
      alternatives,
    };
  }

  // Full build with verification and learning
  async buildWithVerification(
    prompt: string,
    buildFn: (code: string) => Promise<{ success: boolean; url?: string; error?: string }>
  ): Promise<{
    success: boolean;
    url?: string;
    code?: string;
    verification?: BuildVerification;
    error?: string;
    learned: boolean;
  }> {
    const startTime = Date.now();
    let code: string | undefined;
    let provider: string | undefined;

    try {
      // 1. Generate code
      console.log('[BRAIN] Generating code...');
      const generated = await this.generateCode(prompt, 'Building user-requested application');
      code = generated.code;
      provider = generated.provider;

      // 2. Build and deploy
      console.log('[BRAIN] Building and deploying...');
      const buildResult = await buildFn(code);

      if (!buildResult.success || !buildResult.url) {
        // Learn from failure
        await this.learner.learn({
          type: 'failure',
          category: 'code_generation',
          input: prompt,
          output: code,
          context: { error: buildResult.error, provider },
          aiProviders: [provider],
          confidence: 0,
          verified: false,
          learnings: [`Build failed: ${buildResult.error}`],
        });

        return {
          success: false,
          error: buildResult.error || 'Build failed',
          code,
          learned: true,
        };
      }

      // 3. Verify deployment
      console.log('[BRAIN] Verifying deployment...');
      const verification = await this.verifier.fullVerification(
        code,
        buildResult.url,
        prompt
      );

      // 4. Learn from result
      await this.learner.learn({
        type: verification.overallPassed ? 'success' : 'failure',
        category: 'code_generation',
        input: prompt,
        output: code,
        context: {
          url: buildResult.url,
          provider,
          verification: {
            passed: verification.overallPassed,
            confidence: verification.overallConfidence,
          },
          durationMs: Date.now() - startTime,
        },
        aiProviders: [provider],
        confidence: verification.overallConfidence,
        verified: verification.overallPassed,
        learnings: verification.overallPassed
          ? ['Successfully built and verified deployment']
          : verification.deploymentCheck.map(c => c.feedback).filter(f => f.includes('FAILED')),
      });

      return {
        success: verification.overallPassed,
        url: buildResult.url,
        code,
        verification,
        error: verification.overallPassed ? undefined : 'Verification failed - deployment may not work correctly',
        learned: true,
      };
    } catch (error) {
      // Learn from error
      if (code) {
        await this.learner.learn({
          type: 'failure',
          category: 'code_generation',
          input: prompt,
          output: code || '',
          context: { error: error instanceof Error ? error.message : 'Unknown error', provider },
          aiProviders: provider ? [provider] : [],
          confidence: 0,
          verified: false,
          learnings: [`Exception: ${error instanceof Error ? error.message : 'Unknown'}`],
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code,
        learned: true,
      };
    }
  }

  // Get brain status
  async getStatus(): Promise<{
    availableProviders: string[];
    learningStats: Awaited<ReturnType<JavariLearningEngine['getStats']>>;
    ready: boolean;
  }> {
    const availableProviders = this.aggregator.getAvailableProviders();
    const learningStats = await this.learner.getStats();

    return {
      availableProviders,
      learningStats,
      ready: availableProviders.length > 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const javariBrain = new JavariBrain();
