/**
 * Javari AI - Self-Healing Cron Route
 * Runs every 30 minutes to detect and fix errors
 * 
 * Created: November 4, 2025 - 7:10 PM EST
 */

import { NextResponse } from 'next/server';
import { initializeAutonomousSystems } from '@/lib/autonomous';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🏥 Starting self-healing cycle...');

    // Initialize autonomous systems
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
      },
      autoFixThreshold: 70,
      notificationWebhook: process.env.NOTIFICATION_WEBHOOK
    });

    // Run healing cycle
    await systems.selfHealing.runHealingCycle();

    // Get statistics
    const stats = systems.selfHealing.getStatistics();

    console.log('✅ Self-healing cycle complete:', stats);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    console.error('❌ Self-healing cycle failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
