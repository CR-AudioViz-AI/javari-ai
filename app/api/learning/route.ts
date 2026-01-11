/**
 * JAVARI LEARNING SYSTEM - API ROUTE
 * Stores successful interactions, learns patterns, improves over time
 * 
 * All utilities moved to lib/learning-utils.ts
 * Route exports ONLY: GET, POST
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Learning from '@/lib/learning-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const category = searchParams.get('category');
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (action === 'patterns') {
      const patterns = await Learning.getPatterns(category || undefined);
      return NextResponse.json({ success: true, patterns });
    }

    if (action === 'similar' && query) {
      const similar = await Learning.findSimilarQueries(query, limit);
      return NextResponse.json({ success: true, similar });
    }

    if (action === 'daily') {
      const summary = await Learning.getDailySummary();
      return NextResponse.json({ success: true, summary });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: patterns, similar, daily' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'log') {
      const success = await Learning.logInteraction(data as Learning.LearningEntry);
      return NextResponse.json({ success });
    }

    if (action === 'feedback') {
      const { interactionId, rating, feedback } = data;
      const success = await Learning.recordFeedback(interactionId, rating, feedback);
      return NextResponse.json({ success });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use: log, feedback' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
