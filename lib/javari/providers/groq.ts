// lib/javari/providers/groq.ts
// Purpose: Javari Groq provider adapter — ultra-fast inference.
// Date: 2026-03-11

import { getSecret } from "@/lib/platform-secrets/getSecret";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

async function apiKey(): Promise<string> {
  const key = await getSecret("GROQ_API_KEY").catch(() => "") || process.env.GROQ_API_KEY || "";
  if (!key) throw new Error("[groq] GROQ_API_KEY unavailable");
  return key;
}

async function call(model: string, system: string, prompt: string, maxTokens: number, json: boolean): Promise<string> {
  const body: Record<string, unknown> = {
    model, max_tokens: Math.min(maxTokens, 8192),
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await apiKey()}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Groq ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json() as { choices: Array<{ message: { content: string } }> };
  return d.choices[0]?.message?.content?.trim() ?? "";
}

export async function generateText(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  return call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI.", prompt, options?.maxTokens ?? 4096, false);
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string; system?: string }): Promise<T> {
  const raw = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "Return only valid JSON.", prompt, 4096, true);
  return JSON.parse(raw) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const raw = await call(options?.model ?? "llama-3.3-70b-versatile", options?.system ?? "Return only code.", prompt, options?.maxTokens ?? 8192, false);
  return raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
