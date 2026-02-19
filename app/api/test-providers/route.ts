// app/api/test-providers/route.ts
// Live provider health check — all keys via vault, no direct process.env.
// 2026-02-19 — Perplexity test redirected to OpenRouter (Cloudflare/Vercel IP fix)

import { NextResponse } from 'next/server';
import { vault } from '@/lib/javari/secrets/vault';

export const dynamic = 'force-dynamic';

interface TestResult {
  status: 'success' | 'error' | 'skipped';
  httpStatus?: number;
  message?: string;
  response?: string;
  model?: string;
  latencyMs?: number;
  keyHint?: string;
}

async function testProvider(
  name: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  responsePath: (d: Record<string, unknown>) => string,
  model: string,
  keyHint: string,
): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const text = await res.text();
      return { status: 'error', httpStatus: res.status, message: text.slice(0, 200), latencyMs, keyHint };
    }
    const data = await res.json() as Record<string, unknown>;
    return { status: 'success', response: responsePath(data), model, latencyMs, keyHint };
  } catch (e: unknown) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - start, keyHint };
  }
}

export async function GET() {
  const anthropicKey  = vault.get('anthropic')   ?? '';
  const openaiKey     = vault.get('openai')       ?? '';
  const openrouterKey = vault.get('openrouter')   ?? '';
  const mistralKey    = vault.get('mistral')      ?? '';
  const groqKey       = vault.get('groq')         ?? '';
  const xaiKey        = vault.get('xai')          ?? '';
  const fireworksKey  = vault.get('fireworks')    ?? '';
  const togetherKey   = vault.get('together')     ?? '';
  // Perplexity key kept for display/vault-status — routing now via OpenRouter
  const perplexityKey = vault.get('perplexity')  ?? '';

  const hint = (k: string) => k ? `...${k.slice(-4)}` : 'MISSING';

  const [claude, openai, perplexity, mistral, groq, openrouter] = await Promise.all([
    !anthropicKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'ANTHROPIC_API_KEY not in vault', keyHint: 'MISSING' })
      : testProvider(
          'Claude',
          'https://api.anthropic.com/v1/messages',
          { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          { model: 'claude-haiku-4-5-20251001', max_tokens: 30, messages: [{ role: 'user', content: 'Say "Claude works!" only.' }] },
          d => (d.content as Array<{text: string}>)?.[0]?.text ?? 'no response',
          'claude-haiku-4-5-20251001',
          hint(anthropicKey),
        ),

    !openaiKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'OPENAI_API_KEY not in vault', keyHint: 'MISSING' })
      : testProvider(
          'OpenAI',
          'https://api.openai.com/v1/chat/completions',
          { Authorization: `Bearer ${openaiKey}` },
          { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say "GPT works!" only.' }], max_tokens: 10 },
          d => (d.choices as Array<{message:{content:string}}>)?.[0]?.message?.content ?? 'no response',
          'gpt-4o-mini',
          hint(openaiKey),
        ),

    // ── Perplexity: routed via OpenRouter to bypass Cloudflare WAF blocking Vercel IPs ──
    // Direct api.perplexity.ai calls return 401 from all Vercel serverless IPs (known issue).
    // OpenRouter proxies perplexity/sonar-pro with identical functionality.
    !openrouterKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'OPENROUTER_API_KEY not in vault (needed for Perplexity routing)', keyHint: 'MISSING' })
      : testProvider(
          'Perplexity (via OpenRouter)',
          'https://openrouter.ai/api/v1/chat/completions',
          {
            Authorization: `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://craudiovizai.com',
            'X-Title': 'Javari AI',
          },
          { model: 'perplexity/sonar', messages: [{ role: 'user', content: 'Say "Perplexity works!" only.' }], max_tokens: 10 },
          d => (d.choices as Array<{message:{content:string}}>)?.[0]?.message?.content ?? 'no response',
          'perplexity/sonar (via openrouter)',
          hint(openrouterKey),
        ),

    !mistralKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'MISTRAL_API_KEY not in vault', keyHint: 'MISSING' })
      : testProvider(
          'Mistral',
          'https://api.mistral.ai/v1/chat/completions',
          { Authorization: `Bearer ${mistralKey}` },
          { model: 'mistral-small-latest', messages: [{ role: 'user', content: 'Say "Mistral works!" only.' }], max_tokens: 10 },
          d => (d.choices as Array<{message:{content:string}}>)?.[0]?.message?.content ?? 'no response',
          'mistral-small-latest',
          hint(mistralKey),
        ),

    !groqKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'GROQ_API_KEY not in vault', keyHint: 'MISSING' })
      : testProvider(
          'Groq',
          'https://api.groq.com/openai/v1/chat/completions',
          { Authorization: `Bearer ${groqKey}` },
          { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Say "Groq works!" only.' }], max_tokens: 10 },
          d => (d.choices as Array<{message:{content:string}}>)?.[0]?.message?.content ?? 'no response',
          'llama-3.1-8b-instant',
          hint(groqKey),
        ),

    !openrouterKey
      ? Promise.resolve<TestResult>({ status: 'skipped', message: 'OPENROUTER_API_KEY not in vault', keyHint: 'MISSING' })
      : testProvider(
          'OpenRouter',
          'https://openrouter.ai/api/v1/chat/completions',
          { Authorization: `Bearer ${openrouterKey}`, 'HTTP-Referer': 'https://craudiovizai.com', 'X-Title': 'Javari AI' },
          { model: 'deepseek/deepseek-chat', messages: [{ role: 'user', content: 'Say "OpenRouter works!" only.' }], max_tokens: 10 },
          d => (d.choices as Array<{message:{content:string}}>)?.[0]?.message?.content ?? 'no response',
          'deepseek/deepseek-chat',
          hint(openrouterKey),
        ),
  ]);

  const xaiStatus: TestResult      = xaiKey       ? { status: 'success', message: 'Key present in vault', keyHint: hint(xaiKey),       model: 'grok-beta' }     : { status: 'error', message: 'XAI_API_KEY not in vault',       keyHint: 'MISSING' };
  const fwStatus: TestResult       = fireworksKey  ? { status: 'success', message: 'Key present in vault', keyHint: hint(fireworksKey), model: 'fw/qwen2p5-72b' } : { status: 'error', message: 'FIREWORKS_API_KEY not in vault',  keyHint: 'MISSING' };
  const togetherStatus: TestResult = togetherKey   ? { status: 'success', message: 'Key present in vault', keyHint: hint(togetherKey),  model: 'tgp_v1' }         : { status: 'error', message: 'TOGETHER_API_KEY not in vault',   keyHint: 'MISSING' };

  const all = [claude, openai, perplexity, mistral, groq, openrouter, xaiStatus, fwStatus, togetherStatus];

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    vaultIntegrated: true,
    note: 'Perplexity routed via OpenRouter (Cloudflare/Vercel IP bypass)',
    tests: { claude, openai, perplexity, mistral, groq, openrouter, xai: xaiStatus, fireworks: fwStatus, together: togetherStatus },
    summary: {
      total:   all.length,
      success: all.filter(t => t.status === 'success').length,
      failed:  all.filter(t => t.status === 'error').length,
      skipped: all.filter(t => t.status === 'skipped').length,
    },
    vaultStatus: {
      anthropic:  hint(anthropicKey),
      openai:     hint(openaiKey),
      perplexity: perplexityKey ? `${hint(perplexityKey)} (direct disabled — routed via openrouter)` : 'MISSING (not needed)',
      mistral:    hint(mistralKey),
      groq:       hint(groqKey),
      openrouter: hint(openrouterKey),
      xai:        hint(xaiKey),
      fireworks:  hint(fireworksKey),
      together:   hint(togetherKey),
    },
  });
}
