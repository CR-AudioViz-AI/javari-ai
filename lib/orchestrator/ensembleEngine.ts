// lib/orchestrator/ensembleEngine.ts
// Purpose: Runs multiple AI models in parallel and aggregates outputs using
//          majority_vote, confidence scoring, or weighted_ranking. Returns the
//          best answer from the ensemble with a consensus score.
// Date: 2026-03-07

import { OrchestratorModel } from "./modelRegistry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface EnsembleInput {
  prompt       : string;
  models       : OrchestratorModel[];
  taskType     : string;
  apiKeys      : Record<string, string>;
  timeoutMs?   : number;
  aggregation? : "majority_vote" | "confidence" | "weighted_ranking" | "fastest";
}

export interface ModelResponse {
  model_id   : string;
  provider   : string;
  content    : string;
  latency_ms : number;
  cost_usd   : number;
  success    : boolean;
  score      : number;
  error?     : string;
}

export interface EnsembleResult {
  finalAnswer     : string;
  winningModel    : string;
  winningProvider : string;
  aggregation     : string;
  confidence      : number;
  modelResponses  : ModelResponse[];
  successCount    : number;
  failureCount    : number;
  totalCostUsd    : number;
  totalLatencyMs  : number;
  consensusScore  : number;
}

// ── Single model caller ────────────────────────────────────────────────────

