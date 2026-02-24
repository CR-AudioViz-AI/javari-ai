// lib/user-memory.ts
// Javari AI User Memory - Persistent User Preferences & Context
// Version: 1.0.0
// Timestamp: 2025-12-13 8:30 AM EST

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UserMemory {
  id: string;
  user_id: string;
  memory_type: 'preference' | 'fact' | 'context' | 'interaction' | 'skill';
  content: string;
  importance: number;
  last_referenced: Date;
  reference_count: number;
  expires_at?: Date;
  metadata?: Record<string, any>;
}

interface UserProfile {
  userId: string;
  preferences: UserMemory[];
  facts: UserMemory[];
  recentContext: UserMemory[];
  skills: UserMemory[];
  totalMemories: number;
}

/**
 * Store a memory for a user
 */
export async function storeMemory(
  userId: string,
  memoryType: UserMemory['memory_type'],
  content: string,
  options?: {
    importance?: number;
    expiresIn?: number; // milliseconds
    metadata?: Record<string, any>;
  }
): Promise<UserMemory | null> {
  const { importance = 0.5, expiresIn, metadata } = options || {};
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for duplicate/similar memory
    const { data: existing } = await supabase
      .from('javari_user_memory')
      .select('id, content, reference_count')
      .eq('user_id', userId)
      .eq('memory_type', memoryType)
      .ilike('content', `%${content.slice(0, 50)}%`)
      .limit(1);
    
    if (existing && existing.length > 0) {
      // Update existing memory
      const { data, error } = await supabase
        .from('javari_user_memory')
        .update({
          last_referenced: new Date().toISOString(),
          reference_count: existing[0].reference_count + 1,
          importance: Math.min(1, importance + 0.1),
        })
        .eq('id', existing[0].id)
        .select()
        .single();
      
      if (error) throw error;
      return data as UserMemory;
    }
    
    // Create new memory
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn).toISOString() : null;
    
    const { data, error } = await supabase
      .from('javari_user_memory')
      .insert({
        user_id: userId,
        memory_type: memoryType,
        content,
        importance,
        expires_at: expiresAt,
        metadata,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as UserMemory;
  } catch (error) {
    console.error('Failed to store memory:', error);
    return null;
  }
}

/**
 * Get memories for a user
 */
export async function getMemories(
  userId: string,
  options?: {
    memoryType?: UserMemory['memory_type'];
    limit?: number;
    minImportance?: number;
  }
): Promise<UserMemory[]> {
  const { memoryType, limit = 20, minImportance = 0 } = options || {};
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('javari_user_memory')
      .select('*')
      .eq('user_id', userId)
      .gte('importance', minImportance)
      .order('importance', { ascending: false })
      .order('last_referenced', { ascending: false })
      .limit(limit);
    
    // Filter out expired memories
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    
    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data as UserMemory[];
  } catch (error) {
    console.error('Failed to get memories:', error);
    return [];
  }
}

/**
 * Get user's full profile (all memory types)
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('javari_user_memory')
      .select('*')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('importance', { ascending: false });
    
    if (error) throw error;
    
    const memories = data as UserMemory[];
    
    return {
      userId,
      preferences: memories.filter(m => m.memory_type === 'preference'),
      facts: memories.filter(m => m.memory_type === 'fact'),
      recentContext: memories.filter(m => m.memory_type === 'context').slice(0, 5),
      skills: memories.filter(m => m.memory_type === 'skill'),
      totalMemories: memories.length,
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return {
      userId,
      preferences: [],
      facts: [],
      recentContext: [],
      skills: [],
      totalMemories: 0,
    };
  }
}

/**
 * Build memory context for AI prompt
 */
export async function buildMemoryContext(userId: string): Promise<string> {
  const profile = await getUserProfile(userId);
  
  if (profile.totalMemories === 0) {
    return '';
  }
  
  const contextParts: string[] = ['## USER CONTEXT (from memory)\n'];
  
  // Add preferences
  if (profile.preferences.length > 0) {
    contextParts.push('### Preferences:');
    for (const pref of profile.preferences.slice(0, 5)) {
      contextParts.push(`- ${pref.content}`);
    }
  }
  
  // Add facts about user
  if (profile.facts.length > 0) {
    contextParts.push('\n### Known Facts:');
    for (const fact of profile.facts.slice(0, 5)) {
      contextParts.push(`- ${fact.content}`);
    }
  }
  
  // Add skills
  if (profile.skills.length > 0) {
    contextParts.push('\n### User Skills:');
    for (const skill of profile.skills.slice(0, 3)) {
      contextParts.push(`- ${skill.content}`);
    }
  }
  
  // Add recent context
  if (profile.recentContext.length > 0) {
    contextParts.push('\n### Recent Context:');
    for (const ctx of profile.recentContext.slice(0, 3)) {
      contextParts.push(`- ${ctx.content}`);
    }
  }
  
  return contextParts.join('\n');
}

