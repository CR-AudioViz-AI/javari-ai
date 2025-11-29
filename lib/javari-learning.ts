// lib/javari-learning.ts
// Javari AI Learning System - Saves insights to javari_knowledge table
// Timestamp: 2025-11-29 15:15 UTC
// Fixed: Added comprehensive error handling and logging

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types matching javari_knowledge table schema
export interface KnowledgeEntry {
  topic: string;
  subtopic: string;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  concept: string;
  explanation: string;
  examples?: string[];
  best_practices?: string[];
  common_mistakes?: string[];
  source_ids?: string[];
  source_urls?: string[];
  confidence_score?: number;
  verified?: boolean;
  verified_by?: string;
  tags?: string[];
  keywords?: string[];
  related_topics?: string[];
}

export interface ConversationLearning {
  conversationId: string;
  userMessage: string;
  assistantResponse: string;
  wasHelpful: boolean;
  feedbackScore?: number;
  problemType?: string;
  solutionWorked?: boolean;
}

/**
 * Extract and save learnings from a conversation
 * Called after a conversation ends or when user provides feedback
 */
export async function learnFromConversation(learning: ConversationLearning): Promise<{
  success: boolean;
  knowledgeId?: string;
  message: string;
  debug?: any;
}> {
  const debug: any = {
    step: 'start',
    learning: {
      hasUserMessage: !!learning.userMessage,
      hasAssistantResponse: !!learning.assistantResponse,
      wasHelpful: learning.wasHelpful,
      solutionWorked: learning.solutionWorked
    }
  };

  try {
    // Validate inputs
    if (!learning.userMessage || !learning.assistantResponse) {
      return {
        success: false,
        message: 'Missing required fields: userMessage or assistantResponse',
        debug
      };
    }

    // Only learn from helpful/successful conversations
    if (!learning.wasHelpful && !learning.solutionWorked) {
      debug.step = 'skipped-not-helpful';
      return {
        success: false,
        message: 'Skipped learning - conversation was not marked as helpful',
        debug
      };
    }

    debug.step = 'extracting';

    // Analyze the conversation to extract knowledge
    const extracted = extractKnowledgeFromConversation(
      learning.userMessage,
      learning.assistantResponse
    );

    debug.extracted = {
      topic: extracted?.topic,
      subtopic: extracted?.subtopic,
      concept: extracted?.concept?.substring(0, 50),
      explanationLength: extracted?.explanation?.length,
      hasExamples: extracted?.examples?.length || 0,
      hasBestPractices: extracted?.best_practices?.length || 0
    };

    if (!extracted) {
      debug.step = 'extraction-returned-null';
      return {
        success: false,
        message: 'No actionable knowledge extracted from conversation (null result)',
        debug
      };
    }

    if (!extracted.concept || !extracted.explanation) {
      debug.step = 'extraction-missing-fields';
      return {
        success: false,
        message: `Missing required extracted fields: concept=${!!extracted.concept}, explanation=${!!extracted.explanation}`,
        debug
      };
    }

    debug.step = 'checking-duplicates';

    // Check if similar knowledge already exists
    let existingKnowledge = null;
    try {
      existingKnowledge = await findSimilarKnowledge(extracted.concept, extracted.topic);
      debug.existingKnowledge = existingKnowledge ? existingKnowledge.id : null;
    } catch (findError) {
      console.error('Error finding similar knowledge:', findError);
      debug.findError = findError instanceof Error ? findError.message : 'Unknown';
      // Continue with insert anyway
    }
    
    if (existingKnowledge) {
      debug.step = 'updating-existing';
      // Update existing knowledge with new insights
      const { error } = await supabase
        .from('javari_knowledge')
        .update({
          times_referenced: (existingKnowledge.times_referenced || 0) + 1,
          last_used_at: new Date().toISOString(),
          // Merge examples if new ones found
          examples: mergeArrays(existingKnowledge.examples, extracted.examples),
          // Update confidence if this was a successful resolution
          confidence_score: learning.solutionWorked
            ? Math.min(1.0, (existingKnowledge.confidence_score || 0.5) + 0.05)
            : existingKnowledge.confidence_score,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingKnowledge.id);

      if (error) {
        debug.updateError = error.message;
        throw error;
      }

      return {
        success: true,
        knowledgeId: existingKnowledge.id,
        message: `Updated existing knowledge: ${extracted.concept}`,
        debug
      };
    }

    debug.step = 'inserting-new';

    // Prepare insert data with all null checks
    const insertData = {
      topic: extracted.topic || 'General',
      subtopic: extracted.subtopic || extracted.topic || 'General',
      skill_level: extracted.skill_level || 'intermediate',
      concept: extracted.concept,
      explanation: extracted.explanation,
      examples: Array.isArray(extracted.examples) ? extracted.examples : [],
      best_practices: Array.isArray(extracted.best_practices) ? extracted.best_practices : [],
      common_mistakes: Array.isArray(extracted.common_mistakes) ? extracted.common_mistakes : [],
      source_ids: learning.conversationId ? [learning.conversationId] : null,
      confidence_score: learning.solutionWorked ? 0.8 : 0.6,
      verified: false,
      verified_by: 'auto-learned',
      tags: Array.isArray(extracted.tags) ? extracted.tags : [],
      keywords: Array.isArray(extracted.keywords) ? extracted.keywords : [],
      times_referenced: 1,
      last_used_at: new Date().toISOString()
    };

    debug.insertData = {
      topic: insertData.topic,
      subtopic: insertData.subtopic,
      concept: insertData.concept.substring(0, 30),
      explanationLength: insertData.explanation.length
    };

    // Insert new knowledge
    const { data, error } = await supabase
      .from('javari_knowledge')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      debug.insertError = error.message;
      debug.insertErrorCode = error.code;
      throw error;
    }

    debug.step = 'complete';

    return {
      success: true,
      knowledgeId: data?.id,
      message: `Learned new knowledge: ${extracted.concept}`,
      debug
    };

  } catch (error) {
    debug.step = 'error';
    debug.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debug.errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined;
    
    console.error('Error learning from conversation:', error);
    console.error('Debug info:', JSON.stringify(debug, null, 2));
    
    return {
      success: false,
      message: `Learning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      debug
    };
  }
}

/**
 * Extract structured knowledge from conversation text (synchronous)
 */
function extractKnowledgeFromConversation(
  userMessage: string,
  assistantResponse: string
): KnowledgeEntry | null {
  try {
    // Classify the problem type
    const problemType = classifyProblem(userMessage);
    
    // Skip generic greetings or simple questions
    if (problemType === 'greeting' || problemType === 'simple_question') {
      console.log('Skipping extraction - problem type:', problemType);
      return null;
    }

    // Determine topic based on problem type
    const { topic, subtopic } = determineTopicFromProblem(problemType, userMessage);
    
    // Extract key concepts from the response
    const concept = extractConcept(problemType, userMessage);
    
    // Create a summary explanation
    const explanation = summarizeResponse(assistantResponse);
    
    // Skip if explanation is too short (lowered threshold from 50 to 20)
    if (explanation.length < 20) {
      console.log('Skipping extraction - explanation too short:', explanation.length);
      return null;
    }

    // Extract keywords from both user message and response
    const keywords = extractKeywords(userMessage + ' ' + assistantResponse);
    
    // Determine skill level based on complexity
    const skill_level = determineSkillLevel(userMessage, assistantResponse);

    return {
      topic,
      subtopic,
      skill_level,
      concept,
      explanation,
      examples: extractExamples(assistantResponse),
      best_practices: extractBestPractices(assistantResponse),
      common_mistakes: extractCommonMistakes(assistantResponse),
      tags: [problemType, topic.toLowerCase()].filter(Boolean),
      keywords
    };
  } catch (error) {
    console.error('Error in extractKnowledgeFromConversation:', error);
    return null;
  }
}

/**
 * Find similar existing knowledge to avoid duplicates
 */
async function findSimilarKnowledge(concept: string, topic: string): Promise<any | null> {
  try {
    // First try exact concept match
    const { data: exactMatch, error: exactError } = await supabase
      .from('javari_knowledge')
      .select('*')
      .eq('concept', concept)
      .eq('topic', topic)
      .maybeSingle(); // Use maybeSingle instead of single to avoid error when not found

    if (exactError) {
      console.error('Error in exact match query:', exactError);
    }

    if (exactMatch) return exactMatch;

    // Try partial match on keywords
    const keywords = concept.toLowerCase().split(' ').filter(w => w.length > 3);
    if (keywords.length === 0) return null;

    const { data: partialMatches, error: partialError } = await supabase
      .from('javari_knowledge')
      .select('*')
      .eq('topic', topic)
      .limit(10);

    if (partialError) {
      console.error('Error in partial match query:', partialError);
    }

    if (!partialMatches || partialMatches.length === 0) return null;

    // Find best match by keyword overlap
    for (const match of partialMatches) {
      const matchKeywords = (match.keywords || []).map((k: string) => k.toLowerCase());
      const overlap = keywords.filter(k => matchKeywords.includes(k));
      if (overlap.length >= keywords.length * 0.7) {
        return match;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding similar knowledge:', error);
    return null;
  }
}

/**
 * Classify the type of problem from user message
 */
function classifyProblem(content: string): string {
  const text = content.toLowerCase();

  // Greetings - don't learn from these
  if (/^(hi|hello|hey|good morning|good evening|what's up|howdy)\b/.test(text)) {
    return 'greeting';
  }

  // Simple factual questions (very short and basic)
  if (text.length < 20 && /^(what is|who is|when was|where is|how many)\b/.test(text)) {
    return 'simple_question';
  }

  // Technical problems
  if (text.includes('deploy') || text.includes('deployment')) return 'deployment';
  if (text.includes('build') || text.includes('compile') || text.includes('typescript error')) return 'build_error';
  if (text.includes('database') || text.includes('sql') || text.includes('supabase')) return 'database';
  if (text.includes('api') || text.includes('endpoint') || text.includes('route')) return 'api';
  if (text.includes('performance') || text.includes('slow') || text.includes('optimize')) return 'performance';
  if (text.includes('bug') || text.includes('error') || text.includes('fix')) return 'bug_fix';
  if (text.includes('test') || text.includes('testing')) return 'testing';
  if (text.includes('security') || text.includes('auth') || text.includes('permission')) return 'security';
  
  // Business/Platform
  if (text.includes('credit') || text.includes('billing') || text.includes('payment')) return 'billing';
  if (text.includes('user') || text.includes('customer') || text.includes('client')) return 'user_management';
  if (text.includes('feature') || text.includes('implement') || text.includes('build')) return 'feature';

  return 'general';
}

/**
 * Map problem type to topic/subtopic
 */
function determineTopicFromProblem(problemType: string, content: string): { topic: string; subtopic: string } {
  const mappings: Record<string, { topic: string; subtopic: string }> = {
    'deployment': { topic: 'Infrastructure', subtopic: 'Deployment' },
    'build_error': { topic: 'Development', subtopic: 'Build Errors' },
    'database': { topic: 'Infrastructure', subtopic: 'Database' },
    'api': { topic: 'Development', subtopic: 'API' },
    'performance': { topic: 'Development', subtopic: 'Performance' },
    'bug_fix': { topic: 'Development', subtopic: 'Bug Fixes' },
    'testing': { topic: 'Development', subtopic: 'Testing' },
    'security': { topic: 'Security', subtopic: 'General' },
    'billing': { topic: 'Billing', subtopic: 'General' },
    'user_management': { topic: 'Users', subtopic: 'Management' },
    'feature': { topic: 'Development', subtopic: 'Features' },
    'general': { topic: 'General', subtopic: 'Miscellaneous' }
  };

  return mappings[problemType] || mappings['general'];
}

/**
 * Extract a concept title from the problem
 */
function extractConcept(problemType: string, content: string): string {
  // Create a descriptive concept name
  const words = content.split(' ').slice(0, 10);
  const truncated = words.join(' ');
  
  // Capitalize first letter and clean up
  const cleaned = truncated
    .replace(/[?!.,]/g, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  // Add problem type prefix for clarity
  const prefixes: Record<string, string> = {
    'deployment': 'Deploy:',
    'build_error': 'Build Fix:',
    'database': 'DB:',
    'api': 'API:',
    'bug_fix': 'Fix:',
    'feature': 'Feature:'
  };

  const prefix = prefixes[problemType] || '';
  return (prefix + ' ' + cleaned).trim().substring(0, 100);
}

/**
 * Summarize response into explanation
 */
function summarizeResponse(response: string): string {
  // Take first 500 characters as explanation
  // Remove code blocks for cleaner explanation
  const cleaned = response
    .replace(/```[\s\S]*?```/g, '[code example]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= 500) return cleaned;

  // Try to break at sentence boundary
  const truncated = cleaned.substring(0, 500);
  const lastPeriod = truncated.lastIndexOf('.');
  
  return lastPeriod > 200 ? truncated.substring(0, lastPeriod + 1) : truncated + '...';
}

/**
 * Extract examples from response
 */
function extractExamples(response: string): string[] {
  const examples: string[] = [];
  
  // Look for code blocks
  const codeBlocks = response.match(/```[\s\S]*?```/g);
  if (codeBlocks) {
    codeBlocks.slice(0, 3).forEach((block) => {
      const cleaned = block.replace(/```\w*\n?/g, '').trim();
      if (cleaned.length > 10 && cleaned.length < 500) {
        examples.push(cleaned);
      }
    });
  }

  return examples;
}

