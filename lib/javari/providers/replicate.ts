// lib/javari/providers/replicate.ts
// Purpose: Javari Replicate provider adapter.
// Date: 2026-03-11

import { getSecret } from "@/lib/platform-secrets/getSecret";

async function apiKey(): Promise<string> {
  const key = await getSecret("REPLICATE_API_TOKEN").catch(() => "") || process.env.REPLICATE_API_TOKEN || "";
  if (!key) throw new Error("[replicate] REPLICATE_API_TOKEN unavailable");
  return key;
}

async function call(version: string, prompt: string, maxTokens: number): Promise<string> {
  const key = await apiKey();
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Token ${key}` },
    body: JSON.stringify({ version, input: { prompt, max_new_tokens: maxTokens } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!createRes.ok) { const t = await createRes.text(); throw new Error(`Replicate create ${createRes.status}: ${t.slice(0, 200)}`); }
  const pred = await createRes.json() as { id: string; urls: { get: string } };
  const pollUrl = pred.urls?.get ?? `https://api.replicate.com/v1/predictions/${pred.id}`;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const p = await (await fetch(pollUrl, { headers: { "Authorization": `Token ${key}` } })).json() as { status: string; output?: string[] };
    if (p.status === "succeeded") return (Array.isArray(p.output) ? p.output.join("") : String(p.output ?? "")).trim();
    if (p.status === "failed" || p.status === "canceled") throw new Error(`Replicate ${p.status}`);
  }
  throw new Error("Replicate timed out");
}

export async function generateText(prompt: string, options?: { model?: string; maxTokens?: number }): Promise<string> {
  return call(options?.model ?? "meta/llama-2-70b-chat", prompt, options?.maxTokens ?? 2048);
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string }): Promise<T> {
  const raw = await call(options?.model ?? "meta/llama-2-70b-chat", `${prompt}\n\nReturn only JSON.`, 2048);
  return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; maxTokens?: number }): Promise<string> {
  const raw = await call(options?.model ?? "meta/codellama-70b-instruct", prompt, options?.maxTokens ?? 4096);
  return raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
