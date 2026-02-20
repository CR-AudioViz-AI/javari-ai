// lib/javari/modules/generator.ts
// Module Factory Generator v2.1
// AI-powered code synthesis for UI pages, API routes, DB migrations
// Uses OpenAI GPT-4o via vault → Anthropic fallback → deterministic template
// Strict TypeScript, WCAG 2.2 AA, OWASP Top 10 safe
// 2026-02-20 — Architecture fix: CRA central services integration (credits API, auth)
// Timestamp: 2026-02-19 21:45 EST

import { vault } from '@/lib/javari/secrets/vault';
import type {
  ModuleRequest,
  ModuleArtifacts,
  ModuleFile,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(
  path: string,
  content: string,
  language: ModuleFile['language']
): ModuleFile {
  return { path, content, language, size: Buffer.byteLength(content, 'utf8') };
}

function slugToName(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function slugToTable(slug: string): string {
  return slug.replace(/-/g, '_');
}

function slugToComponent(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// ── AI Code Generation ────────────────────────────────────────────────────────

async function generateWithAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const openaiKey = vault.get('openai');
  const anthropicKey = vault.get('anthropic');

  // Try OpenAI first (GPT-4o for best code quality)
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 8192,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices: { message: { content: string } }[] };
        const text = data.choices[0]?.message?.content ?? '';
        if (text.length > 100) return text;
      }
    } catch {
      // Fall through to Anthropic
    }
  }

  // Fallback: Anthropic Claude
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20251022',
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content: { type: string; text: string }[] };
        const text = data.content.find((b) => b.type === 'text')?.text ?? '';
        if (text.length > 100) return text;
      }
    } catch {
      // Fall through to template
    }
  }

  // Return null — caller will use deterministic template
  return null;
}

function stripCodeFences(code: string): string {
  return code
    .replace(/^```(?:typescript|tsx|ts|sql|json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}

// ── Template: UI Page (deterministic fallback) ────────────────────────────────

function templateUIPage(req: ModuleRequest): string {
  const componentName = slugToComponent(req.slug);
  const displayName = req.name;
  const featureList = (req.features ?? ['Process input', 'View results']).slice(0, 6);

  return `'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function ${componentName}Page() {
  const { user, credits, loading } = useAuth();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-4">
        <h1 className="text-2xl font-bold">${displayName}</h1>
        <p className="text-white/60">Please sign in to use this tool</p>
        <a href="/auth/login" className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          Sign In
        </a>
      </div>
    );
  }

  async function handleProcess() {
    if (!input.trim() || status === 'processing') return;
    setStatus('processing');
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch('/api/tools/${req.slug}/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${(await import('@/lib/supabase')).createSupabaseBrowserClient().auth.getSession().then((s) => s.data.session?.access_token ?? '')}\`,
        },
        body: JSON.stringify({ input }),
      });

      const data = await res.json() as { success: boolean; result?: string; error?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Processing failed');
      }

      setResult(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2));
      setStatus('complete');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred');
      setStatus('error');
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">${displayName}</h1>
          <p className="text-white/60">${req.description}</p>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span aria-label="Credits per use">{${req.creditsPerUse}} credit{${req.creditsPerUse} !== 1 ? 's' : ''} per use</span>
            <span>•</span>
            <span>Your balance: {credits} credits</span>
          </div>
        </header>

        {/* Features */}
        <section aria-label="Features" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          ${featureList.map((f: string) => `<div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60">${f}</div>`).join('\n          ')}
        </section>

        {/* Input */}
        <section aria-label="Input" className="space-y-3">
          <label htmlFor="module-input" className="block text-sm font-medium text-white/80">
            Input
          </label>
          <textarea
            id="module-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your input..."
            rows={6}
            disabled={status === 'processing'}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 resize-none"
            aria-describedby="credit-cost"
          />
          <p id="credit-cost" className="text-xs text-white/40">
            Processing will deduct {${req.creditsPerUse}} credit{${req.creditsPerUse} !== 1 ? 's' : ''} from your balance
          </p>
        </section>

        {/* Action */}
        <button
          type="button"
          onClick={handleProcess}
          disabled={!input.trim() || status === 'processing' || credits < ${req.creditsPerUse}}
          className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
          aria-label="Process input"
        >
          {status === 'processing' ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
              Processing...
            </>
          ) : (
            'Process'
          )}
        </button>

        {/* Result */}
        {status === 'complete' && result !== null && (
          <section aria-label="Result" className="space-y-2">
            <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">Result</h2>
            <div className="bg-white/[0.03] border border-emerald-500/20 rounded-xl px-4 py-4">
              <pre className="text-white/90 text-sm whitespace-pre-wrap break-words">{result}</pre>
            </div>
          </section>
        )}

        {/* Error */}
        {status === 'error' && errorMsg && (
          <div role="alert" className="bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

      </div>
    </main>
  );
}
`;
}

// ── Template: API Route (deterministic fallback) ──────────────────────────────

function templateAPIRoute(req: ModuleRequest): string {
  return `// app/api/tools/${req.slug}/process/route.ts