/**
 * Extract best practices mentioned in response
 */
function extractBestPractices(response: string): string[] {
  const practices: string[] = [];

  // Look for patterns indicating best practices
  const patterns = [
    /best practice[s]?[:\s]+([^.]+\.)/gi,
    /recommend[s]?[:\s]+([^.]+\.)/gi,
    /should always[:\s]+([^.]+\.)/gi,
    /it'?s? important to[:\s]+([^.]+\.)/gi
  ];

  patterns.forEach(pattern => {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10) {
        practices.push(match[1].trim());
      }
    }
  });

  return practices.slice(0, 5);
}

/**
 * Extract common mistakes mentioned in response
 */
function extractCommonMistakes(response: string): string[] {
  const mistakes: string[] = [];

  // Look for patterns indicating common mistakes
  const patterns = [
    /common mistake[s]?[:\s]+([^.]+\.)/gi,
    /avoid[:\s]+([^.]+\.)/gi,
    /don'?t[:\s]+([^.]+\.)/gi,
    /problem[s]? (?:is|are|was|were)[:\s]+([^.]+\.)/gi
  ];

  patterns.forEach(pattern => {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10) {
        mistakes.push(match[1].trim());
      }
    }
  });

  return mistakes.slice(0, 5);
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Remove code blocks
  const cleaned = text.replace(/```[\s\S]*?```/g, '');
  
  // Common technical keywords to look for
  const techKeywords = [
    'typescript', 'javascript', 'react', 'next', 'nextjs', 'vercel', 'supabase',
    'api', 'database', 'postgresql', 'sql', 'deploy', 'build', 'error', 'fix',
    'component', 'function', 'async', 'await', 'promise', 'hook', 'state',
    'authentication', 'authorization', 'security', 'performance', 'optimization',
    'stripe', 'paypal', 'credit', 'billing', 'subscription', 'webhook',
    'github', 'git', 'commit', 'branch', 'merge', 'pull request',
    'test', 'testing', 'jest', 'cypress', 'debugging', 'logging'
  ];

  const found: string[] = [];
  const textLower = cleaned.toLowerCase();

  techKeywords.forEach(keyword => {
    if (textLower.includes(keyword)) {
      found.push(keyword);
    }
  });

  return [...new Set(found)].slice(0, 10);
}

