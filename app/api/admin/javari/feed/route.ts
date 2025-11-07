/**
 * Javari AI - Manual Knowledge Feed API
 * Allows Roy to manually feed knowledge to Javari from admin dashboard
 * 
 * Created: November 4, 2025 - 7:10 PM EST
 */

import { NextResponse } from 'next/server';
import { initializeAutonomousSystems } from '@/lib/autonomous';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export async function POST(request: Request) {
  try {
    // Verify authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { topic, content, importance } = body;

    if (!topic || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, content' },
        { status: 400 }
      );
    }

    // Initialize learning system
    const systems = initializeAutonomousSystems({
      github: {
        token: process.env.GITHUB_TOKEN!,
        org: 'CR-AudioViz-AI',
        repo: 'crav-javari'
      },
      vercel: {
        token: process.env.VERCEL_TOKEN!,
        teamId: process.env.VERCEL_TEAM_ID!,
        projectId: process.env.VERCEL_PROJECT_ID!
      },
      openaiApiKey: process.env.OPENAI_API_KEY!,
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY!
      }
    });

    // Ingest knowledge
    const success = await systems.learning.ingestFromDashboard({
      topic,
      content,
      importance: importance || 'medium'
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Knowledge ingested successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to ingest knowledge' },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logError(\'Error feeding knowledge:\', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Verify authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize learning system
    const systems = initializeAutonomousSystems({
      github: {
        token: process.env.GITHUB_TOKEN!,
        org: 'CR-AudioViz-AI',
        repo: 'crav-javari'
      },
      vercel: {
        token: process.env.VERCEL_TOKEN!,
        teamId: process.env.VERCEL_TEAM_ID!,
        projectId: process.env.VERCEL_PROJECT_ID!
      },
      openaiApiKey: process.env.OPENAI_API_KEY!,
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY!
      }
    });

    // Get learning statistics
    const stats = await systems.learning.getStatistics();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: unknown) {
    logError(\'Error getting learning stats:\', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
