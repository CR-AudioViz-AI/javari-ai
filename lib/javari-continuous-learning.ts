// lib/javari-continuous-learning.ts
// Non-stop autonomous learning from every interaction
// Timestamp: 2025-11-30 04:10 AM EST

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// LEARN FROM CONVERSATIONS
// =====================================================

export interface ConversationLearning {
  conversationId: string;
  userMessage: string;
  assistantResponse: string;
  wasHelpful?: boolean;
  solutionWorked?: boolean;
  userId?: string;
}

/**
 * Extract learnings from a conversation exchange
 */
export async function learnFromConversation(input: ConversationLearning): Promise<{
  success: boolean;
  insightId?: string;
  knowledgeId?: string;
}> {
  try {
    // Don't learn from trivial exchanges
    if (input.userMessage.length < 30 || input.assistantResponse.length < 100) {
      return { success: true }; // Skip but don't fail
    }

    // Analyze the exchange
    const analysis = analyzeExchange(input.userMessage, input.assistantResponse);
    
    if (!analysis.isLearnable) {
      return { success: true }; // Skip but don't fail
    }

    // Store the insight
    const { data: insight, error: insightError } = await supabase
      .from('conversation_insights')
      .insert({
        conversation_id: input.conversationId,
        user_id: input.userId,
        topic: analysis.topic,
        subtopic: analysis.subtopic,
        insight_type: analysis.insightType,
        problem_description: analysis.problem,
        solution_description: analysis.solution,
        code_snippet: analysis.codeSnippet,
        was_helpful: input.wasHelpful,
        confidence_score: analysis.confidence,
        keywords: analysis.keywords
      })
      .select('id')
      .single();

    if (insightError) {
      console.error('Error storing insight:', insightError);
      return { success: false };
    }

    // If this is a high-quality solution, cache it
    if (analysis.confidence > 0.7 && analysis.problem && analysis.solution) {
      await cacheSolution(analysis.problem, analysis.solution, analysis.codeSnippet);
    }

    // Check for error patterns
    if (analysis.errorPattern) {
      await recordErrorPattern(analysis.errorPattern, analysis.solution);
    }

    return { success: true, insightId: insight?.id };
  } catch (error) {
    console.error('Learning error:', error);
    return { success: false };
  }
}

// =====================================================
// ANALYZE CONVERSATION EXCHANGE
// =====================================================

interface ExchangeAnalysis {
  isLearnable: boolean;
  topic: string;
  subtopic?: string;
  insightType: string;
  problem?: string;
  solution?: string;
  codeSnippet?: string;
  errorPattern?: string;
  keywords: string[];
  confidence: number;
}

function analyzeExchange(userMessage: string, assistantResponse: string): ExchangeAnalysis {
  const result: ExchangeAnalysis = {
    isLearnable: false,
    topic: 'General',
    insightType: 'knowledge_gap',
    keywords: [],
    confidence: 0.5
  };

  const messageLower = userMessage.toLowerCase();
  const responseLower = assistantResponse.toLowerCase();

  // Detect topic
  const topicPatterns: [RegExp, string, string?][] = [
    [/typescript|tsx?|type\s+error/i, 'Development', 'TypeScript'],
    [/react|component|hook|useState|useEffect/i, 'Development', 'React'],
    [/next\.?js|app\s+router|page\.tsx/i, 'Development', 'Next.js'],
    [/supabase|postgres|database|sql|rls/i, 'Infrastructure', 'Supabase'],
    [/stripe|payment|invoice|subscription/i, 'Payments', 'Stripe'],
    [/paypal/i, 'Payments', 'PayPal'],
    [/vercel|deploy|build\s+error/i, 'Infrastructure', 'Vercel'],
    [/github|git|commit|push|repo/i, 'Infrastructure', 'GitHub'],
    [/api|endpoint|fetch|request/i, 'Development', 'API'],
    [/css|tailwind|style|layout/i, 'Development', 'Styling'],
    [/real\s*estate|property|listing/i, 'Real Estate', 'General'],
    [/error|bug|fix|broken|not\s+working/i, 'Troubleshooting', 'Error Resolution'],
  ];

  for (const [pattern, topic, subtopic] of topicPatterns) {
    if (pattern.test(userMessage)) {
      result.topic = topic;
      result.subtopic = subtopic;
      break;
    }
  }

  // Detect insight type
  if (/error|exception|failed|cannot|unable/i.test(messageLower)) {
    result.insightType = 'error_pattern';
    result.isLearnable = true;
    result.confidence = 0.7;
    
    // Try to extract error message
    const errorMatch = userMessage.match(/error[:\s]+(.+?)(?:\n|$)/i) ||
                       userMessage.match(/cannot\s+(.+?)(?:\n|$)/i);
    if (errorMatch) {
      result.errorPattern = errorMatch[1].trim();
    }
  } else if (/how\s+(?:do|can|to)|what\s+is|explain/i.test(messageLower)) {
    result.insightType = 'problem_solution';
    result.isLearnable = true;
    result.confidence = 0.6;
  } else if (/prefer|always|never|i\s+like|i\s+want/i.test(messageLower)) {
    result.insightType = 'user_preference';
    result.isLearnable = true;
    result.confidence = 0.8;
  }

  // Extract problem/solution
  if (result.isLearnable) {
    // Problem is usually in the user message
    result.problem = extractProblemStatement(userMessage);
    
    // Solution is in the assistant response
    result.solution = extractSolutionSummary(assistantResponse);
    
    // Extract code if present
    const codeMatch = assistantResponse.match(/```(?:\w+)?\n([\s\S]+?)```/);
    if (codeMatch) {
      result.codeSnippet = codeMatch[1].trim();
      result.confidence += 0.1;
    }
  }

  // Extract keywords
  result.keywords = extractKeywords(userMessage + ' ' + assistantResponse);

  return result;
}

