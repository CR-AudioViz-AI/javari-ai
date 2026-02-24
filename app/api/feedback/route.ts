// app/api/feedback/route.ts
// Javari AI Feedback API - Allows users to rate conversations
// Timestamp: 2025-11-29 15:45 UTC

import { NextRequest, NextResponse } from 'next/server';
import { learnFromConversation } from '@/lib/javari-learning';

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

    // Log feedback
    console.log('[Feedback] Received:', {
      conversationId,
      messageId,
      isHelpful,
      feedbackScore,
      hasUserMessage: !!userMessage,
      hasAssistantResponse: !!assistantResponse
    });

    // If positive feedback and we have the conversation content, enhance learning
    let learningResult = null;
    if (isHelpful && userMessage && assistantResponse) {
      try {
        learningResult = await learnFromConversation({
          conversationId: conversationId || `feedback_${Date.now()}`,
          userMessage,
          assistantResponse,
          wasHelpful: true,
          feedbackScore,
          solutionWorked: feedbackScore >= 4
        });
        
        if (learningResult.success) {
          console.log('[Feedback] Learning successful:', learningResult.knowledgeId);
        }
      } catch (learnError) {
        console.error('[Feedback] Learning error:', learnError);
      }
    }

    // If negative feedback, log for future improvements
    if (!isHelpful) {
      console.log('[Feedback] Negative feedback:', {
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
      knowledgeId: learningResult?.knowledgeId || null
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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Javari Feedback API',
    usage: {
      method: 'POST',
      body: {
        rating: 'Required - "helpful", "not_helpful", "thumbs_up", "thumbs_down", or number 1-5',
        conversationId: 'Optional - ID of the conversation',
        messageId: 'Optional - ID of the specific message',
        userMessage: 'Optional - The user message (for learning)',
        assistantResponse: 'Optional - The assistant response (for learning)',
        comment: 'Optional - Additional feedback text'
      },
      examples: [
        { rating: 'helpful' },
        { rating: 'thumbs_down', comment: 'Response was too long' },
        { rating: 5, userMessage: '...', assistantResponse: '...' }
      ]
    }
  });
}
