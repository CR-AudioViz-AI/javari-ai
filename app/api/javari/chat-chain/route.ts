// app/api/javari/chat-chain/route.ts
// Javari AI Chat Chain API - Breadcrumbs and auto-continuation
// Version: 1.0.0
// Timestamp: 2025-12-13 9:45 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/javari/chat-chain
 * Get the conversation chain (breadcrumbs) for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get current conversation to find root
    const { data: current } = await supabase
      .from('conversations')
      .select('id, parent_id, root_conversation_id')
      .eq('id', conversationId)
      .single();
    
    if (!current) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const rootId = current.root_conversation_id || conversationId;
    
    // Get all conversations in the chain
    const { data: chain, error } = await supabase
      .from('conversations')
      .select('id, title, message_count, continuation_depth, created_at, context_tokens_used, is_active')
      .or(`id.eq.${rootId},root_conversation_id.eq.${rootId}`)
      .order('continuation_depth', { ascending: true });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch chain' }, { status: 500 });
    }
    
    const breadcrumbs = (chain || []).map((conv, index) => ({
      id: conv.id,
      title: conv.title || `Chat ${index + 1}`,
      position: conv.continuation_depth || index,
      isCurrent: conv.id === conversationId,
      isActive: conv.is_active || false,
      messageCount: conv.message_count || 0,
      contextUsed: conv.context_tokens_used || 0,
      createdAt: conv.created_at,
    }));
    
    return NextResponse.json({
      chain: breadcrumbs,
      totalChats: breadcrumbs.length,
      currentPosition: breadcrumbs.find(b => b.isCurrent)?.position || 0,
      rootId,
    });
  } catch (error) {
    console.error('Chat chain error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/javari/chat-chain
 * Create a continuation conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentConversationId, userId, summary } = body;
    
    if (!parentConversationId || !userId) {
      return NextResponse.json({ error: 'parentConversationId and userId required' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get parent conversation
    const { data: parent } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', parentConversationId)
      .single();
    
    if (!parent) {
      return NextResponse.json({ error: 'Parent conversation not found' }, { status: 404 });
    }
    
    const rootId = parent.root_conversation_id || parent.id;
    const newDepth = (parent.continuation_depth || 0) + 1;
    
    // Generate summary from parent messages if not provided
    let contextSummary = summary;
    if (!contextSummary && parent.messages?.length) {
      const recentMessages = parent.messages.slice(-5);
      const topics = recentMessages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => m.content?.slice(0, 100))
        .join('; ');
      contextSummary = `Previous discussion topics: ${topics}`;
    }
    
    // Create continuation conversation
    const initialMessages = contextSummary ? [{
      role: 'system',
      content: `[Continuation from Chat ${newDepth}] ${contextSummary}`,
      timestamp: new Date().toISOString(),
    }] : [];
    
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        parent_id: parentConversationId,
        root_conversation_id: rootId,
        title: `${parent.title || 'Chat'} (Part ${newDepth + 1})`,
        messages: initialMessages,
        message_count: initialMessages.length,
        model: parent.model,
        status: 'active',
        continuation_depth: newDepth,
        is_active: true,
        context_tokens_used: contextSummary ? Math.ceil(contextSummary.length / 4) : 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create continuation:', error);
      return NextResponse.json({ error: 'Failed to create continuation' }, { status: 500 });
    }
    
    // Mark parent as inactive
    await supabase
      .from('conversations')
      .update({ 
        is_active: false,
        status_detail: { continuedTo: newConv.id }
      })
      .eq('id', parentConversationId);
    
    return NextResponse.json({
      success: true,
      newConversationId: newConv.id,
      continuationDepth: newDepth,
      parentId: parentConversationId,
      rootId,
    });
  } catch (error) {
    console.error('Create continuation error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
