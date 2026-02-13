// app/api/universe/info/route.ts
// Universe-30 information endpoint

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getUniverseStats } from '@/lib/javari/multi-ai/router-universe';
import { getQuickStats, generateUniverseHealthReport } from '@/lib/javari/multi-ai/universe-health';
import { UNIVERSE_MODELS } from '@/lib/javari/multi-ai/model-registry-universe';

export async function GET(req: NextRequest) {
  try {
    const stats = getQuickStats();
    const universeStats = getUniverseStats();
    
    return NextResponse.json({
      status: 'operational',
      version: 'Universe-30',
      summary: {
        totalModels: stats.total,
        allFree: stats.allFree,
        providers: Object.keys(stats.byProvider).length,
        modelTypes: Object.keys(stats.byType).length
      },
      models: {
        byType: stats.byType,
        byProvider: stats.byProvider
      },
      availability: {
        chat: stats.byType.chat,
        code: stats.byType.code,
        summarize: stats.byType.summarize,
        classify: stats.byType.classify,
        embed: stats.byType.embed,
        translate: stats.byType.translate,
        math: stats.byType.math
      },
      features: [
        '30 free AI models',
        'Task-specific routing',
        'HuggingFace integration',
        'OpenRouter free tier',
        'Groq ultra-fast inference',
        'DeepSeek models',
        'Zero cost for all models'
      ],
      usage: {
        enableUniverse: 'Add useUniverse: true to request body',
        endpoint: '/api/multi/chat',
        example: {
          message: 'Your prompt',
          mode: 'single',
          useUniverse: true
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function POST(req: NextRequest) {
  try {
    const healthReport = await generateUniverseHealthReport();
    
    return NextResponse.json({
      status: 'health_report_generated',
      report: healthReport
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
