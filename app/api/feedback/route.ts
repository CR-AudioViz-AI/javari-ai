// app/api/feedback/route.ts
// Javari AI Feedback API - Handle user feedback on conversations
// Timestamp: 2025-11-29 15:45 UTC

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
      rating, // 'up' | 'down' | 1-5 scale
      userMessage,
      assistantResponse,
      feedbackText
    } = body;

    if (!conversationId || rating === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId and rating' },
        { status: 400 }
      );
    }

    // Normalize rating to boolean for learning
    const wasHelpful = rating === 'up' || rating === 'helpful' || 
                       (typeof rating === 'number' && rating >= 3);
    const solutionWorked = rating === 'up' || rating === 'helpful' ||
                          (typeof rating === 'number' && rating >= 4);

    // Store feedback in database (if table exists)
    // Note: conversation_feedback table may need to be created
    try {
      const { error: feedbackError } = await supabase
        .from('conversation_feedback')
        .insert({
          conversation_id: conversationId,
          message_id: messageId || null,
          rating: typeof rating === 'number' ? rating : (wasHelpful ? 5 : 1),
          rating_type: typeof rating === 'string' ? rating : 'numeric',
          feedback_text: feedbackText || null,
          user_message_preview: userMessage?.substring(0, 200) || null,
          created_at: new Date().toISOString()
        });

      if (feedbackError) {
        console.log('Feedback storage skipped (table may not exist):', feedbackError.message);
      }
    } catch (dbError) {
      console.log('Feedback storage not available:', dbError);
      // Continue anyway - feedback storage is not critical
    }

    // If we have the conversation content and it was helpful, trigger learning
    let learningResult = null;
    if (userMessage && assistantResponse && wasHelpful) {
      learningResult = await learnFromConversation({
        conversationId,
        userMessage,
        assistantResponse,
        wasHelpful,
        feedbackScore: typeof rating === 'number' ? rating : (wasHelpful ? 5 : 1),
        solutionWorked
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded',
      wasHelpful,
      learning: learningResult ? {
        triggered: true,
        success: learningResult.success,
        knowledgeId: learningResult.knowledgeId
      } : {
        triggered: false,
        reason: !userMessage || !assistantResponse 
          ? 'Missing conversation content' 
          : 'Negative feedback - not learning'
      }
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({
      success: true,
      message: 'Javari Feedback API',
      endpoints: {
        'POST /api/feedback': {
          description: 'Submit feedback for a conversation',
          required: ['conversationId', 'rating'],
          optional: ['messageId', 'userMessage', 'assistantResponse', 'feedbackText'],
          ratingOptions: {
            thumbs: ['up', 'down'],
            stars: '1-5 numeric scale'
          },
          note: 'Positive feedback triggers learning if conversation content is provided'
        },
        'GET /api/feedback?conversationId=xxx': {
          description: 'Get feedback for a specific conversation'
        }
      }
    });
  }

  try {
    const { data: feedback, error } = await supabase
      .from('conversation_feedback')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversationId,
      feedback: feedback || []
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
