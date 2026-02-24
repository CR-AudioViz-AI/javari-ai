/**
 * POST /api/javari/credentials/register
 *
 * Register a new credential into the vault and push to all Vercel projects.
 * This is the permanent fix for "keys lost between sessions."
 *
 * CALL THIS whenever you get a new API key:
 *
 *   curl -X POST https://javari-ai.vercel.app/api/javari/credentials/register \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"key": "GEMINI_API_KEY", "value": "AIzaSy...", "note": "New key Jan 2026"}'
 *
 * Or register multiple at once:
 *   -d '{"credentials": [{"key":"K1","value":"V1"},{"key":"K2","value":"V2"}]}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoRegister } from '@/lib/javari/secrets/auto-register';

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    key?: string;
    value?: string;
    note?: string;
    projectIds?: string[];
    credentials?: Array<{ key: string; value: string; note?: string }>;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Single credential
  if (body.key && body.value) {
    const result = await autoRegister.add(body.key, body.value, {
      note: body.note,
      projectIds: body.projectIds,
    });
    return NextResponse.json({ success: true, result });
  }

  // Batch credentials
  if (body.credentials && Array.isArray(body.credentials)) {
    if (body.credentials.length === 0) {
      return NextResponse.json({ error: 'credentials array is empty' }, { status: 400 });
    }
    const results = await autoRegister.addBatch(body.credentials);
    return NextResponse.json({
      success: true,
      totalRegistered: results.length,
      totalProjectsUpdated: results.reduce((sum, r) => sum + r.projectsUpdated, 0),
      results,
    });
  }

  return NextResponse.json(
    { error: 'Provide either {key, value} or {credentials: [{key, value},...]}' },
    { status: 400 }
  );
}

// GET returns instructions for how to use this endpoint
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    endpoint: 'POST /api/javari/credentials/register',
    description: 'Permanently register a new API key into the vault across all 50 Vercel projects',
    usage: {
      single: { key: 'GEMINI_API_KEY', value: 'AIzaSy...', note: 'New key Feb 2026' },
      batch: {
        credentials: [
          { key: 'GEMINI_API_KEY', value: 'AIzaSy...', note: 'Feb 2026' },
          { key: 'SOME_OTHER_KEY', value: 'sk-...', note: 'Added manually' },
        ],
      },
    },
    auth: 'Bearer {CRON_SECRET}',
    behavior: [
      'Pushes key to ALL 50 Vercel projects for universal keys',
      'Pushes to javari-ai only for provider-specific keys',
      'Logs permanently to Supabase vault_registry table',
      'Clears vault cache so new key is available immediately',
      'Never fails silently — returns count of projects updated vs failed',
    ],
  });
}
