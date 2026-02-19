// app/api/javari/modules/generate/route.ts
// Module Factory — Full Generation Endpoint
// POST: run complete pipeline (generate → validate → version → [commit] → [deploy] → register)
// 2026-02-19 — TASK-P1-001

import { NextRequest, NextResponse } from 'next/server';
import { runModuleFactory, validateRequest } from '@/lib/javari/modules/engine';
import type { ModuleRequest } from '@/lib/javari/modules/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Generation can take 30-50s for full-stack modules

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  try {
    // ── Auth: verify this is an internal/admin request ──────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const javariApiKey = process.env.JAVARI_API_KEY;

    const isAuthorized =
      (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (authHeader && javariApiKey && authHeader === `Bearer ${javariApiKey}`) ||
      process.env.NODE_ENV === 'development';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — provide valid API key' },
        { status: 401 }
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // ── Validate required fields ────────────────────────────────────────────
    const moduleReq: ModuleRequest = {
      name: (body.name as string) ?? '',
      slug: (body.slug as string) ?? '',
      description: (body.description as string) ?? '',
      family: (body.family as ModuleRequest['family']) ?? 'creative-suite',
      types: (body.types as ModuleRequest['types']) ?? ['full-stack'],
      creditsPerUse: typeof body.creditsPerUse === 'number' ? body.creditsPerUse : 1,
      minPlan: (body.minPlan as ModuleRequest['minPlan']) ?? 'free',
      features: (body.features as string[]) ?? [],
      autoCommit: (body.autoCommit as boolean) ?? false,
      autoDeploy: (body.autoDeploy as boolean) ?? false,
      generationModel: (body.generationModel as string) ?? 'gpt-4o',
    };

    const reqValidation = validateRequest(moduleReq);
    if (!reqValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: reqValidation.errors },
        { status: 400 }
      );
    }

    // ── Run factory pipeline ────────────────────────────────────────────────
    const { module, pipeline } = await runModuleFactory(moduleReq, {
      dryRun: false,
      forceCommit: (body.forceCommit as boolean) ?? moduleReq.autoCommit,
      forceDeploy: (body.forceDeploy as boolean) ?? moduleReq.autoDeploy,
    });

    const totalMs = Date.now() - t0;

    if (!module.validation?.passed) {
      return NextResponse.json({
        success: false,
        error: 'Module validation failed',
        module: {
          id: module.id,
          slug: moduleReq.slug,
          status: module.status,
          validation: module.validation,
        },
        pipeline,
        totalMs,
      }, { status: 422 });
    }

    // ── Return full result ──────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      module: {
        id: module.id,
        slug: moduleReq.slug,
        name: moduleReq.name,
        status: module.status,
        version: module.version?.semver,
        validation: {
          passed: module.validation.passed,
          score: module.validation.score,
          errors: module.validation.errors,
          warnings: module.validation.warnings,
          checks: module.validation.checks,
        },
        artifacts: {
          files: [
            module.artifacts?.uiPage?.path,
            ...( module.artifacts?.apiRoutes.map((f) => f.path) ?? []),
            module.artifacts?.dbMigration?.path,
            module.artifacts?.registryEntry?.path,
            module.artifacts?.readme?.path,
          ].filter(Boolean),
          totalFiles: [
            module.artifacts?.uiPage,
            ...(module.artifacts?.uiComponents ?? []),
            ...(module.artifacts?.apiRoutes ?? []),
            module.artifacts?.dbMigration,
          ].filter(Boolean).length,
        },
        commit: module.commit ?? null,
        deploy: module.deploy ?? null,
        generationMs: module.generationMs,
      },
      pipeline,
      totalMs,
    });
  } catch (err) {
    console.error('[modules/generate] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Generation failed',
        totalMs: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/javari/modules/generate',
    description: 'Generate a complete module (UI + API + DB) autonomously',
    schema: {
      name: 'string — Human-readable module name',
      slug: 'string — URL slug (lowercase-hyphenated)',
      description: 'string — What the module does',
      family: 'creative-suite | business-intelligence | developer-tools | ai-integration | social-impact | gaming',
      types: 'Array<ui | api | db | full-stack>',
      creditsPerUse: 'number — Credits deducted per use (0-1000)',
      minPlan: 'free | starter | pro | enterprise',
      features: 'string[] — Optional feature list',
      autoCommit: 'boolean — Commit to GitHub after generation (default: false)',
      autoDeploy: 'boolean — Trigger Vercel deploy after commit (default: false)',
    },
    example: {
      name: 'Audio Visualizer',
      slug: 'audio-visualizer',
      description: 'Transform audio files into stunning visual waveforms and frequency spectrum displays',
      family: 'creative-suite',
      types: ['full-stack'],
      creditsPerUse: 2,
      minPlan: 'free',
      autoCommit: false,
    },
  });
}