function extractProblemStatement(message: string): string {
  // Try to get the core problem
  const lines = message.split('\n').filter(l => l.trim().length > 0);
  
  // First line is often the problem
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 20 && firstLine.length < 200) {
      return firstLine;
    }
  }
  
  // Return truncated message
  return message.substring(0, 200).trim();
}

function extractSolutionSummary(response: string): string {
  // Try to find a summary line
  const lines = response.split('\n').filter(l => l.trim().length > 0);
  
  // Skip code blocks, find explanation
  const nonCodeLines = lines.filter(l => !l.startsWith('```') && !l.startsWith('  ') && !l.startsWith('\t'));
  
  if (nonCodeLines.length > 0) {
    // First non-code line is often the solution
    return nonCodeLines[0].substring(0, 500).trim();
  }
  
  return response.substring(0, 500).trim();
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'which', 'would', 'could', 'should', 'there', 'their', 'they', 'them', 'then', 'than', 'these', 'those', 'your', 'here', 'just', 'like', 'some', 'want', 'need', 'help', 'please'].includes(w));
  
  // Count frequency and return top keywords
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// =====================================================
// SOLUTION CACHE
// =====================================================

async function cacheSolution(problem: string, solution: string, code?: string): Promise<void> {
  const problemHash = crypto.createHash('md5').update(problem.toLowerCase().trim()).digest('hex');
  const keywords = extractKeywords(problem);

  await supabase
    .from('solution_cache')
    .upsert({
      problem_hash: problemHash,
      problem_description: problem,
      problem_keywords: keywords,
      solution_description: solution,
      solution_code: code,
      last_used_at: new Date().toISOString()
    }, {
      onConflict: 'problem_hash'
    });
}

/**
 * Find cached solution for a problem
 */
export async function findCachedSolution(problem: string): Promise<{
  found: boolean;
  solution?: string;
  code?: string;
  confidence?: number;
}> {
  const problemHash = crypto.createHash('md5').update(problem.toLowerCase().trim()).digest('hex');
  
  // Try exact match first
  const { data: exact } = await supabase
    .from('solution_cache')
    .select('solution_description, solution_code, success_rate')
    .eq('problem_hash', problemHash)
    .single();

  if (exact && exact.success_rate > 0.5) {
    return {
      found: true,
      solution: exact.solution_description,
      code: exact.solution_code,
      confidence: exact.success_rate
    };
  }

  // Try keyword match
  const keywords = extractKeywords(problem);
  const { data: similar } = await supabase
    .from('solution_cache')
    .select('solution_description, solution_code, success_rate, problem_keywords')
    .gt('success_rate', 0.6)
    .limit(10);

  if (similar) {
    // Score by keyword overlap
    let bestMatch = null;
    let bestScore = 0;

    for (const s of similar) {
      const overlap = keywords.filter(k => s.problem_keywords?.includes(k)).length;
      const score = overlap / Math.max(keywords.length, 1);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = s;
      }
    }

    if (bestMatch) {
      return {
        found: true,
        solution: bestMatch.solution_description,
        code: bestMatch.solution_code,
        confidence: bestScore * bestMatch.success_rate
      };
    }
  }

  return { found: false };
}

// =====================================================
// ERROR PATTERN LEARNING
// =====================================================

