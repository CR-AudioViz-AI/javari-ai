// lib/javari/providers/mistral.ts
// Purpose: Javari Mistral provider adapter.
// Date: 2026-03-11

import { getSecret } from "@/lib/platform-secrets/getSecret";

const DEFAULT_MODEL = "mistral-small-latest";

async function apiKey(): Promise<string> {
  const key = await getSecret("MISTRAL_API_KEY").catch(() => "") || process.env.MISTRAL_API_KEY || "";
  if (!key) throw new Error("[mistral] MISTRAL_API_KEY unavailable");
  return key;
}

async function call(model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await apiKey()}` },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Mistral ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json() as { choices: Array<{ message: { content: string } }> };
  return d.choices[0]?.message?.content?.trim() ?? "";
}

export async function generateText(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  return call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI.", prompt, options?.maxTokens ?? 4096);
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string; system?: string }): Promise<T> {
  const raw = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "Return only valid JSON.", `${prompt}\n\nReturn only JSON.`, 4096);
  return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const raw = await call(options?.model ?? "codestral-latest", options?.system ?? "Return only code. No markdown.", prompt, options?.maxTokens ?? 4096);
  return raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
