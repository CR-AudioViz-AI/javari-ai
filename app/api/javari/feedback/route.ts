/**
 * Javari AI Learning & Feedback API
 * Collects user feedback to improve AI responses over time
 * 
 * @route /api/javari/feedback
 * @version 1.0.0
 * @last-updated 2025-10-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'flag' | 'rating' | 'comment';
type IssueCategory = 'accuracy' | 'helpfulness' | 'safety' | 'performance' | 'other';

interface SubmitFeedbackRequest {
  conversationId: string;
  userId?: string;
  feedbackType: FeedbackType;
  rating?: number; // 1-5
  comment?: string;
  responseText: string;
  userPrompt: string;
  modelUsed: string;
  issueCategory?: IssueCategory;
}

/**
 * POST /api/javari/feedback
 * Submit feedback on an AI response
 */
export async function POST(request: NextRequest) {
  try {
    const body: SubmitFeedbackRequest = await request.json();
    const {
      conversationId,
      userId = 'demo-user',
      feedbackType,
      rating,
      comment,
      responseText,
      userPrompt,
      modelUsed,
      issueCategory,
    } = body;

    // Validate required fields
    if (!conversationId || !feedbackType || !responseText || !userPrompt || !modelUsed) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, feedbackType, responseText, userPrompt, modelUsed' },
        { status: 400 }
      );
    }

    // Validate feedback type
    const validTypes: FeedbackType[] = ['thumbs_up', 'thumbs_down', 'flag', 'rating', 'comment'];
    if (!validTypes.includes(feedbackType)) {
      return NextResponse.json(
        { error: `Invalid feedback type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (feedbackType === 'rating') {
      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: 'Rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Save feedback to database
    const { data, error } = await supabase
      .from('javari_learning_feedback')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        feedback_type: feedbackType,
        rating: rating || null,
        comment: comment || null,
        response_text: responseText,
        user_prompt: userPrompt,
        model_used: modelUsed,
        issue_category: issueCategory || null,
        reviewed: false,
      })
      .select()
      .single();

    if (error) {
      logError('Feedback submission error:\', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // Log telemetry event
    try {
      await supabase.from('javari_telemetry').insert({
        user_id: userId,
        conversation_id: conversationId,
        event_type: 'feedback_submitted',
        event_category: 'user_action',
        event_data: {
          feedbackType: feedbackType,
          rating: rating,
          hasComment: !!comment,
        },
      });
    } catch (telemetryError) {
      console.error('Telemetry logging error:', telemetryError);
      // Don't fail the request if telemetry fails
    }

    return NextResponse.json({
      success: true,
      feedbackId: data.id,
      message: 'Thank you for your feedback! This helps Javari improve.',
    });
  } catch (error: unknown) {
    logError('Feedback error:\', error);
    return NextResponse.json(
      {
        error: 'Failed to process feedback',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/feedback
 * Get feedback for analysis (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const feedbackType = searchParams.get('feedbackType');
    const reviewed = searchParams.get('reviewed');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('javari_learning_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType);
    }

    if (reviewed !== null && reviewed !== undefined) {
      query = query.eq('reviewed', reviewed === 'true');
    }

    const { data: feedback, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total: feedback?.length || 0,
      thumbsUp: feedback?.filter(f => f.feedback_type === 'thumbs_up').length || 0,
      thumbsDown: feedback?.filter(f => f.feedback_type === 'thumbs_down').length || 0,
      avgRating: feedback && feedback.length > 0
        ? (feedback
            .filter(f => f.rating !== null)
            .reduce((sum, f) => sum + (f.rating || 0), 0) / 
           feedback.filter(f => f.rating !== null).length).toFixed(2)
        : 'N/A',
      unreviewed: feedback?.filter(f => !f.reviewed).length || 0,
    };

    return NextResponse.json({
      feedback: feedback || [],
      stats: stats,
    });
  } catch (error: unknown) {
    logError('Get feedback error:\', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feedback',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/feedback/:id
 * Mark feedback as reviewed and optionally add action taken
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get('id');

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reviewed, actionTaken } = body;

    const updateData: any = {};

    if (reviewed !== undefined) {
      updateData.reviewed = reviewed;
      if (reviewed) {
        updateData.reviewed_at = new Date().toISOString();
      }
    }

    if (actionTaken) {
      updateData.action_taken = actionTaken;
    }

    const { data, error } = await supabase
      .from('javari_learning_feedback')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      feedback: data,
    });
  } catch (error: unknown) {
    logError('Update feedback error:\', error);
    return NextResponse.json(
      {
        error: 'Failed to update feedback',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/feedback/insights
 * Get aggregated insights from feedback data
 */
export async function OPTIONS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const modelUsed = searchParams.get('model');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('javari_learning_feedback')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (modelUsed) {
      query = query.eq('model_used', modelUsed);
    }

    const { data: feedback, error } = await query;

    if (error) {
      throw error;
    }

    if (!feedback || feedback.length === 0) {
      return NextResponse.json({
        insights: {
          period: `Last ${days} days`,
          noData: true,
        },
      });
    }

    // Calculate insights
    const totalFeedback = feedback.length;
    const positiveCount = feedback.filter(
      f => f.feedback_type === 'thumbs_up' || (f.rating && f.rating >= 4)
    ).length;
    const negativeCount = feedback.filter(
      f => f.feedback_type === 'thumbs_down' || (f.rating && f.rating <= 2)
    ).length;

    const satisfactionRate = ((positiveCount / totalFeedback) * 100).toFixed(1);

    // Group by issue category
    const issuesByCategory = feedback
      .filter(f => f.issue_category)
      .reduce((acc, f) => {
        acc[f.issue_category!] = (acc[f.issue_category!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Get common themes from comments
    const commentsWithText = feedback.filter(f => f.comment && f.comment.length > 10);

    return NextResponse.json({
      insights: {
        period: `Last ${days} days`,
        totalFeedback: totalFeedback,
        satisfactionRate: `${satisfactionRate}%`,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        issuesByCategory: issuesByCategory,
        totalComments: commentsWithText.length,
        models: [...new Set(feedback.map(f => f.model_used))],
      },
    });
  } catch (error: unknown) {
    logError('Get insights error:\', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch insights',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
