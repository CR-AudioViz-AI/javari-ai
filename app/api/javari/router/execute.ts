import { ExecutionResult, ModelSelection, RouterInput } from "./types";
import { resolveKey } from "./keys";
import { computeModelCost } from "./utils";

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
      // GPT-4o / o3 family
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selection.model.replace("openai:", ""),
          messages: [{ role: "user", content: input.message }]
        })
      }).then(r => r.json());

      output = response?.choices?.[0]?.message?.content || "OpenAI produced no output.";
      inputTokens = response?.usage?.prompt_tokens || Math.ceil(input.message.length / 4);
      outputTokens = response?.usage?.completion_tokens || Math.ceil(output.length / 4);
      totalTokens = response?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else if (selection.model.startsWith("anthropic")) {
      // Claude validator + fallback
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
      }).then(r => r.json());

      output = response?.content?.[0]?.text || "Claude produced no output.";
      inputTokens = response?.usage?.input_tokens || Math.ceil(input.message.length / 4);
      outputTokens = response?.usage?.output_tokens || Math.ceil(output.length / 4);
      totalTokens = inputTokens + outputTokens;
    }

    else if (selection.model.startsWith("meta")) {
      // Llama 3 Inference endpoint
      const response = await fetch("https://api.meta-llama.com/v1/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3-8b",
          messages: [{ role: "user", content: input.message }]
        })
      }).then(r => r.json());

      output = response?.choices?.[0]?.message?.content || "Llama produced no output.";
      inputTokens = Math.ceil(input.message.length / 4);
      outputTokens = Math.ceil(output.length / 4);
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
          response_format: { type: "json_object" }
        })
      }).then(r => r.json());

      output = response?.choices?.[0]?.message?.content || "Mistral produced no output.";
      inputTokens = response?.usage?.prompt_tokens || Math.ceil(input.message.length / 4);
      outputTokens = response?.usage?.completion_tokens || Math.ceil(output.length / 4);
      totalTokens = response?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else if (selection.model.startsWith("xai")) {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-beta",
          messages: [{ role: "user", content: input.message }]
        })
      }).then(r => r.json());

      output = response?.choices?.[0]?.message?.content || "Grok produced no output.";
      inputTokens = response?.usage?.prompt_tokens || Math.ceil(input.message.length / 4);
      outputTokens = response?.usage?.completion_tokens || Math.ceil(output.length / 4);
      totalTokens = response?.usage?.total_tokens || (inputTokens + outputTokens);
    }

    else {
      output = "Unknown model routed.";
      inputTokens = Math.ceil(input.message.length / 4);
      outputTokens = Math.ceil(output.length / 4);
      totalTokens = inputTokens + outputTokens;
    }

  } catch (err: any) {
    output = `Model execution error: ${err.message}`;
    inputTokens = Math.ceil(input.message.length / 4);
    outputTokens = Math.ceil(output.length / 4);
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