/**
 * Determine skill level based on complexity
 */
function determineSkillLevel(userMessage: string, response: string): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  const combinedText = (userMessage + ' ' + response).toLowerCase();
  
  // Count complexity indicators
  let complexityScore = 0;

  // Advanced patterns
  if (combinedText.includes('architecture')) complexityScore += 2;
  if (combinedText.includes('microservice')) complexityScore += 2;
  if (combinedText.includes('distributed')) complexityScore += 2;
  if (combinedText.includes('scaling')) complexityScore += 1;
  if (combinedText.includes('optimization')) complexityScore += 1;
  if (combinedText.includes('security vulnerability')) complexityScore += 2;
  
  // Intermediate patterns
  if (combinedText.includes('custom hook')) complexityScore += 1;
  if (combinedText.includes('middleware')) complexityScore += 1;
  if (combinedText.includes('authentication')) complexityScore += 1;
  if (combinedText.includes('caching')) complexityScore += 1;
  
  // Beginner patterns (negative score)
  if (combinedText.includes('how do i')) complexityScore -= 1;
  if (combinedText.includes('what is')) complexityScore -= 1;
  if (combinedText.includes('getting started')) complexityScore -= 1;

  if (complexityScore >= 4) return 'expert';
  if (complexityScore >= 2) return 'advanced';
  if (complexityScore >= 0) return 'intermediate';
  return 'beginner';
}

