// app/api/memory/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:32 PM EST
// Version: 1.0 - LONG-TERM LEARNING & USER CONTEXT
//
// Capabilities:
// - Store and retrieve user preferences
// - Remember project context across sessions
// - Learn from successful interactions
// - Track user patterns and adapt
// - Persist insights and learnings
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface Memory {
  id: string;
  type: 'preference' | 'fact' | 'context' | 'learning' | 'pattern';
  key: string;
  value: any;
  confidence: number;
  source: string;
  userId?: string;
  projectId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
}

interface MemoryQuery {
  userId?: string;
  projectId?: string;
  type?: Memory['type'];
  key?: string;
  search?: string;
  limit?: number;
}

interface MemoryStore {
  userId?: string;
  projectId?: string;
  type: Memory['type'];
  key: string;
  value: any;
  confidence?: number;
  source: string;
  expiresAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function storeMemory(memory: MemoryStore): Promise<Memory> {
  const now = new Date().toISOString();
  const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Check if memory with same key exists
  const { data: existing } = await supabase
    .from('javari_memory')
    .select('*')
    .eq('key', memory.key)
    .eq('user_id', memory.userId || null)
    .eq('project_id', memory.projectId || null)
    .single();
  
  if (existing) {
    // Update existing memory
    const { data, error } = await supabase
      .from('javari_memory')
      .update({
        value: memory.value,
        confidence: memory.confidence || existing.confidence,
        source: memory.source,
        expires_at: memory.expiresAt,
        updated_at: now,
        access_count: existing.access_count + 1
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    return mapMemory(data);
  }
  
  // Create new memory
  const { data, error } = await supabase
    .from('javari_memory')
    .insert({
      id: memoryId,
      type: memory.type,
      key: memory.key,
      value: memory.value,
      confidence: memory.confidence || 0.8,
      source: memory.source,
      user_id: memory.userId,
      project_id: memory.projectId,
      expires_at: memory.expiresAt,
      created_at: now,
      updated_at: now,
      access_count: 1
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapMemory(data);
}

async function retrieveMemories(query: MemoryQuery): Promise<Memory[]> {
  let q = supabase.from('javari_memory').select('*');
  
  if (query.userId) {
    q = q.eq('user_id', query.userId);
  }
  if (query.projectId) {
    q = q.eq('project_id', query.projectId);
  }
  if (query.type) {
    q = q.eq('type', query.type);
  }
  if (query.key) {
    q = q.eq('key', query.key);
  }
  if (query.search) {
    q = q.or(`key.ilike.%${query.search}%,value::text.ilike.%${query.search}%`);
  }
  
  // Exclude expired memories
  q = q.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  
  // Order by relevance (access count) and recency
  q = q.order('access_count', { ascending: false })
       .order('updated_at', { ascending: false })
       .limit(query.limit || 20);
  
  const { data, error } = await q;
  
  if (error) throw error;
  
  // Update access count for retrieved memories
  if (data && data.length > 0) {
    const ids = data.map(m => m.id);
    await supabase
      .from('javari_memory')
      .update({ access_count: supabase.raw('access_count + 1') })
      .in('id', ids)
      .catch(() => {}); // Non-blocking
  }
  
  return (data || []).map(mapMemory);
}

async function deleteMemory(memoryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('javari_memory')
    .delete()
    .eq('id', memoryId);
  
  return !error;
}

async function getContextForUser(userId: string, projectId?: string): Promise<string> {
  // Get all relevant memories for building context
  const memories = await retrieveMemories({
    userId,
    projectId,
    limit: 50
  });
  
  if (memories.length === 0) {
    return '';
  }
  
  // Build context string
  const preferences = memories.filter(m => m.type === 'preference');
  const facts = memories.filter(m => m.type === 'fact');
  const context = memories.filter(m => m.type === 'context');
  const patterns = memories.filter(m => m.type === 'pattern');
  
  let contextString = '## User Memory Context\n\n';
  
  if (preferences.length > 0) {
    contextString += '### Preferences\n';
    for (const pref of preferences) {
      contextString += `- ${pref.key}: ${JSON.stringify(pref.value)}\n`;
    }
    contextString += '\n';
  }
  
  if (facts.length > 0) {
    contextString += '### Known Facts\n';
    for (const fact of facts) {
      contextString += `- ${fact.key}: ${JSON.stringify(fact.value)}\n`;
    }
    contextString += '\n';
  }
  
  if (context.length > 0) {
    contextString += '### Context\n';
    for (const ctx of context) {
      contextString += `- ${ctx.key}: ${JSON.stringify(ctx.value)}\n`;
    }
    contextString += '\n';
  }
  
  if (patterns.length > 0) {
    contextString += '### Observed Patterns\n';
    for (const pattern of patterns) {
      contextString += `- ${pattern.key}: ${JSON.stringify(pattern.value)}\n`;
    }
  }
  
  return contextString;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-LEARNING FROM CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function learnFromConversation(
  userId: string,
  messages: any[],
  successful: boolean
): Promise<string[]> {
  const learned: string[] = [];
  
  // Extract potential preferences
  const userMessages = messages.filter(m => m.role === 'user');
  
  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    
    // Detect language preferences
    if (/prefer|always|usually|like to|don't like|never/i.test(content)) {
      const prefMatch = content.match(/(?:prefer|always|usually|like to|don't like|never)\s+(\w+(?:\s+\w+)*)/i);
      if (prefMatch) {
        await storeMemory({
          userId,
          type: 'preference',
          key: `stated_preference_${Date.now()}`,
          value: prefMatch[0],
          source: 'conversation_analysis',
          confidence: 0.7
        });
        learned.push(`Preference: ${prefMatch[0]}`);
      }
    }
    
    // Detect project context
    if (/working on|building|project|app called|application/i.test(content)) {
      const projectMatch = content.match(/(?:working on|building|project|app called)\s+["']?(\w+(?:\s+\w+)*)["']?/i);
      if (projectMatch) {
        await storeMemory({
          userId,
          type: 'context',
          key: 'current_project',
          value: projectMatch[1],
          source: 'conversation_analysis',
          confidence: 0.8
        });
        learned.push(`Project context: ${projectMatch[1]}`);
      }
    }
    
    // Detect tech stack mentions
    const techTerms = content.match(/\b(react|vue|angular|next\.?js|typescript|python|node|express|tailwind|supabase|firebase|aws|vercel)\b/gi);
    if (techTerms && techTerms.length > 0) {
      await storeMemory({
        userId,
        type: 'fact',
        key: 'tech_stack_mentioned',
        value: [...new Set(techTerms.map(t => t.toLowerCase()))],
        source: 'conversation_analysis',
        confidence: 0.9
      });
      learned.push(`Tech stack: ${techTerms.join(', ')}`);
    }
  }
  
  // Learn from successful patterns
  if (successful && messages.length >= 2) {
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    
    // Detect what type of request led to success
    let requestType = 'general';
    if (/build|create|make|code/i.test(lastUserMessage)) requestType = 'code_generation';
    else if (/explain|how|what|why/i.test(lastUserMessage)) requestType = 'explanation';
    else if (/fix|debug|error/i.test(lastUserMessage)) requestType = 'debugging';
    else if (/review|feedback/i.test(lastUserMessage)) requestType = 'review';
    
    await storeMemory({
      userId,
      type: 'pattern',
      key: `successful_${requestType}`,
      value: { count: 1, lastQuery: lastUserMessage.slice(0, 100) },
      source: 'success_tracking',
      confidence: 0.6
    });
    learned.push(`Pattern: successful ${requestType}`);
  }
  
  return learned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function mapMemory(data: any): Memory {
  return {
    id: data.id,
    type: data.type,
    key: data.key,
    value: data.value,
    confidence: data.confidence,
    source: data.source,
    userId: data.user_id,
    projectId: data.project_id,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    accessCount: data.access_count
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    switch (action) {
      case 'store': {
        const memory = await storeMemory(params as MemoryStore);
        return NextResponse.json({ success: true, memory });
      }
      
      case 'retrieve': {
        const memories = await retrieveMemories(params as MemoryQuery);
        return NextResponse.json({ success: true, memories, count: memories.length });
      }
      
      case 'delete': {
        const success = await deleteMemory(params.memoryId);
        return NextResponse.json({ success });
      }
      
      case 'getContext': {
        const context = await getContextForUser(params.userId, params.projectId);
        return NextResponse.json({ success: true, context });
      }
      
      case 'learn': {
        const learned = await learnFromConversation(
          params.userId,
          params.messages,
          params.successful
        );
        return NextResponse.json({ success: true, learned });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          availableActions: ['store', 'retrieve', 'delete', 'getContext', 'learn']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Memory] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const projectId = searchParams.get('projectId');
  const type = searchParams.get('type');
  
  if (userId || projectId || type) {
    // Query memories
    const memories = await retrieveMemories({
      userId: userId || undefined,
      projectId: projectId || undefined,
      type: type as Memory['type'] || undefined,
      limit: 50
    });
    
    return NextResponse.json({
      success: true,
      memories,
      count: memories.length
    });
  }
  
  // Return API info
  const { data: stats } = await supabase
    .from('javari_memory')
    .select('type')
    .limit(1000);
  
  const typeCounts: Record<string, number> = {};
  for (const s of stats || []) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Memory System',
    version: '1.0',
    description: 'Long-term learning and user context persistence',
    stats: {
      totalMemories: stats?.length || 0,
      byType: typeCounts
    },
    memoryTypes: [
      { type: 'preference', description: 'User preferences and settings' },
      { type: 'fact', description: 'Known facts about user or project' },
      { type: 'context', description: 'Contextual information' },
      { type: 'learning', description: 'Learned insights from interactions' },
      { type: 'pattern', description: 'Observed behavior patterns' }
    ],
    actions: {
      store: {
        description: 'Store a new memory',
        params: ['type', 'key', 'value', 'userId?', 'projectId?', 'confidence?', 'source', 'expiresAt?']
      },
      retrieve: {
        description: 'Query memories',
        params: ['userId?', 'projectId?', 'type?', 'key?', 'search?', 'limit?']
      },
      delete: {
        description: 'Delete a memory',
        params: ['memoryId']
      },
      getContext: {
        description: 'Get formatted context for a user',
        params: ['userId', 'projectId?']
      },
      learn: {
        description: 'Auto-learn from a conversation',
        params: ['userId', 'messages', 'successful']
      }
    },
    timestamp: new Date().toISOString()
  });
}
