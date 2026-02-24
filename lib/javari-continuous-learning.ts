// lib/javari-continuous-learning.ts
// Javari NEVER stops learning - extracts knowledge from everything
// Timestamp: 2025-11-30 12:40 EST

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Topic detection keywords
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Development': ['code', 'function', 'api', 'react', 'next.js', 'typescript', 'javascript', 'deploy', 'build', 'git', 'database'],
  'Real Estate': ['property', 'listing', 'mortgage', 'buyer', 'seller', 'agent', 'commission', 'mls', 'closing'],
  'Legal': ['contract', 'agreement', 'liability', 'compliance', 'terms', 'privacy', 'nda', 'llc'],
  'AI Tools': ['openai', 'claude', 'gpt', 'prompt', 'model', 'generate', 'ai', 'image', 'voice'],
  'Platform': ['cr audioviz', 'javari', 'craiverse', 'credits', 'subscription', 'tools'],
  'Business': ['revenue', 'pricing', 'customer', 'sales', 'marketing', 'growth', 'strategy'],
  'Grants': ['grant', 'funding', 'sbir', 'nonprofit', 'foundation', 'award'],
  'Social Impact': ['veteran', 'first responder', 'faith', 'community', 'nonprofit', 'charity'],
};

function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  let bestMatch = 'General';
  let maxScore = 0;

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > maxScore) {
      maxScore = score;
      bestMatch = topic;
    }
  }
  return bestMatch;
}

function extractConcept(userMessage: string): string {
  // Get the main question/request
  const cleaned = userMessage
    .replace(/^(how|what|why|when|where|can you|could you|please|help me)/i, '')
    .trim();
  
  // Capitalize and limit
  const concept = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return concept.length > 100 ? concept.substring(0, 100) + '...' : concept;
}

function extractKeyInsights(response: string): string {
  // Get the most important part of the response (first substantial paragraph)
  const paragraphs = response.split('\n\n').filter(p => p.length > 50);
  if (paragraphs.length > 0) {
    return paragraphs[0].substring(0, 500);
  }
  return response.substring(0, 500);
}

function extractExamples(response: string): string[] {
  const examples: string[] = [];
  
  // Find code blocks
  const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
  codeBlocks.forEach(block => {
    if (block.length < 500) {
      examples.push(block.replace(/```\w*\n?/g, '').trim());
    }
  });

  return examples.slice(0, 3);
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  // Count frequency
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  // Get top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export async function learnAggressively(
  userMessage: string,
  assistantResponse: string,
  metadata?: {
    conversationId?: string;
    wasHelpful?: boolean;
    feedbackScore?: number;
  }
): Promise<{ learned: boolean; knowledgeId?: string; message: string }> {
  
  try {
    // Skip very short exchanges
    if (userMessage.length < 20 || assistantResponse.length < 100) {
      return { learned: false, message: 'Too short to extract knowledge' };
    }

    // Skip greetings/small talk
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|cool|nice)/i.test(userMessage.trim())) {
      return { learned: false, message: 'Greeting/acknowledgment - no knowledge to extract' };
    }

    const topic = detectTopic(userMessage + ' ' + assistantResponse);
    const concept = extractConcept(userMessage);
    const explanation = extractKeyInsights(assistantResponse);
    const examples = extractExamples(assistantResponse);
    const keywords = extractKeywords(userMessage + ' ' + assistantResponse);

    // Check for duplicates
    const { data: existing } = await supabase
      .from('javari_knowledge')
      .select('id')
      .ilike('concept', `%${concept.substring(0, 50)}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update reference count
      await supabase
        .from('javari_knowledge')
        .update({ 
          times_referenced: supabase.rpc('increment_counter', { row_id: existing[0].id }),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing[0].id);
      
      return { learned: false, knowledgeId: existing[0].id, message: 'Similar knowledge exists - updated reference count' };
    }

    // Insert new knowledge
    const { data, error } = await supabase
      .from('javari_knowledge')
      .insert({
        topic,
        subtopic: topic,
        skill_level: 'intermediate',
        concept,
        explanation,
        examples: examples.length > 0 ? examples : null,
        keywords,
        tags: [topic.toLowerCase(), 'auto-learned'],
        confidence_score: metadata?.feedbackScore ? metadata.feedbackScore / 5 : 0.7,
        verified: false,
        verified_by: 'auto-learned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Learning insert error:', error);
      return { learned: false, message: error.message };
    }

    return { 
      learned: true, 
      knowledgeId: data.id, 
      message: `Learned: ${topic} - ${concept.substring(0, 50)}...` 
    };

  } catch (error) {
    console.error('Aggressive learning error:', error);
    return { learned: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Batch learning from conversation history
export async function learnFromHistory(conversations: Array<{ user: string; assistant: string }>): Promise<number> {
  let learned = 0;
  
  for (const conv of conversations) {
    const result = await learnAggressively(conv.user, conv.assistant);
    if (result.learned) learned++;
  }
  
  return learned;
}

export default learnAggressively;