async function callModel(
  model    : OrchestratorModel,
  prompt   : string,
  apiKeys  : Record<string, string>,
  timeout  : number
): Promise<ModelResponse> {
  const t0     = Date.now();
  const apiKey = apiKeys[model.provider]
    ?? process.env[`${model.provider.toUpperCase()}_API_KEY`] ?? "";

  if (!apiKey && model.cost_per_1k_tokens > 0) {
    return { model_id:model.id, provider:model.provider, content:"", latency_ms:0,
      cost_usd:0, success:false, score:0, error:`No API key for ${model.provider}` };
  }

  try {
    let content = "";
    const messages = [{ role:"user" as const, content: prompt }];

    const oa = async (url: string, key: string) => {
      const res = await fetch(url, {
        method:"POST",
        headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json",
          ...(model.provider === "openrouter" ? { "HTTP-Referer":"https://craudiovizai.com" } : {}) },
        body: JSON.stringify({ model:model.model_id, messages, max_tokens:1024 }),
        signal: AbortSignal.timeout(timeout),
      });
      const d = await res.json() as { choices?:Array<{message?:{content?:string}}>; error?:{message?:string} };
      if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
      return d.choices?.[0]?.message?.content ?? "";
    };

    switch (model.provider) {
      case "groq"      : content = await oa("https://api.groq.com/openai/v1/chat/completions",  apiKey); break;
      case "openrouter": content = await oa("https://openrouter.ai/api/v1/chat/completions",    apiKey); break;
      case "openai"    : content = await oa("https://api.openai.com/v1/chat/completions",       apiKey); break;
      case "deepseek"  : content = await oa("https://api.deepseek.com/chat/completions",        apiKey); break;
      case "mistral"   : content = await oa("https://api.mistral.ai/v1/chat/completions",       apiKey); break;
      case "together"  : content = await oa("https://api.together.xyz/v1/chat/completions",     apiKey); break;
      case "fireworks" : content = await oa("https://api.fireworks.ai/inference/v1/chat/completions", apiKey); break;
      case "xai"       : content = await oa("https://api.x.ai/v1/chat/completions",             apiKey); break;
      case "perplexity": content = await oa("https://api.perplexity.ai/chat/completions",       apiKey); break;
      case "cohere"    : content = await oa("https://api.cohere.ai/compatibility/v1/chat/completions", apiKey); break;
      case "anthropic" : {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{ "x-api-key":apiKey, "anthropic-version":"2023-06-01", "Content-Type":"application/json" },
          body: JSON.stringify({ model:model.model_id, max_tokens:1024, messages }),
          signal: AbortSignal.timeout(timeout),
        });
        const d = await res.json() as { content?:Array<{text?:string}>; error?:{message?:string} };
        if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
        content = d.content?.[0]?.text ?? ""; break;
      }
      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${apiKey}`,
          { method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:1024} }),
            signal: AbortSignal.timeout(timeout) }
        );
        const d = await res.json() as { candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>; error?:{message?:string} };
        if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
        content = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ""; break;
      }
      default: content = await oa("https://openrouter.ai/api/v1/chat/completions", apiKey);
    }

    const latencyMs    = Date.now() - t0;
    const promptTok    = Math.ceil(prompt.length / 4);
    const outputTok    = Math.ceil(content.length / 4);
    const costUsd      = (promptTok + outputTok) / 1000 * model.cost_per_1k_tokens;
    const hasContent   = content.trim().length > 5;
    const score        = Math.round(Math.min(100,
      (hasContent ? 30 : 0) + Math.min(content.length / 5, 40) + Math.max(0, 30 - latencyMs / 150)
    ));
    return { model_id:model.id, provider:model.provider, content, latency_ms:latencyMs,
      cost_usd:costUsd, success:true, score };

  } catch (err) {
    return { model_id:model.id, provider:model.provider, content:"",
      latency_ms:Date.now()-t0, cost_usd:0, success:false, score:0, error:String(err) };
  }
}

// ── Aggregation ────────────────────────────────────────────────────────────

function aggregateConfidence(responses: ModelResponse[]): { answer:string; confidence:number; winnerIdx:number } {
  if (!responses.length) return { answer:"", confidence:0, winnerIdx:0 };
  const sorted = [...responses].sort((a,b) => b.score - a.score);
  const best   = sorted[0];
  const mean   = responses.reduce((s,r)=>s+r.score,0) / responses.length;
  const confidence = Math.min(100, Math.round(best.score / Math.max(1, mean) * 70) + 20);
  return { answer:best.content, confidence, winnerIdx:responses.findIndex(r=>r.model_id===best.model_id) };
}

function aggregateMajorityVote(responses: ModelResponse[]): { answer:string; confidence:number; winnerIdx:number } {
  if (!responses.length) return { answer:"", confidence:0, winnerIdx:0 };
  const support = responses.map(r => ({ r, support:0 }));
  for (const a of responses) {
    for (const b of responses) {
      if (a.model_id === b.model_id || !a.content || !b.content) continue;
      const wa = new Set(a.content.toLowerCase().split(/\s+/).slice(0,50));
      const wb = new Set(b.content.toLowerCase().split(/\s+/).slice(0,50));
      const inter = [...wa].filter(w=>wb.has(w)).length;
      const union = new Set([...wa,...wb]).size;
      if (union > 0 && inter/union > 0.3) {
        const g = support.find(s=>s.r.model_id===a.model_id);
        if (g) g.support++;
      }
    }
  }
  const winner = [...support].sort((a,b)=>b.support-a.support)[0];
  const confidence = Math.min(100, 40 + winner.support * 15);
  return { answer:winner.r.content, confidence, winnerIdx:responses.findIndex(r=>r.model_id===winner.r.model_id) };
}

function aggregateFastest(responses: ModelResponse[]): { answer:string; confidence:number; winnerIdx:number } {
  const ok = responses.filter(r=>r.success&&r.content);
  if (!ok.length) return { answer:"", confidence:0, winnerIdx:0 };
  const fastest = ok.sort((a,b)=>a.latency_ms-b.latency_ms)[0];
  return { answer:fastest.content, confidence:60, winnerIdx:responses.findIndex(r=>r.model_id===fastest.model_id) };
}

function aggregateWeightedRanking(responses: ModelResponse[]): { answer:string; confidence:number; winnerIdx:number } {
  if (!responses.length) return { answer:"", confidence:0, winnerIdx:0 };
  // Weight: score × reliability (inverse of cost) × speed bonus
  const maxCost   = Math.max(...responses.map(r=>r.cost_usd), 0.001);
  const maxLat    = Math.max(...responses.map(r=>r.latency_ms), 1);
  const weighted  = responses.map(r => ({
    r,
    w: r.score * (1 - r.cost_usd / maxCost * 0.3) * (1 - r.latency_ms / maxLat * 0.2),
  })).sort((a,b)=>b.w-a.w);
  const winner = weighted[0];
  return { answer:winner.r.content, confidence:Math.min(100, Math.round(winner.w)), winnerIdx:responses.findIndex(r=>r.model_id===winner.r.model_id) };
}

// ── Consensus measurement ──────────────────────────────────────────────────

function measureConsensus(responses: ModelResponse[]): number {
  const ok = responses.filter(r=>r.success&&r.content.trim().length>5);
  if (ok.length < 2) return ok.length > 0 ? 50 : 0;
  let totalSim=0, pairs=0;
  for (let i=0;i<ok.length;i++) for (let j=i+1;j<ok.length;j++) {
    const wa = new Set(ok[i].content.toLowerCase().split(/\s+/).slice(0,30));
    const wb = new Set(ok[j].content.toLowerCase().split(/\s+/).slice(0,30));
    const inter = [...wa].filter(w=>wb.has(w)).length;
    const union = new Set([...wa,...wb]).size;
    totalSim += union > 0 ? inter/union : 0; pairs++;
  }
  return Math.round(totalSim / Math.max(1,pairs) * 100);
}

// ── Main ensemble runner ───────────────────────────────────────────────────

export async function runEnsemble(input: EnsembleInput): Promise<EnsembleResult> {
  const { prompt, models, taskType, apiKeys, timeoutMs=30_000, aggregation="confidence" } = input;
  const wallStart = Date.now();

  const settled = await Promise.allSettled(models.map(m => callModel(m, prompt, apiKeys, timeoutMs)));
  const modelResponses: ModelResponse[] = settled.map((r,i) =>
    r.status === "fulfilled" ? r.value : {
      model_id:models[i].id, provider:models[i].provider, content:"",
      latency_ms:0, cost_usd:0, success:false, score:0,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  );

  const successful     = modelResponses.filter(r=>r.success);
  const totalCostUsd   = modelResponses.reduce((s,r)=>s+r.cost_usd,0);
  const totalLatencyMs = Date.now() - wallStart;
  const consensusScore = measureConsensus(successful);

  if (!successful.length) {
    return { finalAnswer:"No models returned a successful response.",
      winningModel:"none", winningProvider:"none", aggregation, confidence:0,
      modelResponses, successCount:0, failureCount:modelResponses.length,
      totalCostUsd, totalLatencyMs, consensusScore:0 };
  }

  let agg: { answer:string; confidence:number; winnerIdx:number };
  switch (aggregation) {
    case "majority_vote"   : agg = aggregateMajorityVote(successful);   break;
    case "fastest"         : agg = aggregateFastest(successful);        break;
    case "weighted_ranking": agg = aggregateWeightedRanking(successful); break;
    default                : agg = aggregateConfidence(successful);
  }

  const winner = successful[agg.winnerIdx] ?? successful[0];
  return {
    finalAnswer:agg.answer, winningModel:winner.model_id, winningProvider:winner.provider,
    aggregation, confidence:agg.confidence, modelResponses,
    successCount:successful.length, failureCount:modelResponses.length-successful.length,
    totalCostUsd, totalLatencyMs, consensusScore,
  };
}
