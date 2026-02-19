// lib/javari/modules/generator.ts
// Module Factory Generator
// AI-powered code synthesis for UI pages, API routes, and DB migrations
// Uses OpenAI GPT-4o via vault — falls back to Anthropic
// Strict TypeScript, WCAG 2.2 AA, OWASP Top 10 safe
// 2026-02-19 — TASK-P1-001

import { vault } from '@/lib/javari/secrets/vault';
import type {
  ModuleRequest,
  ModuleArtifacts,
  ModuleFile,
  ModuleFamily,
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
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function slugToTable(slug: string): string {
  return slug.replace(/-/g, '_');
}

function slugToComponent(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// ── OpenAI JSON generation helper ─────────────────────────────────────────────

async function generateWithAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const openaiKey = vault.get('openai');
  const anthropicKey = vault.get('anthropic');

  // Try OpenAI first (GPT-4o for best code quality)
  if (openaiKey) {
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
        max_tokens: 4096,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message?.content ?? '';
    }
  }

  // Fallback: Anthropic Claude
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json() as { content: { type: string; text: string }[] };
      return data.content.find((b) => b.type === 'text')?.text ?? '';
    }
  }

  throw new Error('[Generator] No AI provider available for code generation');
}

// ── UI Page Generator ─────────────────────────────────────────────────────────

async function generateUIPage(req: ModuleRequest): Promise<ModuleFile> {
  const componentName = slugToComponent(req.slug);

  const systemPrompt = `You are an expert Next.js 14 TypeScript developer building platform modules for CR AudioViz AI.
Rules:
- "use client" at top
- Tailwind CSS only — no inline styles, no CSS modules  
- Import types explicitly, no implicit any
- All interactive elements have aria-label or aria-labelledby (WCAG 2.2 AA)
- Credit deduction: call POST /api/credits/deduct with { credits: ${req.creditsPerUse}, reason: "${req.slug}" }
- Auth check: import { useUser } from "@/components/AuthProvider" — redirect if !user
- Error boundary: wrap main content in try/catch with user-visible error state
- Loading state: show spinner while processing
- Return ONLY the complete TypeScript file content, no markdown fences`;

  const userPrompt = `Generate a complete Next.js page component for the "${req.name}" module.

Module details:
- Name: ${req.name}
- Slug: ${req.slug}  
- Family: ${req.family}
- Description: ${req.description}
- Credits per use: ${req.creditsPerUse}
- Features: ${(req.features ?? []).join(', ') || 'standard input/output'}

Requirements:
1. Component name: ${componentName}Page
2. File: app/tools/${req.slug}/page.tsx
3. Must have: title header, description, main interactive area, result display, credit cost indicator
4. Call POST /api/tools/${req.slug}/process to handle the core logic
5. Show real-time status (idle → processing → complete/error)
6. Mobile-first responsive layout (sm: md: lg: breakpoints)
7. Dark theme compatible (use Tailwind dark: variants)`;

  const code = await generateWithAI(systemPrompt, userPrompt);
  const cleaned = code.replace(/^```(?:typescript|tsx|ts)?\n?/m, '').replace(/\n?```$/m, '').trim();

  return makeFile(`app/tools/${req.slug}/page.tsx`, cleaned, 'typescript');
}

// ── API Route Generator ───────────────────────────────────────────────────────

