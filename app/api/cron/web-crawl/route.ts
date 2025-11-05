/**
 * Javari AI - Web Crawl Cron Route
 * Runs daily at 6 AM to crawl AI news and best practices
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

    console.log('🕷️ Starting web crawl cycle...');

    // Initialize autonomous systems with crawl targets
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
      crawlTargets: [
        { url: 'https://openai.com/blog', category: 'ai_news', frequency: 'daily' },
        { url: 'https://www.anthropic.com/news', category: 'ai_news', frequency: 'daily' },
        { url: 'https://blog.google/technology/ai/', category: 'ai_news', frequency: 'daily' },
        { url: 'https://nextjs.org/blog', category: 'best_practices', frequency: 'weekly' },
        { url: 'https://react.dev/blog', category: 'best_practices', frequency: 'weekly' },
        { url: 'https://www.typescriptlang.org/docs/handbook/release-notes/overview.html', category: 'best_practices', frequency: 'weekly' }
      ]
    });

    // Run scheduled crawls
    await systems.learning.runScheduledCrawls();

    // Get statistics
    const stats = await systems.learning.getStatistics();

    console.log('✅ Web crawl cycle complete:', stats);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    console.error('❌ Web crawl cycle failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
