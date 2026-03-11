// lib/javari/providers/ollama.ts
// Purpose: Javari Ollama local inference provider adapter.
// Date: 2026-03-11

const DEFAULT_MODEL = "llama3";
const BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

async function call(model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, options: { num_predict: maxTokens }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Ollama ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json() as { message: { content: string } };
  return d.message?.content?.trim() ?? "";
}

export async function generateText(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  return call(options?.model ?? DEFAULT_MODEL, options?.system ?? "You are Javari AI.", prompt, options?.maxTokens ?? 4096);
}

export async function generateJSON<T = unknown>(prompt: string, options?: { model?: string; system?: string }): Promise<T> {
  const raw = await call(options?.model ?? DEFAULT_MODEL, options?.system ?? "Return only valid JSON.", `${prompt}\n\nReturn only JSON.`, 4096);
  return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as T;
}

export async function generateCode(prompt: string, options?: { model?: string; system?: string; maxTokens?: number }): Promise<string> {
  const raw = await call(options?.model ?? "codellama", options?.system ?? "Return only code.", prompt, options?.maxTokens ?? 4096);
  return raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}