/**
 * Merge arrays without duplicates
 */
function mergeArrays(existing: string[] | null, newItems: string[] | undefined): string[] {
  const combined = [...(existing || []), ...(newItems || [])];
  return [...new Set(combined)];
}

/**
 * Manual knowledge addition (for admin use)
 */
export async function addKnowledge(entry: KnowledgeEntry): Promise<{
  success: boolean;
  knowledgeId?: string;
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('javari_knowledge')
      .insert({
        ...entry,
        confidence_score: entry.confidence_score || 1.0,
        verified: entry.verified ?? true,
        verified_by: entry.verified_by || 'manual',
        times_referenced: 0
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      knowledgeId: data?.id,
      message: `Added knowledge: ${entry.concept}`
    };
  } catch (error) {
    console.error('Error adding knowledge:', error);
    return {
      success: false,
      message: `Failed to add knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get knowledge statistics
 */
export async function getKnowledgeStats(): Promise<{
  total: number;
  byTopic: Record<string, number>;
  verified: number;
  autoLearned: number;
}> {
  try {
    const { data, error } = await supabase
      .from('javari_knowledge')
      .select('topic, verified, verified_by');

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      byTopic: {} as Record<string, number>,
      verified: 0,
      autoLearned: 0
    };

    data?.forEach(item => {
      // Count by topic
      stats.byTopic[item.topic] = (stats.byTopic[item.topic] || 0) + 1;
      
      // Count verified
      if (item.verified) stats.verified++;
      
      // Count auto-learned
      if (item.verified_by === 'auto-learned') stats.autoLearned++;
    });

    return stats;
  } catch (error) {
    console.error('Error getting knowledge stats:', error);
    return {
      total: 0,
      byTopic: {},
      verified: 0,
      autoLearned: 0
    };
  }
}