async function generateAPIRoute(req: ModuleRequest): Promise<ModuleFile> {
  const systemPrompt = `You are an expert Next.js 14 API route developer.
Rules:
- export const dynamic = "force-dynamic"
- export const maxDuration = 30
- Auth check via Supabase: verify Bearer token in Authorization header
- Credit deduction BEFORE processing (fail fast if insufficient)
- Input validation: check all required fields, return 400 on missing
- Error responses: always { success: false, error: string }
- Success responses: always { success: true, result: ... }
- No hardcoded secrets — use process.env with NEXT_PUBLIC_ prefix only for public vars
- Rate limit awareness: return 429 with retry-after header if needed
- Return ONLY the complete TypeScript file content, no markdown fences`;

  const userPrompt = `Generate a Next.js API route for the "${req.name}" module processor.

Module details:
- Slug: ${req.slug}
- Description: ${req.description}
- Credits: ${req.creditsPerUse} per use
- Family: ${req.family}

Requirements:
1. File: app/api/tools/${req.slug}/process/route.ts
2. Export: POST handler
3. Auth: verify Supabase JWT from Authorization: Bearer header
4. Validate input body (JSON)
5. Deduct ${req.creditsPerUse} credits via internal credit service
6. Call appropriate AI/tool API based on the module description
7. Return structured result
8. Log errors to console with [${req.slug}] prefix`;

  const code = await generateWithAI(systemPrompt, userPrompt);
  const cleaned = code.replace(/^```(?:typescript|ts)?\n?/m, '').replace(/\n?```$/m, '').trim();

  return makeFile(`app/api/tools/${req.slug}/process/route.ts`, cleaned, 'typescript');
}

// ── DB Migration Generator ────────────────────────────────────────────────────

async function generateDBMigration(req: ModuleRequest): Promise<ModuleFile> {
  const tableName = slugToTable(req.slug);
  const tablePrefix = req.family.replace(/-/g, '_');

  const systemPrompt = `You are a PostgreSQL/Supabase schema expert.
Rules:
- All tables use UUID primary keys with gen_random_uuid()
- Always include: id, user_id (references auth.users), created_at, updated_at
- Enable Row Level Security (RLS) with sensible policies
- Add appropriate indexes for common query patterns
- Use timestamptz for all timestamps
- Return ONLY valid SQL, no markdown fences, no explanations`;

  const userPrompt = `Generate a Supabase migration for the "${req.name}" module.

Module details:
- Table name: ${tablePrefix}_${tableName}_usage
- Description: ${req.description}
- Family: ${req.family}

Requirements:
1. Main usage/results table: ${tablePrefix}_${tableName}_usage
2. Fields based on the module type (input params + output result + metadata)
3. RLS policies: users can only read/write their own rows
4. Index on user_id and created_at
5. Trigger to auto-update updated_at
6. Include COMMENT ON TABLE for documentation`;

  const sql = await generateWithAI(systemPrompt, userPrompt);
  const cleaned = sql.replace(/^```(?:sql)?\n?/m, '').replace(/\n?```$/m, '').trim();

  return makeFile(
    `supabase/migrations/${Date.now()}_add_${tableName}_module.sql`,
    cleaned,
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
**Generator:** Javari Module Factory v2.0

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
  body: JSON.stringify({ /* module-specific input */ }),
});
const { success, result } = await response.json();
\`\`\`

## Credit System

Each use deducts **${req.creditsPerUse} credit(s)** from the user's balance.  
Credits are refunded automatically on errors within 60 seconds.

## Features
${(req.features ?? ['Standard input/output processing']).map((f) => `- ${f}`).join('\n')}

## Development

Generated by Javari Module Factory. Edit generated files directly.  
Re-generation will overwrite only the registry entry, not hand-edited files.
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
    generatedBy: 'javari-module-factory@2.0',
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

  if (req.family === 'creative-suite') {
    deps.push({ name: 'openai', version: '^4.73.0', type: 'npm' as const, required: false });
  }

  if (req.types.includes('db') || req.types.includes('full-stack')) {
    const tableName = `${req.family.replace(/-/g, '_')}_${req.slug.replace(/-/g, '_')}_usage`;
    deps.push({ name: tableName, version: 'current', type: 'supabase-table' as const, required: true });
  }

  // Always need the credit system
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

  const generateUI = req.types.includes('ui') || req.types.includes('full-stack');
  const generateAPI = req.types.includes('api') || req.types.includes('full-stack');
  const generateDB = req.types.includes('db') || req.types.includes('full-stack');

  // Run in parallel where possible
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

  // DB runs sequentially (depends on req info only, but isolated)
  await Promise.all(tasks);

  if (generateDB) {
    artifacts.dbMigration = await generateDBMigration(req);
  }

  return artifacts;
}
