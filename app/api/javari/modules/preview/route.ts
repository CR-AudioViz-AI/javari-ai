// app/api/javari/modules/preview/route.ts
// Module Factory — Preview Endpoint
// POST: dry-run generation — returns all artifacts and validation without committing
// Safe to call repeatedly; no GitHub writes, no Supabase writes
// 2026-02-19 — TASK-P1-001

import { NextRequest, NextResponse } from 'next/server';
import { runModuleFactory, validateRequest } from '@/lib/javari/modules/engine';
import type { ModuleRequest, ModuleFile } from '@/lib/javari/modules/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// Strip secrets from file content before returning to client
function sanitizeContent(content: string): string {
  return content
    .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***')
    .replace(/sk-ant-[a-zA-Z0-9]{20,}/g, 'sk-ant-***REDACTED***')
    .replace(/eyJhbGci[a-zA-Z0-9._-]{20,}/g, '***JWT_REDACTED***');
}

function serializeFile(file: ModuleFile) {
  return {
    path: file.path,
    language: file.language,
    size: file.size,
    content: sanitizeContent(file.content),
    preview: sanitizeContent(file.content.slice(0, 500)) + (file.content.length > 500 ? '\n// ... truncated' : ''),
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  try {
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

    const moduleReq: ModuleRequest = {
      name: (body.name as string) ?? '',
      slug: (body.slug as string) ?? '',
      description: (body.description as string) ?? '',
      family: (body.family as ModuleRequest['family']) ?? 'creative-suite',
      types: (body.types as ModuleRequest['types']) ?? ['full-stack'],
      creditsPerUse: typeof body.creditsPerUse === 'number' ? body.creditsPerUse : 1,
      minPlan: (body.minPlan as ModuleRequest['minPlan']) ?? 'free',
      features: (body.features as string[]) ?? [],
      autoCommit: false, // Always false for preview
      autoDeploy: false, // Always false for preview
      generationModel: (body.generationModel as string) ?? 'gpt-4o',
    };

    // Validate request first — fast fail
    const reqValidation = validateRequest(moduleReq);
    if (!reqValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: reqValidation.errors },
        { status: 400 }
      );
    }

    // ── Dry run — generates artifacts + validation, NO commit/deploy/register
    const { module, pipeline } = await runModuleFactory(moduleReq, { dryRun: true });

    const totalMs = Date.now() - t0;
    const artifacts = module.artifacts;

    // ── Build file manifest ─────────────────────────────────────────────────
    const allFiles = [
      artifacts?.uiPage ? { label: 'UI Page', ...serializeFile(artifacts.uiPage) } : null,
      ...(artifacts?.uiComponents ?? []).map((f) => ({ label: 'UI Component', ...serializeFile(f) })),
      ...(artifacts?.apiRoutes ?? []).map((f) => ({ label: 'API Route', ...serializeFile(f) })),
      artifacts?.dbMigration ? { label: 'DB Migration', ...serializeFile(artifacts.dbMigration) } : null,
      artifacts?.registryEntry ? { label: 'Registry', ...serializeFile(artifacts.registryEntry) } : null,
      artifacts?.readme ? { label: 'README', ...serializeFile(artifacts.readme) } : null,
    ].filter((f): f is NonNullable<typeof f> => f !== null);

    return NextResponse.json({
      success: true,
      preview: true,
      module: {
        id: module.id,
        slug: moduleReq.slug,
        name: moduleReq.name,
        status: module.status,
        generationMs: module.generationMs,
      },
      validation: module.validation ? {
        passed: module.validation.passed,
        score: module.validation.score,
        errors: module.validation.errors,
        warnings: module.validation.warnings,
        checks: module.validation.checks,
        summary: module.validation.passed
          ? `✅ Validation passed (${module.validation.score}/100)`
          : `❌ Validation failed — ${module.validation.errors.length} error(s)`,
      } : null,
      version: module.version ? {
        semver: module.version.semver,
        changelog: module.version.changelog,
        checksum: module.version.checksum,
      } : null,
      dependencies: module.dependencies ?? [],
      files: allFiles,
      totalFiles: allFiles.length,
      totalSizeBytes: allFiles.reduce((acc, f) => acc + (f.size ?? 0), 0),
      pipeline,
      totalMs,
      instructions: module.validation?.passed
        ? `Preview complete. To commit and deploy, POST to /api/javari/modules/generate with autoCommit: true`
        : `Fix the ${module.validation?.errors.length} validation error(s) before generating`,
    });
  } catch (err) {
    console.error('[modules/preview] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Preview generation failed',
        totalMs: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/javari/modules/preview',
    description: 'Dry-run module generation — returns all artifacts and validation results without writing to GitHub',
    note: 'Safe to call repeatedly. No GitHub writes, no Supabase writes.',
    schema: {
      name: 'string',
      slug: 'string',
      description: 'string',
      family: 'ModuleFamily',
      types: 'ModuleType[]',
      creditsPerUse: 'number',
      minPlan: 'PricingTier',
    },
  });
}
