// lib/chat-tracking.ts
// Javari AI Chat Tracking - Context Window & Build Progress Management
// Version: 1.0.0
// Timestamp: 2025-12-13 9:35 AM EST

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Context window limits by model
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4-turbo-preview': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16384,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-sonnet-4-5-20250929': 200000,
  'claude-opus-4-20250514': 200000,
  'gemini-1.5-pro': 1000000,
  'mistral-large-latest': 32000,
  'sonar-pro': 128000,
  'default': 128000,
};

// When to auto-continue (percentage of context used)
const AUTO_CONTINUE_THRESHOLD = 0.85; // 85%
const WARNING_THRESHOLD = 0.70; // 70%

export interface ChatStatus {
  id: string;
  title: string;
  isActive: boolean;
  contextTokensUsed: number;
  contextTokensMax: number;
  contextPercentage: number;
  buildProgress: number;
  buildStatus: 'idle' | 'building' | 'complete' | 'error';
  continuationDepth: number;
  parentId: string | null;
  rootConversationId: string | null;
  lastActivityAt: Date;
  messageCount: number;
  needsContinuation: boolean;
  warningLevel: 'none' | 'warning' | 'critical';
}

export interface ConversationChain {
  id: string;
  title: string;
  position: number;
  isCurrent: boolean;
  messageCount: number;
  createdAt: Date;
}

/**
 * Estimate token count from text (rough: 4 chars ≈ 1 token)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a conversation
 */
export function estimateConversationTokens(messages: Array<{ content: string; role: string }>): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content || '');
    total += 4; // Role and formatting overhead
  }
  return total;
}

/**
 * Get context limit for a model
 */
export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || MODEL_CONTEXT_LIMITS['default'];
}

/**
 * Calculate context usage percentage
 */
export function getContextPercentage(tokensUsed: number, model: string): number {
  const limit = getContextLimit(model);
  return Math.min(100, Math.round((tokensUsed / limit) * 100));
}

/**
 * Determine if conversation needs continuation
 */
export function needsContinuation(tokensUsed: number, model: string): boolean {
  const limit = getContextLimit(model);
  return tokensUsed / limit >= AUTO_CONTINUE_THRESHOLD;
}

/**
 * Get warning level for context usage
 */
export function getWarningLevel(tokensUsed: number, model: string): 'none' | 'warning' | 'critical' {
  const limit = getContextLimit(model);
  const percentage = tokensUsed / limit;
  
  if (percentage >= AUTO_CONTINUE_THRESHOLD) return 'critical';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'none';
}

/**
 * Update chat status in database
 */
export async function updateChatStatus(
  conversationId: string,
  updates: Partial<{
    isActive: boolean;
    contextTokensUsed: number;
    buildProgress: number;
    buildStatus: string;
    lastActivityAt: Date;
  }>
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.contextTokensUsed !== undefined) updateData.context_tokens_used = updates.contextTokensUsed;
    if (updates.buildProgress !== undefined) updateData.build_progress = updates.buildProgress;
    if (updates.lastActivityAt !== undefined) updateData.last_activity_at = updates.lastActivityAt.toISOString();
    
    if (updates.buildStatus !== undefined) {
      updateData.status_detail = { buildStatus: updates.buildStatus };
    }
    
    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);
  } catch (error) {
    console.error('Failed to update chat status:', error);
  }
}

/**
 * Get chat status for a conversation
 */
export async function getChatStatus(conversationId: string, model: string = 'default'): Promise<ChatStatus | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (error || !data) return null;
    
    const contextLimit = getContextLimit(model);
    const tokensUsed = data.context_tokens_used || 0;
    
    return {
      id: data.id,
      title: data.title || 'Untitled',
      isActive: data.is_active || false,
      contextTokensUsed: tokensUsed,
      contextTokensMax: contextLimit,
      contextPercentage: getContextPercentage(tokensUsed, model),
      buildProgress: data.build_progress || 0,
      buildStatus: data.status_detail?.buildStatus || 'idle',
      continuationDepth: data.continuation_depth || 0,
      parentId: data.parent_id,
      rootConversationId: data.root_conversation_id,
      lastActivityAt: new Date(data.last_activity_at || data.updated_at),
      messageCount: data.message_count || 0,
      needsContinuation: needsContinuation(tokensUsed, model),
      warningLevel: getWarningLevel(tokensUsed, model),
    };
  } catch (error) {
    console.error('Failed to get chat status:', error);
    return null;
  }
}

/**
 * Get all chat statuses for a user
 */
