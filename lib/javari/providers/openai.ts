// lib/javari/providers/openai.ts
// Purpose: Javari OpenAI provider adapter — generateText, generateJSON, generateCode.
// Date: 2026-03-11

import { getSecret } from "@/lib/platform-secrets/getSecret";

const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS    = 60_000;

async function apiKey(): Promise<string> {
  const key = await getSecret("OPENAI_API_KEY").catch(() => "") || process.env.OPENAI_API_KEY || "";
  if (!key) throw new Error("[openai] OPENAI_API_KEY unavailable");
  return key;
}

async function call(model: string, system: string, prompt: string, maxTokens: number, json: boolean): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const body: Record<string, unknown> = {
    model, max_tokens: maxTokens,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await apiKey()}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
  return { content: d.choices[0]?.message?.content?.trim() ?? "", tokensIn: d.usage?.prompt_tokens ?? 0, tokensOut: d.usage?.completion_tokens ?? 0 };
}

export async function generateText(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  return (await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI.", prompt, options?.maxTokens ?? 4096, false)).content;
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string; system?: string }): Promise<T> {
  const r = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI. Return only valid JSON.", prompt, 4096, true);
  return JSON.parse(r.content) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const r = await call(options?.model ?? "gpt-4o", options?.system ?? "Return only code. No markdown.", prompt, options?.maxTokens ?? 4096, false);
  return r.content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