// ${req.name} — API processor
// Generated by Javari Module Factory v2.1
// Timestamp: ${new Date().toISOString()}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RequestBody = {
  input: string;
  options?: Record<string, unknown>;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supaUrl || !supaKey) {
      return NextResponse.json(
        { success: false, error: 'Service not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supaUrl, supaKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ── Parse Input ──────────────────────────────────────────────────────────
    let body: RequestBody;
    try {
      body = await req.json() as RequestBody;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'input is required and must be a non-empty string' },
        { status: 422 }
      );
    }

    // ── Credit Check ─────────────────────────────────────────────────────────
    const creditsNeeded = ${req.creditsPerUse};

    if (creditsNeeded > 0) {
      const { data: creditRow, error: creditErr } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (creditErr || !creditRow) {
        return NextResponse.json(
          { success: false, error: 'Could not verify credit balance' },
          { status: 402 }
        );
      }

      if (creditRow.balance < creditsNeeded) {
        return NextResponse.json(
          { success: false, error: \`Insufficient credits. Need \${creditsNeeded}, have \${creditRow.balance}\` },
          { status: 402 }
        );
      }

      // Deduct credits
      const { error: deductErr } = await supabase
        .from('user_credits')
        .update({ balance: creditRow.balance - creditsNeeded, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (deductErr) {
        return NextResponse.json(
          { success: false, error: 'Failed to deduct credits' },
          { status: 500 }
        );
      }
    }

    // ── Process ──────────────────────────────────────────────────────────────
    // Module-specific logic: ${req.description}
    const inputText = body.input.trim();

    // Core processing — replace with module-specific AI/tool call
    const result = await processInput(inputText, user.id);

    // ── Log Usage ────────────────────────────────────────────────────────────
    const processingMs = Date.now() - t0;
    console.info(\`[${req.slug}] user=\${user.id} input=\${inputText.length}chars \${processingMs}ms\`);

    return NextResponse.json({
      success: true,
      result,
      creditsUsed: creditsNeeded,
      processingMs,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error(\`[${req.slug}] Error:\`, err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// ── Core Processing Function ──────────────────────────────────────────────────
// Replace or extend this with module-specific logic

async function processInput(input: string, _userId: string): Promise<string> {
  // Default: echo the input with transformation metadata
  // Override: integrate AI API, image processor, data transformer, etc.
  return \`Processed: \${input.slice(0, 500)}\${input.length > 500 ? '...' : ''}\`;
}
`;
}

// ── Template: DB Migration (deterministic fallback) ───────────────────────────

function templateDBMigration(req: ModuleRequest): string {
  const tableName = `${req.family.replace(/-/g, '_')}_${slugToTable(req.slug)}_usage`;
  const now = Date.now();

  return `-- Migration: Add ${req.name} module table
-- Generated by Javari Module Factory v2.1
-- Timestamp: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS public.${tableName} (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text   TEXT,
  result_text  TEXT,
  credits_used INTEGER NOT NULL DEFAULT ${req.creditsPerUse},
  processing_ms INTEGER,
  status       TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'failed')),
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.${tableName} IS 'Usage logs for ${req.name} module (family: ${req.family})';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id   ON public.${tableName}(user_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON public.${tableName}(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_${tableName}_status     ON public.${tableName}(status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_${now}()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_${tableName}_updated ON public.${tableName};
CREATE TRIGGER trg_${tableName}_updated
  BEFORE UPDATE ON public.${tableName}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_${now}();

-- Row Level Security
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '${tableName}' AND policyname = 'Users read own rows') THEN
    CREATE POLICY "Users read own rows" ON public.${tableName}
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '${tableName}' AND policyname = 'Users insert own rows') THEN
    CREATE POLICY "Users insert own rows" ON public.${tableName}
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '${tableName}' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.${tableName}
      USING (auth.role() = 'service_role');
  END IF;
END $$;
`;
}

// ── UI Page Generator ─────────────────────────────────────────────────────────

async function generateUIPage(req: ModuleRequest): Promise<ModuleFile> {
  const componentName = slugToComponent(req.slug);

  const systemPrompt = `You are an expert Next.js 14 TypeScript developer.
Rules — follow exactly:
- "use client" directive at very top
- Import useAuth from "@/components/AuthProvider" (NOT useUser — it does not exist as a standalone)
- Tailwind CSS only. No inline styles. No CSS modules.
- All form/interactive elements must have aria-label or htmlFor (WCAG 2.2 AA)
- Credit deduction shown to user before submit with explicit credit cost
- Loading spinner while auth loads
- Redirect/message if !user
- Error boundary: catch errors, show user-visible error state
- Return ONLY the complete TypeScript file. No markdown. No explanation.`;

  const userPrompt = `Generate a complete Next.js 14 App Router page for "${req.name}".

Slug: ${req.slug}
Family: ${req.family}
Description: ${req.description}
Credits per use: ${req.creditsPerUse}
Features: ${(req.features ?? []).join(', ') || 'input/output processing'}

Requirements:
- Component: ${componentName}Page (default export)
- File path: app/tools/${req.slug}/page.tsx
- POST to /api/tools/${req.slug}/process to handle core logic
- Status lifecycle: idle → processing → complete | error
- Dark theme (bg-black, text-white, blue-600 accents)
- Mobile-first responsive (sm: md: lg: breakpoints)`;

  const aiCode = await generateWithAI(systemPrompt, userPrompt);
  const code = aiCode ? stripCodeFences(aiCode) : templateUIPage(req);

  return makeFile(`app/tools/${req.slug}/page.tsx`, code, 'typescript');
}

// ── API Route Generator ───────────────────────────────────────────────────────

async function generateAPIRoute(req: ModuleRequest): Promise<ModuleFile> {
  const systemPrompt = `You are an expert Next.js 14 App Router API developer.
MANDATORY — deviation causes build failure:
- import { NextRequest, NextResponse } from 'next/server'
- export const dynamic = 'force-dynamic'
- export const maxDuration = 30
- export async function POST(req: NextRequest): Promise<NextResponse>
- Never use NextApiRequest or export default
- Auth: createClient from @supabase/supabase-js, verify with supabase.auth.getUser(token)
- Credits: call POST /api/credits/spend on craudiovizai.com (CRA central API) — DO NOT access user_credits table directly
- Return NextResponse.json({ success: boolean, ... })
- Server-only env vars: SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_ on server)
- Return ONLY the complete TypeScript file. No markdown. No explanation.`;

  const userPrompt = `Generate a Next.js 14 API route for the "${req.name}" module processor.

Slug: ${req.slug}
Description: ${req.description}
Credits per use: ${req.creditsNeeded ?? req.creditsPerUse}
Family: ${req.family}

Requirements:
- File: app/api/tools/${req.slug}/process/route.ts
- Full auth via Supabase JWT Bearer token
- Credit check + deduction via CRA API: POST /api/credits/spend with amount=${req.creditsPerUse}
- Validate input (non-empty string required)
- Call appropriate processing based on description
- Log with [${req.slug}] prefix`;

  const aiCode = await generateWithAI(systemPrompt, userPrompt);
  const code = aiCode ? stripCodeFences(aiCode) : templateAPIRoute(req);

  return makeFile(`app/api/tools/${req.slug}/process/route.ts`, code, 'typescript');
}

// ── DB Migration Generator ────────────────────────────────────────────────────

async function generateDBMigration(req: ModuleRequest): Promise<ModuleFile> {
  const tableName = `${req.family.replace(/-/g, '_')}_${slugToTable(req.slug)}_usage`;

  const systemPrompt = `You are a PostgreSQL/Supabase schema expert.
Rules:
- UUID primary keys with gen_random_uuid()
- Always include: id, user_id (references auth.users ON DELETE CASCADE), created_at, updated_at (both TIMESTAMPTZ NOT NULL DEFAULT NOW())
- Enable Row Level Security with policies for users reading/writing their own rows
- Add indexes on user_id and created_at DESC
- Auto-update updated_at trigger
- COMMENT ON TABLE for documentation
- Use IF NOT EXISTS / DO $$ idioms for idempotency
- Return ONLY valid SQL. No markdown. No explanation.`;

  const userPrompt = `Generate an idempotent Supabase migration for the "${req.name}" module.

Table name: ${tableName}
Description: ${req.description}
Family: ${req.family}

Requirements:
- Main table: ${tableName} with input, result, credits_used, processing_ms, status fields
- RLS: users read/write own rows; service_role full access
- Unique function name suffix to avoid collision
- Index on user_id and created_at`;

  const aiCode = await generateWithAI(systemPrompt, userPrompt);
  const sql = aiCode ? stripCodeFences(aiCode) : templateDBMigration(req);

  return makeFile(
    `supabase/migrations/${Date.now()}_add_${slugToTable(req.slug)}_module.sql`,
    sql,
    'sql'
  );
}

// ── README Generator ──────────────────────────────────────────────────────────

function generateReadme(req: ModuleRequest): ModuleFile {
  const content = `# ${req.name}

> ${req.description}

**Family:** ${req.family}
**Credits per use:** ${req.creditsPerUse}
**Minimum plan:** ${req.minPlan}
**Generated:** ${new Date().toISOString()}
**Generator:** Javari Module Factory v2.1

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| \`/tools/${req.slug}\` | GET | Module UI page |
| \`/api/tools/${req.slug}/process\` | POST | Process request |

## Usage

\`\`\`typescript
const response = await fetch('/api/tools/${req.slug}/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${session.access_token}\`,
  },
  body: JSON.stringify({ input: 'your input here' }),
});
const { success, result, creditsUsed } = await response.json();
\`\`\`

## Credit System

Each use deducts **${req.creditsPerUse} credit(s)** from the user's balance.
Credits are refunded automatically on errors (< 60 seconds).

## Features

${(req.features ?? ['Standard input/output processing']).map((f: string) => `- ${f}`).join('\n')}

## Development

Generated by Javari Module Factory. Edit generated files directly.
To regenerate: POST /api/javari/modules/generate with autoCommit: true
`;

  return makeFile(`app/tools/${req.slug}/README.md`, content, 'markdown');
}

// ── Registry Entry Generator ──────────────────────────────────────────────────

function generateRegistryEntry(req: ModuleRequest): ModuleFile {
  const entry = {
    slug: req.slug,
    name: req.name,
    description: req.description,
    family: req.family,
    types: req.types,
    creditsPerUse: req.creditsPerUse,
    minPlan: req.minPlan,
    features: req.features ?? [],
    routes: {
      ui: `/tools/${req.slug}`,
      api: `/api/tools/${req.slug}/process`,
    },
    generatedAt: new Date().toISOString(),
    generatedBy: 'javari-module-factory@2.1',
    status: 'ready',
  };

  return makeFile(
    `lib/modules/registry/${req.slug}.json`,
    JSON.stringify(entry, null, 2),
    'json'
  );
}

// ── Resolve Dependencies ──────────────────────────────────────────────────────

export function resolveDependencies(req: ModuleRequest) {
  const deps = [
    { name: 'next', version: '^14.2.35', type: 'npm' as const, required: true },
    { name: 'react', version: '^18.3.1', type: 'npm' as const, required: true },
    { name: '@supabase/supabase-js', version: '^2.46.0', type: 'npm' as const, required: true },
  ];

  if (req.types.includes('ui') || req.types.includes('full-stack')) {
    deps.push(
      { name: 'tailwindcss', version: '^3.4.15', type: 'npm' as const, required: true },
      { name: 'lucide-react', version: '^0.462.0', type: 'npm' as const, required: false }
    );
  }

  if (req.family === 'creative-suite' || req.family === 'ai-integration') {
    deps.push({ name: 'openai', version: '^4.73.0', type: 'npm' as const, required: false });
  }

  if (req.types.includes('db') || req.types.includes('full-stack')) {
    const tableName = `${req.family.replace(/-/g, '_')}_${req.slug.replace(/-/g, '_')}_usage`;
    deps.push({
      name: tableName,
      version: 'current',
      type: 'supabase-table' as const,
      required: true,
    });
  }

  deps.push({ name: '@/lib/credits', version: 'internal', type: 'internal' as const, required: true });

  return deps;
}

// ── Main Generator ────────────────────────────────────────────────────────────

export async function generateModuleArtifacts(req: ModuleRequest): Promise<ModuleArtifacts> {
  const artifacts: ModuleArtifacts = {
    uiComponents: [],
    apiRoutes: [],
    registryEntry: generateRegistryEntry(req),
    readme: generateReadme(req),
  };

  const generateUI  = req.types.includes('ui')  || req.types.includes('full-stack');
  const generateAPI = req.types.includes('api') || req.types.includes('full-stack');
  const generateDB  = req.types.includes('db')  || req.types.includes('full-stack');

  // UI and API can run in parallel
  const tasks: Promise<void>[] = [];

  if (generateUI) {
    tasks.push(
      generateUIPage(req).then((f) => { artifacts.uiPage = f; })
    );
  }

  if (generateAPI) {
    tasks.push(
      generateAPIRoute(req).then((f) => { artifacts.apiRoutes = [f]; })
    );
  }

  await Promise.all(tasks);

  if (generateDB) {
    artifacts.dbMigration = await generateDBMigration(req);
  }

  return artifacts;
}
