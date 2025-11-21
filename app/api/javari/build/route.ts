import { NextRequest, NextResponse } from 'next/server';
import AutonomousBuilder from '@/lib/autonomous/autonomous-builder';

export async function POST(request: NextRequest) {
  try {
    const { task } = await request.json();

    if (!task || !task.description || !task.type) {
      return NextResponse.json(
        { error: 'Missing required fields: task.description, task.type' },
        { status: 400 }
      );
    }

    // Initialize autonomous builder
    const builder = new AutonomousBuilder({
      githubToken: process.env.GITHUB_TOKEN!,
      githubOrg: 'CR-AudioViz-AI',
      githubRepo: task.repo || 'crav-javari',
      vercelToken: process.env.VERCEL_TOKEN!,
      vercelTeamId: process.env.VERCEL_TEAM_ID!,
      vercelProjectId: process.env.VERCEL_PROJECT_ID!,
      openaiKey: process.env.OPENAI_API_KEY!,
      claudeKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Execute autonomous build
    const result = await builder.build({
      id: task.id || `task-${Date.now()}`,
      description: task.description,
      type: task.type,
      priority: task.priority || 'medium',
      requirements: task.requirements,
      context: task.context,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ready',
    message: 'Javari Autonomous Builder is operational',
    capabilities: [
      'Task interpretation',
      'Build planning',
      'Code generation',
      'GitHub commits',
      'Vercel deployment',
      'Self-validation',
    ],
  });
}
