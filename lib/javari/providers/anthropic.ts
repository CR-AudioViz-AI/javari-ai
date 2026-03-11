// lib/javari/providers/anthropic.ts
// Purpose: Javari Anthropic provider adapter — generateText, generateJSON, generateCode.
// Date: 2026-03-11

import { getSecret } from "@/lib/platform-secrets/getSecret";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const TIMEOUT_MS    = 90_000;

async function apiKey(): Promise<string> {
  const key = await getSecret("ANTHROPIC_API_KEY").catch(() => "") || process.env.ANTHROPIC_API_KEY || "";
  if (!key) throw new Error("[anthropic] ANTHROPIC_API_KEY unavailable");
  return key;
}

async function call(model: string, system: string, prompt: string, maxTokens: number): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": await apiKey(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json() as { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } };
  return { content: d.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim(), tokensIn: d.usage?.input_tokens ?? 0, tokensOut: d.usage?.output_tokens ?? 0 };
}

export async function generateText(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const r = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI.", prompt, options?.maxTokens ?? 4096);
  return r.content;
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string; system?: string }): Promise<T> {
  const r = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI. Return only valid JSON.", `${prompt}\n\nRespond with valid JSON only.`, 4096);
  const clean = r.content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(clean) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const system = options?.system ?? "You are the Javari AI code generation engine. Return only code. No markdown fences.";
  const r = await call(options?.model ?? DEFAULT_MODEL, system, prompt, options?.maxTokens ?? 8000);
  // Strip any markdown fences that AI may include despite instructions
  return r.content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
