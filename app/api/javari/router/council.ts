import { RouterInput, CouncilDraft, CouncilTimelineStep, ModelContributorScore, CouncilResult, COUNCIL_MODELS, COUNCIL_MULTIPLIER } from "./types";
import { resolveKey } from "./keys";
import { estimateTokens, computeModelCost } from "./utils";

async function callModel(model: string, message: string): Promise<CouncilDraft> {
  const key = resolveKey(model);
  const start = Date.now();
  
  try {
    let output = "";
    let tokens = 0;

    if (model.startsWith("openai")) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model.replace("openai:", ""),
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    else if (model.startsWith("anthropic")) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: message }]
        })
      });
      const data = await response.json();
      output = data?.content?.[0]?.text || "";
      tokens = (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0);
    }

    else if (model.startsWith("mistral")) {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    else if (model.startsWith("groq")) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    else if (model.startsWith("xai")) {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    else if (model.startsWith("perplexity")) {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    else if (model.startsWith("together")) {
      const response = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
          messages: [{ role: "user", content: message }],
          max_tokens: 1024
        })
      });
      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "";
      tokens = data?.usage?.total_tokens || estimateTokens(message + output);
    }

    const evidence = extractEvidence(output);
    const confidence = calculateConfidence(output, evidence);

    return {
      model,
      output,
      tokens,
      duration_ms: Date.now() - start,
      evidence,
      confidence
    };

  } catch (err: any) {
    return {
      model,
      output: `Error: ${err.message}`,
      tokens: estimateTokens(message),
      duration_ms: Date.now() - start,
      evidence: [],
      confidence: 0
    };
  }
}

function extractEvidence(text: string): string[] {
  const evidence: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  sentences.forEach(sentence => {
    if (
      sentence.includes("because") ||
      sentence.includes("therefore") ||
      sentence.includes("research shows") ||
      sentence.includes("studies indicate") ||
      sentence.match(/\d+%/) ||
      sentence.match(/\d+ (times|percent|users)/)
    ) {
      evidence.push(sentence.trim());
    }
  });
  
  return evidence.slice(0, 3);
}

function calculateConfidence(output: string, evidence: string[]): number {
  let score = 0.5;
  
  if (output.length > 200) score += 0.1;
  if (evidence.length > 0) score += 0.1 * evidence.length;
  if (output.match(/\d+%/)) score += 0.05;
  if (output.includes("research") || output.includes("study")) score += 0.1;
  
  return Math.min(score, 1.0);
}

async function runParallelModels(message: string): Promise<CouncilDraft[]> {
  const tasks = COUNCIL_MODELS.map(model => () => callModel(model, message));
  const results = await Promise.all(tasks.map(t => t()));
  return results.filter(r => !r.output.startsWith("Error"));
}

function scoreModels(drafts: CouncilDraft[]): ModelContributorScore[] {
  return drafts.map(draft => {
    const lengthScore = Math.min(draft.output.length / 500, 1.0);
    const evidenceScore = draft.evidence.length * 0.2;
    const confidenceScore = draft.confidence;
    const speedScore = draft.duration_ms < 2000 ? 0.2 : 0.1;
    
    const totalScore = (lengthScore + evidenceScore + confidenceScore + speedScore) / 2.5;

    return {
      model: draft.model,
      score: Math.min(totalScore, 1.0),
      reasoning: `Evidence: ${draft.evidence.length}, Confidence: ${draft.confidence.toFixed(2)}, Speed: ${draft.duration_ms}ms`,
      evidence_count: draft.evidence.length,
      selected: false
    };
  }).sort((a, b) => b.score - a.score);
}

function voteAndRank(scores: ModelContributorScore[]): ModelContributorScore[] {
  const topN = Math.min(3, scores.length);
  scores.slice(0, topN).forEach(s => s.selected = true);
  return scores;
}

function assembleCouncilOutput(
  drafts: CouncilDraft[],
  contributors: ModelContributorScore[]
): string {
  const selectedDrafts = drafts.filter(d => 
    contributors.find(c => c.model === d.model && c.selected)
  );

  if (selectedDrafts.length === 0) {
    return drafts[0]?.output || "No valid outputs from council.";
  }

  const combined = selectedDrafts
    .map(d => d.output)
    .join("\n\n---\n\n");

  return combined;
}

export async function runCouncil(input: RouterInput): Promise<CouncilResult> {
  const timeline: CouncilTimelineStep[] = [];
  const startTime = Date.now();

  timeline.push({
    timestamp: startTime,
    model: "council",
    action: "Council session started",
    duration_ms: 0
  });

  const parallelStart = Date.now();
  const drafts = await runParallelModels(input.message);
  const parallelDuration = Date.now() - parallelStart;

  timeline.push({
    timestamp: Date.now(),
    model: "council",
    action: `${drafts.length} models completed`,
    duration_ms: parallelDuration
  });

  const scoreStart = Date.now();
  const scores = scoreModels(drafts);
  const contributors = voteAndRank(scores);
  const scoreDuration = Date.now() - scoreStart;

  timeline.push({
    timestamp: Date.now(),
    model: "council",
    action: "Models scored and ranked",
    duration_ms: scoreDuration
  });

  const assembleStart = Date.now();
  const combinedOutput = assembleCouncilOutput(drafts, contributors);
  const assembleDuration = Date.now() - assembleStart;

  timeline.push({
    timestamp: Date.now(),
    model: "council",
    action: "Output assembled",
    duration_ms: assembleDuration
  });

  const totalTokens = drafts.reduce((sum, d) => sum + d.tokens, 0);
  const baseCost = drafts.reduce((sum, d) => sum + computeModelCost(d.model, d.tokens), 0);
  const creditCost = Math.ceil(baseCost * COUNCIL_MULTIPLIER * 100) / 100;

  const totalDuration = Date.now() - startTime;

  return {
    final: combinedOutput,
    timeline,
    contributors,
    validated: false,
    total_tokens: totalTokens,
    duration_ms: totalDuration,
    credit_cost: creditCost
  };
}