async function recordErrorPattern(errorPattern: string, fix: string): Promise<void> {
  // Check if pattern already exists
  const { data: existing } = await supabase
    .from('error_patterns')
    .select('id, times_suggested')
    .ilike('error_pattern', `%${errorPattern.substring(0, 50)}%`)
    .single();

  if (existing) {
    // Update existing
    await supabase
      .from('error_patterns')
      .update({
        times_suggested: existing.times_suggested + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new
    const errorType = detectErrorType(errorPattern);
    
    await supabase
      .from('error_patterns')
      .insert({
        error_type: errorType,
        error_pattern: errorPattern,
        error_message_sample: errorPattern,
        fix_description: fix,
        source: 'conversation_learning'
      });
  }
}

function detectErrorType(error: string): string {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('type') || errorLower.includes('typescript')) return 'typescript';
  if (errorLower.includes('react') || errorLower.includes('hook') || errorLower.includes('component')) return 'react';
  if (errorLower.includes('next') || errorLower.includes('module')) return 'nextjs';
  if (errorLower.includes('supabase') || errorLower.includes('postgres') || errorLower.includes('rls')) return 'supabase';
  if (errorLower.includes('stripe')) return 'stripe';
  if (errorLower.includes('vercel') || errorLower.includes('deploy')) return 'vercel';
  
  return 'general';
}

/**
 * Find matching error pattern and fix
 */
export async function findErrorFix(errorMessage: string): Promise<{
  found: boolean;
  fix?: string;
  fixCode?: string;
  confidence?: number;
}> {
  const { data: patterns } = await supabase
    .from('error_patterns')
    .select('error_pattern, fix_description, fix_code, success_rate')
    .gt('success_rate', 0.5)
    .order('success_rate', { ascending: false })
    .limit(50);

  if (!patterns) return { found: false };

  for (const pattern of patterns) {
    // Simple substring match
    if (errorMessage.toLowerCase().includes(pattern.error_pattern.toLowerCase().substring(0, 30))) {
      return {
        found: true,
        fix: pattern.fix_description,
        fixCode: pattern.fix_code,
        confidence: pattern.success_rate
      };
    }
  }

  return { found: false };
}

// =====================================================
// KNOWLEDGE GAP TRACKING
// =====================================================

/**
 * Record a knowledge gap when Javari can't answer
 */
export async function recordKnowledgeGap(topic: string, question: string): Promise<void> {
  // Check if already recorded
  const { data: existing } = await supabase
    .from('knowledge_gaps')
    .select('id, times_asked')
    .eq('topic', topic)
    .ilike('question_asked', `%${question.substring(0, 50)}%`)
    .single();

  if (existing) {
    await supabase
      .from('knowledge_gaps')
      .update({
        times_asked: existing.times_asked + 1,
        last_asked_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('knowledge_gaps')
      .insert({
        topic,
        question_asked: question
      });
  }
}

/**
 * Get top knowledge gaps to fill
 */
export async function getTopKnowledgeGaps(limit: number = 10): Promise<{
  topic: string;
  question: string;
  timesAsked: number;
}[]> {
  const { data } = await supabase
    .from('knowledge_gaps')
    .select('topic, question_asked, times_asked')
    .eq('is_resolved', false)
    .order('priority_score', { ascending: false })
    .limit(limit);

  return (data || []).map(d => ({
    topic: d.topic,
    question: d.question_asked,
    timesAsked: d.times_asked
  }));
}

// =====================================================
// USER PREFERENCE LEARNING
// =====================================================

/**
 * Learn a user preference from conversation
 */
export async function learnUserPreference(
  userId: string,
  preferenceType: string,
  value: any
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .single();

  const updateObj: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  // Map preference type to column
  switch (preferenceType) {
    case 'response_style':
      updateObj.response_style = value;
      break;
    case 'code_language':
      updateObj.code_language_preference = value;
      break;
    case 'framework':
      updateObj.framework_preference = value;
      break;
    case 'expertise':
      updateObj.expertise_level = value;
      break;
    case 'prefers_typescript':
      updateObj.prefers_typescript = value;
      break;
    case 'prefers_brevity':
      updateObj.prefers_brevity = value;
      break;
  }

  if (existing) {
    await supabase
      .from('user_preferences')
      .update(updateObj)
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        ...updateObj
      });
  }
}

// =====================================================
// FEEDBACK PROCESSING
// =====================================================

/**
 * Process user feedback on a response
 */
export async function processFeedback(
  conversationId: string,
  messageId: string,
  feedback: 'positive' | 'negative',
  feedbackText?: string
): Promise<void> {
  // Update the insight if one exists
  await supabase
    .from('conversation_insights')
    .update({
      was_helpful: feedback === 'positive',
      user_feedback: feedbackText,
      confidence_score: feedback === 'positive' ? 0.9 : 0.3
    })
    .eq('conversation_id', conversationId);

  // If negative, record as potential knowledge gap
  if (feedback === 'negative' && feedbackText) {
    await recordKnowledgeGap('Feedback', feedbackText);
  }
}

// =====================================================
// LEARNING STATISTICS
// =====================================================

export async function getLearningStats(): Promise<{
  totalKnowledge: number;
  totalInsights: number;
  promotedInsights: number;
  errorPatterns: number;
  avgFixSuccessRate: number;
  highQualitySolutions: number;
  unresolvedGaps: number;
  pendingLearning: number;
}> {
  const { data } = await supabase
    .from('learning_stats')
    .select('*')
    .single();

  return data || {
    totalKnowledge: 0,
    totalInsights: 0,
    promotedInsights: 0,
    errorPatterns: 0,
    avgFixSuccessRate: 0,
    highQualitySolutions: 0,
    unresolvedGaps: 0,
    pendingLearning: 0
  };
}

export default {
  learnFromConversation,
  findCachedSolution,
  findErrorFix,
  recordKnowledgeGap,
  getTopKnowledgeGaps,
  learnUserPreference,
  processFeedback,
  getLearningStats
};
