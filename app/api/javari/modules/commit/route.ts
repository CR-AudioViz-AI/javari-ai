// app/api/javari/modules/commit/route.ts
// Module Factory — Commit Endpoint
// POST: commit a previously generated (but not committed) module to GitHub
//       and optionally trigger Vercel deploy
// 2026-02-19 — TASK-P1-001

import { NextRequest, NextResponse } from 'next/server';
import { commitModule, triggerVercelDeploy, registerModuleInSupabase } from '@/lib/javari/modules/writer';
import { buildVersion, fetchPreviousVersion } from '@/lib/javari/modules/versioning';
import { generateModuleArtifacts } from '@/lib/javari/modules/generator';
import { validateModule } from '@/lib/javari/modules/validator';
import type { ModuleRequest } from '@/lib/javari/modules/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? 'prj_zxjzE2qvMWFWqV0AspGvago6aPV5';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? 'team_Z0yef7NlFu1coCJWz8UmUdI5';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const javariApiKey = process.env.JAVARI_API_KEY;

    const isAuthorized =
      (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (authHeader && javariApiKey && authHeader === `Bearer ${javariApiKey}`) ||
      process.env.NODE_ENV === 'development';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ── Parse ────────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // commit endpoint re-generates artifacts from the request spec
    // (idempotent — same request always produces same code structure)
    const moduleReq: ModuleRequest = {
      name: (body.name as string) ?? '',
      slug: (body.slug as string) ?? '',
      description: (body.description as string) ?? '',
      family: (body.family as ModuleRequest['family']) ?? 'creative-suite',
      types: (body.types as ModuleRequest['types']) ?? ['full-stack'],
      creditsPerUse: typeof body.creditsPerUse === 'number' ? body.creditsPerUse : 1,
      minPlan: (body.minPlan as ModuleRequest['minPlan']) ?? 'free',
      features: (body.features as string[]) ?? [],
      autoCommit: true,
      autoDeploy: (body.autoDeploy as boolean) ?? false,
    };

    const deploy = (body.deploy as boolean) ?? moduleReq.autoDeploy;

    if (!moduleReq.slug) {
      return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
    }

    // ── Generate artifacts ────────────────────────────────────────────────────
    console.info(`[modules/commit] Generating artifacts for ${moduleReq.slug}...`);
    const artifacts = await generateModuleArtifacts(moduleReq);

    // ── Validate before commit ────────────────────────────────────────────────
    const validation = validateModule(moduleReq, artifacts);
    if (!validation.passed) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed — fix errors before committing',
        validation: {
          errors: validation.errors,
          score: validation.score,
        },
      }, { status: 422 });
    }

    // ── Version ───────────────────────────────────────────────────────────────
    const previousVersion = await fetchPreviousVersion(moduleReq.slug);
    const version = await buildVersion(moduleReq.slug, artifacts, previousVersion);

    // ── Commit ────────────────────────────────────────────────────────────────
    console.info(`[modules/commit] Committing ${moduleReq.slug} v${version.semver}...`);
    const commit = await commitModule(moduleReq, artifacts, version.semver);

    // ── Deploy ────────────────────────────────────────────────────────────────
    let deployRecord = null;
    if (deploy) {
      console.info(`[modules/commit] Triggering Vercel deploy...`);
      deployRecord = await triggerVercelDeploy({
        projectId: VERCEL_PROJECT_ID,
        teamId: VERCEL_TEAM_ID,
      });
    }

    // ── Register ──────────────────────────────────────────────────────────────
    await registerModuleInSupabase(
      moduleReq,
      artifacts,
      version.semver,
      commit.sha,
      deployRecord?.url
    );

    const totalMs = Date.now() - t0;

    return NextResponse.json({
      success: true,
      slug: moduleReq.slug,
      version: version.semver,
      commit: {
        sha: commit.sha,
        url: commit.url,
        branch: commit.branch,
        files: commit.filesCommitted,
        timestamp: commit.timestamp,
      },
      deploy: deployRecord,
      validation: {
        score: validation.score,
        checks: validation.checks,
      },
      totalMs,
      message: `Module ${moduleReq.slug} committed${deploy ? ' and deploy triggered' : ''}. SHA: ${commit.sha.slice(0, 10)}`,
    });
  } catch (err) {
    console.error('[modules/commit] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Commit failed',
        totalMs: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/javari/modules/commit',
    description: 'Regenerate module artifacts from spec, validate, then commit to GitHub main branch',
    note: 'Requires module spec in body. Always validates before committing.',
    schema: {
      slug: 'string — required',
      name: 'string',
      description: 'string',
      family: 'ModuleFamily',
      types: 'ModuleType[]',
      creditsPerUse: 'number',
      minPlan: 'PricingTier',
      deploy: 'boolean — trigger Vercel deploy after commit (default: false)',
    },
  });
}