export async function getUserChatStatuses(userId: string, model: string = 'default'): Promise<ChatStatus[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error || !data) return [];
    
    const contextLimit = getContextLimit(model);
    
    return data.map(conv => {
      const tokensUsed = conv.context_tokens_used || 0;
      return {
        id: conv.id,
        title: conv.title || 'Untitled',
        isActive: conv.is_active || false,
        contextTokensUsed: tokensUsed,
        contextTokensMax: contextLimit,
        contextPercentage: getContextPercentage(tokensUsed, model),
        buildProgress: conv.build_progress || 0,
        buildStatus: conv.status_detail?.buildStatus || 'idle',
        continuationDepth: conv.continuation_depth || 0,
        parentId: conv.parent_id,
        rootConversationId: conv.root_conversation_id,
        lastActivityAt: new Date(conv.last_activity_at || conv.updated_at),
        messageCount: conv.message_count || 0,
        needsContinuation: needsContinuation(tokensUsed, model),
        warningLevel: getWarningLevel(tokensUsed, model),
      };
    });
  } catch (error) {
    console.error('Failed to get user chat statuses:', error);
    return [];
  }
}

/**
 * Get conversation chain (breadcrumbs)
 */
export async function getConversationChain(conversationId: string): Promise<ConversationChain[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, get the root conversation ID
    const { data: current } = await supabase
      .from('conversations')
      .select('root_conversation_id, parent_id')
      .eq('id', conversationId)
      .single();
    
    if (!current) return [];
    
    const rootId = current.root_conversation_id || conversationId;
    
    // Get all conversations in the chain
    const { data: chain } = await supabase
      .from('conversations')
      .select('id, title, message_count, created_at, continuation_depth')
      .or(`id.eq.${rootId},root_conversation_id.eq.${rootId}`)
      .order('continuation_depth', { ascending: true });
    
    if (!chain) return [];
    
    return chain.map((conv, index) => ({
      id: conv.id,
      title: conv.title || `Chat ${index + 1}`,
      position: conv.continuation_depth || index,
      isCurrent: conv.id === conversationId,
      messageCount: conv.message_count || 0,
      createdAt: new Date(conv.created_at),
    }));
  } catch (error) {
    console.error('Failed to get conversation chain:', error);
    return [];
  }
}

/**
 * Create a continuation conversation
 */
export async function createContinuation(
  parentConversationId: string,
  userId: string,
  summary?: string
): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get parent conversation details
    const { data: parent } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', parentConversationId)
      .single();
    
    if (!parent) return null;
    
    const rootId = parent.root_conversation_id || parent.id;
    const newDepth = (parent.continuation_depth || 0) + 1;
    
    // Create continuation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        parent_id: parentConversationId,
        root_conversation_id: rootId,
        title: `${parent.title} (continued ${newDepth})`,
        messages: summary ? [{ role: 'system', content: `Context from previous conversation: ${summary}` }] : [],
        message_count: summary ? 1 : 0,
        model: parent.model,
        status: 'active',
        continuation_depth: newDepth,
        is_active: true,
        context_tokens_used: summary ? estimateTokens(summary) : 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create continuation:', error);
      return null;
    }
    
    // Mark parent as inactive
    await supabase
      .from('conversations')
      .update({ is_active: false })
      .eq('id', parentConversationId);
    
    return newConv.id;
  } catch (error) {
    console.error('Failed to create continuation:', error);
    return null;
  }
}

/**
 * Generate a summary of a conversation for continuation
 */
export function generateConversationSummary(messages: Array<{ role: string; content: string }>): string {
  const recentMessages = messages.slice(-10); // Last 10 messages
  
  const topics: string[] = [];
  const keyPoints: string[] = [];
  
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      // Extract topics from user messages
      const words = msg.content.split(/\s+/).filter(w => w.length > 5);
      topics.push(...words.slice(0, 3));
    } else if (msg.role === 'assistant') {
      // Extract first sentence from assistant responses
      const firstSentence = msg.content.split(/[.!?]/)[0];
      if (firstSentence.length < 200) {
        keyPoints.push(firstSentence);
      }
    }
  }
  
  return `Topics discussed: ${[...new Set(topics)].slice(0, 5).join(', ')}. Key points: ${keyPoints.slice(-3).join('. ')}`;
}

/**
 * Set active conversation (and deactivate others)
 */
export async function setActiveConversation(userId: string, conversationId: string): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Deactivate all user's conversations
    await supabase
      .from('conversations')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    // Activate the selected one
    await supabase
      .from('conversations')
      .update({ 
        is_active: true, 
        last_activity_at: new Date().toISOString() 
      })
      .eq('id', conversationId);
  } catch (error) {
    console.error('Failed to set active conversation:', error);
  }
}

/**
 * Track build progress
 */
export async function trackBuildProgress(
  conversationId: string,
  progress: number,
  status: 'building' | 'complete' | 'error'
): Promise<void> {
  await updateChatStatus(conversationId, {
    buildProgress: progress,
    buildStatus: status,
  });
}

export default {
  estimateTokens,
  estimateConversationTokens,
  getContextLimit,
  getContextPercentage,
  needsContinuation,
  getWarningLevel,
  updateChatStatus,
  getChatStatus,
  getUserChatStatuses,
  getConversationChain,
  createContinuation,
  generateConversationSummary,
  setActiveConversation,
  trackBuildProgress,
};
