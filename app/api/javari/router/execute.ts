import { ExecutionResult, ModelSelection, RouterInput, CouncilResult } from "./types";
import { resolveKey } from "./keys";
import { computeModelCost, estimateTokens } from "./utils";
import { runCouncil } from "./council";

export async function executeModel(
  input: RouterInput,
  selection: ModelSelection
): Promise<ExecutionResult> {
  const key = resolveKey(selection.model);

  const start = Date.now();
  let output = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  try {
    if (selection.model.startsWith("openai")) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selection.model.replace("openai:", ""),
          messages: [{ role: "user", content: input.message }],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "OpenAI produced no output.";
      inputTokens = data?.usage?.prompt_tokens || estimateTokens(input.message);
      outputTokens = data?.usage?.completion_tokens || estimateTokens(output);
      totalTokens = data?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else if (selection.model.startsWith("anthropic")) {
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
          messages: [{ role: "user", content: input.message }]
        })
      });

      const data = await response.json();
      output = data?.content?.[0]?.text || "Claude produced no output.";
      inputTokens = data?.usage?.input_tokens || estimateTokens(input.message);
      outputTokens = data?.usage?.output_tokens || estimateTokens(output);
      totalTokens = inputTokens + outputTokens;
    }

    else if (selection.model.startsWith("mistral")) {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: input.message }],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "Mistral produced no output.";
      inputTokens = data?.usage?.prompt_tokens || estimateTokens(input.message);
      outputTokens = data?.usage?.completion_tokens || estimateTokens(output);
      totalTokens = data?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else if (selection.model.startsWith("groq")) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: input.message }],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "Groq produced no output.";
      inputTokens = data?.usage?.prompt_tokens || estimateTokens(input.message);
      outputTokens = data?.usage?.completion_tokens || estimateTokens(output);
      totalTokens = data?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else if (selection.model.startsWith("xai")) {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [{ role: "user", content: input.message }],
          max_tokens: 1024
        })
      });

      const data = await response.json();
      output = data?.choices?.[0]?.message?.content || "Grok produced no output.";
      inputTokens = data?.usage?.prompt_tokens || estimateTokens(input.message);
      outputTokens = data?.usage?.completion_tokens || estimateTokens(output);
      totalTokens = data?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else {
      output = "Unknown model routed.";
      inputTokens = estimateTokens(input.message);
      outputTokens = estimateTokens(output);
      totalTokens = inputTokens + outputTokens;
    }

  } catch (err: any) {
    output = `Model execution error: ${err.message}`;
    inputTokens = estimateTokens(input.message);
    outputTokens = estimateTokens(output);
    totalTokens = inputTokens + outputTokens;
  }

  const creditCost = computeModelCost(selection.model, totalTokens);

  return {
    output,
    tokens: totalTokens,
    duration_ms: Date.now() - start,
    usage: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    },
    credit_cost: creditCost
  };
}

export async function executeSuperMode(input: RouterInput): Promise<CouncilResult> {
  return runCouncil(input);
}
