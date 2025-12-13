// app/api/javari/chat-status/route.ts
// Javari AI Chat Status API - Real-time tracking endpoints
// Version: 1.0.0
// Timestamp: 2025-12-13 9:40 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Context limits by model
const MODEL_LIMITS: Record<string, number> = {
  'gpt-4-turbo-preview': 128000,
  'claude-3-5-sonnet-20241022': 200000,
  'gemini-1.5-pro': 1000000,
  'default': 128000,
};

function getContextLimit(model: string): number {
  return MODEL_LIMITS[model] || MODEL_LIMITS['default'];
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/**
 * GET /api/javari/chat-status
 * Get status for all user's chats or specific chat
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');
    const model = searchParams.get('model') || 'default';
    
    if (!userId && !conversationId) {
      return NextResponse.json({ error: 'userId or conversationId required' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const contextLimit = getContextLimit(model);
    
    if (conversationId) {
      // Get single chat status
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      
      const tokensUsed = data.context_tokens_used || 0;
      const percentage = Math.min(100, Math.round((tokensUsed / contextLimit) * 100));
      
      return NextResponse.json({
        id: data.id,
        title: data.title,
        isActive: data.is_active || false,
        contextTokensUsed: tokensUsed,
        contextTokensMax: contextLimit,
        contextPercentage: percentage,
        buildProgress: data.build_progress || 0,
        buildStatus: data.status_detail?.buildStatus || 'idle',
        continuationDepth: data.continuation_depth || 0,
        parentId: data.parent_id,
        rootConversationId: data.root_conversation_id,
        messageCount: data.message_count || 0,
        lastActivityAt: data.last_activity_at || data.updated_at,
        needsContinuation: percentage >= 85,
        warningLevel: percentage >= 85 ? 'critical' : percentage >= 70 ? 'warning' : 'none',
      });
    }
    
    // Get all user's chats with status
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }
    
    const chats = (data || []).map(conv => {
      const tokensUsed = conv.context_tokens_used || 0;
      const percentage = Math.min(100, Math.round((tokensUsed / contextLimit) * 100));
      
      return {
        id: conv.id,
        title: conv.title || 'Untitled',
        isActive: conv.is_active || false,
        contextTokensUsed: tokensUsed,
        contextTokensMax: contextLimit,
        contextPercentage: percentage,
        buildProgress: conv.build_progress || 0,
        buildStatus: conv.status_detail?.buildStatus || 'idle',
        continuationDepth: conv.continuation_depth || 0,
        parentId: conv.parent_id,
        rootConversationId: conv.root_conversation_id,
        messageCount: conv.message_count || 0,
        lastActivityAt: conv.last_activity_at || conv.updated_at,
        needsContinuation: percentage >= 85,
        warningLevel: percentage >= 85 ? 'critical' : percentage >= 70 ? 'warning' : 'none',
      };
    });
    
    return NextResponse.json({ chats, count: chats.length });
  } catch (error) {
    console.error('Chat status error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/javari/chat-status
 * Update chat status (context tokens, build progress, active state)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      conversationId, 
      userId,
      contextTokensUsed,
      buildProgress,
      buildStatus,
      isActive,
      messages, // Can recalculate tokens from messages
    } = body;
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const updates: any = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    
    // Calculate tokens from messages if provided
    if (messages && Array.isArray(messages)) {
      let totalTokens = 0;
      for (const msg of messages) {
        totalTokens += estimateTokens(msg.content || '');
        totalTokens += 4; // Overhead
      }
      updates.context_tokens_used = totalTokens;
      updates.message_count = messages.length;
    } else if (contextTokensUsed !== undefined) {
      updates.context_tokens_used = contextTokensUsed;
    }
    
    if (buildProgress !== undefined) {
      updates.build_progress = buildProgress;
    }
    
    if (buildStatus !== undefined) {
      updates.status_detail = { buildStatus };
    }
    
    if (isActive !== undefined) {
      updates.is_active = isActive;
      
      // If setting this chat active, deactivate others
      if (isActive && userId) {
        await supabase
          .from('conversations')
          .update({ is_active: false })
          .eq('user_id', userId)
          .neq('id', conversationId);
      }
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
    
    // Check if continuation needed
    const contextLimit = getContextLimit(data.model || 'default');
    const percentage = Math.round((data.context_tokens_used / contextLimit) * 100);
    
    return NextResponse.json({
      success: true,
      contextPercentage: percentage,
      needsContinuation: percentage >= 85,
      warningLevel: percentage >= 85 ? 'critical' : percentage >= 70 ? 'warning' : 'none',
    });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
