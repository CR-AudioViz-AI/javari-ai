/**
 * Javari AI - Manual Self-Healing Trigger
 * Manually trigger a healing check cycle
 * 
 * Created: November 4, 2025 - 7:45 PM EST
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initializeAutonomousSystems } from '@/lib/autonomous';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      autoFixThreshold: 70
    });

    // Run healing cycle in background
    systems.selfHealing.runHealingCycle().catch(console.error);

    return NextResponse.json({
      success: true,
      message: 'Healing check triggered'
    });
  } catch (error) {
    console.error('Error triggering healing check:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger healing check' },
      { status: 500 }
    );
  }
}
