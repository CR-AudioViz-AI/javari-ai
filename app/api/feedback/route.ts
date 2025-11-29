// app/api/feedback/route.ts
// Javari AI Feedback API - Allows users to rate conversations
// Timestamp: 2025-11-29 15:42 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { learnFromConversation } from '@/lib/javari-learning';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      conversationId,
      messageId,
      rating, // 'helpful' | 'not_helpful' | number (1-5)
      userMessage,
      assistantResponse,
      comment
    } = body;

    // Validate required fields
    if (!rating) {
      return NextResponse.json(
        { error: 'Missing required field: rating' },
        { status: 400 }
      );
    }

    // Normalize rating to boolean and score
    let isHelpful: boolean;
    let feedbackScore: number;

    if (typeof rating === 'number') {
      feedbackScore = Math.min(5, Math.max(1, rating));
      isHelpful = feedbackScore >= 3;
    } else if (rating === 'helpful' || rating === 'thumbs_up' || rating === 'up') {
      isHelpful = true;
      feedbackScore = 5;
    } else if (rating === 'not_helpful' || rating === 'thumbs_down' || rating === 'down') {
      isHelpful = false;
      feedbackScore = 1;
    } else {
      return NextResponse.json(
        { error: 'Invalid rating value. Use "helpful", "not_helpful", or a number 1-5' },
        { status: 400 }
      );
    }

    // Store feedback in database
    const feedbackRecord = {
      conversation_id: conversationId || null,
      message_id: messageId || null,
      rating: rating,
      is_helpful: isHelpful,
      feedback_score: feedbackScore,
      comment: comment || null,
      user_message_preview: userMessage ? userMessage.substring(0, 200) : null,
      assistant_response_preview: assistantResponse ? assistantResponse.substring(0, 200) : null,
      created_at: new Date().toISOString()
    };

    // Try to store in feedback table (if it exists)
    try {
      await supabase
        .from('conversation_feedback')
        .insert(feedbackRecord);
    } catch (dbError) {
      // Table might not exist yet - that's OK, we'll still process the learning
      console.log('Feedback table not available, continuing with learning...');
    }

    // If positive feedback and we have the conversation content, enhance learning
    let learningResult = null;
    if (isHelpful && userMessage && assistantResponse) {
      learningResult = await learnFromConversation({
        conversationId: conversationId || `feedback_${Date.now()}`,
        userMessage,
        assistantResponse,
        wasHelpful: true,
        feedbackScore,
        solutionWorked: feedbackScore >= 4
      });
    }

    // If negative feedback, we could use this to improve
    // For now, just log it
    if (!isHelpful) {
      console.log('[Feedback] Negative feedback received:', {
        conversationId,
        messageId,
        feedbackScore,
        comment,
        userMessagePreview: userMessage?.substring(0, 100)
      });
    }

    return NextResponse.json({
      success: true,
      message: `Feedback recorded: ${isHelpful ? 'helpful' : 'not helpful'}`,
      learningTriggered: !!learningResult?.success,
      knowledgeId: learningResult?.knowledgeId
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process feedback',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Javari Feedback API',
    usage: {
      method: 'POST',
      body: {
        rating: 'Required - "helpful", "not_helpful", or number 1-5',
        conversationId: 'Optional - ID of the conversation',
        messageId: 'Optional - ID of the specific message',
        userMessage: 'Optional - The user message (for learning)',
        assistantResponse: 'Optional - The assistant response (for learning)',
        comment: 'Optional - Additional feedback text'
      },
      examples: [
        { rating: 'helpful' },
        { rating: 'not_helpful', comment: 'Response was too long' },
        { rating: 5, userMessage: '...', assistantResponse: '...' }
      ]
    }
  });
}