/**
 * Extract and store learnings from a conversation
 */
export async function learnFromConversation(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  try {
    // Extract preferences (e.g., "I prefer...", "I like...", "I want...")
    const preferencePatterns = [
      /i (?:prefer|like|love|want|need|always use|usually|typically)\s+(.+?)(?:\.|,|$)/gi,
      /(?:my|i'm a|i am a)\s+(developer|designer|marketer|engineer|founder|ceo|cto|manager)/gi,
      /i work (?:at|for|with)\s+(.+?)(?:\.|,|$)/gi,
    ];
    
    for (const pattern of preferencePatterns) {
      const matches = userMessage.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 3 && match[1].length < 200) {
          await storeMemory(userId, 'preference', match[0].trim(), {
            importance: 0.7,
            metadata: { source: 'conversation_extract' },
          });
        }
      }
    }
    
    // Extract facts
    const factPatterns = [
      /my (?:name is|company is|business is|project is)\s+(.+?)(?:\.|,|$)/gi,
      /i'm (?:building|creating|working on)\s+(.+?)(?:\.|,|$)/gi,
      /i (?:have|own|run)\s+(.+?)(?:\.|,|$)/gi,
    ];
    
    for (const pattern of factPatterns) {
      const matches = userMessage.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 3 && match[1].length < 200) {
          await storeMemory(userId, 'fact', match[0].trim(), {
            importance: 0.8,
            metadata: { source: 'conversation_extract' },
          });
        }
      }
    }
    
    // Store context about what was discussed (with expiration)
    const topics = extractTopics(userMessage);
    if (topics.length > 0) {
      await storeMemory(userId, 'context', `Discussed: ${topics.join(', ')}`, {
        importance: 0.3,
        expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
        metadata: { topics },
      });
    }
  } catch (error) {
    console.error('Failed to learn from conversation:', error);
  }
}

/**
 * Extract main topics from a message
 */
function extractTopics(message: string): string[] {
  const topics: string[] = [];
  const messageLower = message.toLowerCase();
  
  const topicKeywords: Record<string, string[]> = {
    'coding': ['code', 'programming', 'function', 'api', 'bug', 'debug', 'react', 'next', 'typescript'],
    'design': ['design', 'ui', 'ux', 'interface', 'layout', 'style', 'color'],
    'business': ['business', 'revenue', 'strategy', 'marketing', 'sales', 'customer'],
    'database': ['database', 'supabase', 'sql', 'postgres', 'data', 'query'],
    'deployment': ['deploy', 'vercel', 'hosting', 'production', 'build'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'model', 'gpt', 'claude'],
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => messageLower.includes(k))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

/**
 * Update memory importance based on usage
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from('javari_user_memory')
      .update({
        last_referenced: new Date().toISOString(),
        reference_count: supabase.rpc('increment_reference_count'),
        importance: supabase.rpc('increment_importance', { amount: 0.05 }),
      })
      .eq('id', memoryId);
  } catch (error) {
    console.error('Failed to reinforce memory:', error);
  }
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .from('javari_user_memory')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);
    
    return !error;
  } catch (error) {
    console.error('Failed to delete memory:', error);
    return false;
  }
}

/**
 * Clear all memories for a user
 */
export async function clearUserMemories(
  userId: string,
  memoryType?: UserMemory['memory_type']
): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('javari_user_memory')
      .delete()
      .eq('user_id', userId);
    
    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }
    
    const { error } = await query;
    return !error;
  } catch (error) {
    console.error('Failed to clear memories:', error);
    return false;
  }
}

/**
 * Cleanup expired memories (run periodically)
 */
export async function cleanupExpiredMemories(): Promise<number> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('javari_user_memory')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');
    
    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error('Failed to cleanup memories:', error);
    return 0;
  }
}

export default {
  storeMemory,
  getMemories,
  getUserProfile,
  buildMemoryContext,
  learnFromConversation,
  reinforceMemory,
  deleteMemory,
  clearUserMemories,
  cleanupExpiredMemories,
};
