// app/api/javari/learn/route.ts
// Javari AI Learning API - Save learnings from conversations to knowledge base
// Timestamp: 2025-11-29 14:50 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LearnRequest {
  topic: string;
  subtopic?: string;
  concept: string;
  explanation: string;
  examples?: string[];
  bestPractices?: string[];
  commonMistakes?: string[];
  tags?: string[];
  keywords?: string[];
  source?: 'conversation' | 'document' | 'github' | 'manual' | 'api';
  conversationId?: string;
  confidenceScore?: number;
}

interface ExtractInsightRequest {
  userMessage: string;
  assistantResponse: string;
  conversationId?: string;
  wasHelpful?: boolean;
}

// POST /api/javari/learn - Save a new learning to the knowledge base
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'save' } = body;

    if (action === 'extract') {
      // Extract insights from a conversation exchange
      return await extractAndSaveInsight(body as ExtractInsightRequest);
    }

    // Default: save a direct learning entry
    return await saveLearning(body as LearnRequest);
  } catch (error) {
    console.error('Learning API error:', error);
    return NextResponse.json(
      { error: 'Failed to save learning', message: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/javari/learn - Get learning statistics
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('javari_knowledge')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (topic) {
      query = query.eq('topic', topic);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get topic statistics
    const { data: topicStats } = await supabase
      .from('javari_knowledge')
      .select('topic')
      .then(result => {
        const topics: Record<string, number> = {};
        result.data?.forEach(row => {
          topics[row.topic] = (topics[row.topic] || 0) + 1;
        });
        return { data: topics };
      });

    return NextResponse.json({
      entries: data,
      total: count,
      topicDistribution: topicStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning statistics' },
      { status: 500 }
    );
  }
}

async function saveLearning(learning: LearnRequest): Promise<NextResponse> {
  // Validate required fields
  if (!learning.topic || !learning.concept || !learning.explanation) {
    return NextResponse.json(
      { error: 'Missing required fields: topic, concept, explanation' },
      { status: 400 }
    );
  }

  // Check for duplicates
  const { data: existing } = await supabase
    .from('javari_knowledge')
    .select('id, concept')
    .eq('topic', learning.topic)
    .eq('concept', learning.concept)
    .single();

  if (existing) {
    // Update existing entry instead of creating duplicate
    const { data, error } = await supabase
      .from('javari_knowledge')
      .update({
        explanation: learning.explanation,
        examples: learning.examples || [],
        best_practices: learning.bestPractices || [],
        common_mistakes: learning.commonMistakes || [],
        tags: learning.tags || [],
        keywords: learning.keywords || [],
        confidence_score: learning.confidenceScore || 0.8,
        times_referenced: supabase.rpc('increment_times_referenced', { row_id: existing.id }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      action: 'updated',
      entry: data,
      message: `Updated existing knowledge entry: ${learning.concept}`,
    });
  }

  // Insert new entry
  const { data, error } = await supabase
    .from('javari_knowledge')
    .insert({
      topic: learning.topic,
      subtopic: learning.subtopic || learning.topic,
      skill_level: 'intermediate',
      concept: learning.concept,
      explanation: learning.explanation,
      examples: learning.examples || [],
      best_practices: learning.bestPractices || [],
      common_mistakes: learning.commonMistakes || [],
      source_ids: learning.conversationId ? [learning.conversationId] : null,
      confidence_score: learning.confidenceScore || 0.7,
      verified: false, // New learnings need verification
      verified_by: null,
      tags: learning.tags || [],
      keywords: learning.keywords || [],
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json({
    success: true,
    action: 'created',
    entry: data,
    message: `Created new knowledge entry: ${learning.concept}`,
  });
}

async function extractAndSaveInsight(request: ExtractInsightRequest): Promise<NextResponse> {
  const { userMessage, assistantResponse, conversationId, wasHelpful } = request;

  // Skip if conversation wasn't helpful or too short
  if (wasHelpful === false || assistantResponse.length < 100) {
    return NextResponse.json({
      success: false,
      action: 'skipped',
      reason: 'Conversation too short or marked as unhelpful',
    });
  }

  // Analyze the conversation to extract learnings
  const insights = analyzeConversationForInsights(userMessage, assistantResponse);

  if (insights.length === 0) {
    return NextResponse.json({
      success: false,
      action: 'skipped',
      reason: 'No actionable insights found in conversation',
    });
  }

  const savedInsights = [];

  for (const insight of insights) {
    try {
      const result = await saveLearning({
        topic: insight.topic,
        subtopic: insight.subtopic,
        concept: insight.concept,
        explanation: insight.explanation,
        tags: insight.tags,
        keywords: insight.keywords,
        source: 'conversation',
        conversationId,
        confidenceScore: insight.confidence,
      });

      const response = await result.json();
      if (response.success) {
        savedInsights.push(response.entry);
      }
    } catch (error) {
      console.error('Error saving insight:', error);
    }
  }

  return NextResponse.json({
    success: savedInsights.length > 0,
    action: 'extracted',
    savedCount: savedInsights.length,
    insights: savedInsights,
  });
}

interface ExtractedInsight {
  topic: string;
  subtopic: string;
  concept: string;
  explanation: string;
  tags: string[];
  keywords: string[];
  confidence: number;
}

function analyzeConversationForInsights(userMessage: string, assistantResponse: string): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];
  const messageLower = userMessage.toLowerCase();
  const responseLower = assistantResponse.toLowerCase();

  // Pattern 1: Code/Technical solutions
  if (messageLower.includes('how do i') || messageLower.includes('how to')) {
    const topic = detectTopic(userMessage);
    if (topic && assistantResponse.length > 200) {
      insights.push({
        topic: 'Solutions',
        subtopic: topic,
        concept: extractConcept(userMessage),
        explanation: extractSummary(assistantResponse),
        tags: ['how-to', 'solution', topic.toLowerCase()],
        keywords: extractKeywords(userMessage + ' ' + assistantResponse),
        confidence: 0.7,
      });
    }
  }

  // Pattern 2: Error fixes
  if (messageLower.includes('error') || messageLower.includes('fix') || messageLower.includes('bug')) {
    if (responseLower.includes('solution') || responseLower.includes('try') || responseLower.includes('fix')) {
      insights.push({
        topic: 'Debugging',
        subtopic: 'Error Solutions',
        concept: extractErrorType(userMessage),
        explanation: extractSummary(assistantResponse),
        tags: ['error', 'fix', 'debugging'],
        keywords: extractKeywords(userMessage),
        confidence: 0.8,
      });
    }
  }

  // Pattern 3: Best practices / recommendations
  if (responseLower.includes('best practice') || responseLower.includes('recommend') || responseLower.includes('should')) {
    const topic = detectTopic(userMessage);
    if (topic) {
      insights.push({
        topic: 'Best Practices',
        subtopic: topic,
        concept: `Best practices for ${topic}`,
        explanation: extractSummary(assistantResponse),
        tags: ['best-practice', 'recommendation', topic.toLowerCase()],
        keywords: extractKeywords(assistantResponse),
        confidence: 0.75,
      });
    }
  }

  // Pattern 4: Explanations / Teaching
  if (messageLower.includes('what is') || messageLower.includes('explain') || messageLower.includes('why')) {
    const topic = detectTopic(userMessage);
    if (topic && assistantResponse.length > 300) {
      insights.push({
        topic: 'Concepts',
        subtopic: topic,
        concept: extractConcept(userMessage),
        explanation: extractSummary(assistantResponse),
        tags: ['explanation', 'concept', topic.toLowerCase()],
        keywords: extractKeywords(userMessage + ' ' + assistantResponse),
        confidence: 0.65,
      });
    }
  }

  return insights;
}

function detectTopic(text: string): string {
  const topicPatterns: Record<string, string[]> = {
    'TypeScript': ['typescript', 'ts', 'type', 'interface'],
    'React': ['react', 'component', 'hook', 'useState', 'useEffect'],
    'Next.js': ['next.js', 'nextjs', 'next', 'getServerSideProps', 'app router'],
    'Supabase': ['supabase', 'postgresql', 'database', 'rls'],
    'Vercel': ['vercel', 'deployment', 'deploy', 'serverless'],
    'GitHub': ['github', 'git', 'repo', 'commit', 'push'],
    'API': ['api', 'endpoint', 'rest', 'fetch', 'request'],
    'CSS': ['css', 'tailwind', 'style', 'className'],
    'Authentication': ['auth', 'login', 'session', 'jwt', 'token'],
    'AI': ['ai', 'openai', 'gpt', 'claude', 'llm', 'prompt'],
  };

  const textLower = text.toLowerCase();
  
  for (const [topic, keywords] of Object.entries(topicPatterns)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      return topic;
    }
  }

  return 'General';
}

function extractConcept(userMessage: string): string {
  // Extract the main subject of the question
  const cleanMessage = userMessage
    .replace(/how (do i|to|can i)/gi, '')
    .replace(/what is/gi, '')
    .replace(/explain/gi, '')
    .replace(/why/gi, '')
    .replace(/[?!.]/g, '')
    .trim();

  // Capitalize first letter and limit length
  return cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1, 100);
}

function extractErrorType(message: string): string {
  // Common error patterns
  const patterns = [
    /error:\s*(.+?)(?:\.|$)/i,
    /TypeError:\s*(.+?)(?:\.|$)/i,
    /ReferenceError:\s*(.+?)(?:\.|$)/i,
    /SyntaxError:\s*(.+?)(?:\.|$)/i,
    /build\s+(?:error|failed)/i,
    /deployment\s+(?:error|failed)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[0].substring(0, 100);
    }
  }

  return 'Error resolution';
}

function extractSummary(response: string): string {
  // Get the first meaningful paragraph (skip greetings)
  const paragraphs = response.split('\n\n').filter(p => p.trim().length > 50);
  
  if (paragraphs.length === 0) {
    return response.substring(0, 500);
  }

  // Skip common greeting patterns
  let startIndex = 0;
  const greetings = ['hi', 'hello', 'hey', 'sure', 'of course', 'certainly'];
  if (greetings.some(g => paragraphs[0].toLowerCase().startsWith(g))) {
    startIndex = 1;
  }

  // Combine relevant paragraphs up to 500 chars
  let summary = '';
  for (let i = startIndex; i < paragraphs.length && summary.length < 500; i++) {
    summary += (summary ? ' ' : '') + paragraphs[i].trim();
  }

  return summary.substring(0, 500);
}

function extractKeywords(text: string): string[] {
  // Extract meaningful words (nouns, technical terms)
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Common stop words to exclude
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should',
    'about', 'into', 'your', 'their', 'there', 'here', 'when', 'where', 'which', 'what',
    'make', 'just', 'also', 'very', 'well', 'then', 'than', 'some', 'more', 'other',
  ]);

  const keywords = [...new Set(words)]
    .filter(w => !stopWords.has(w))
    .slice(0, 10);

  return keywords;
}
