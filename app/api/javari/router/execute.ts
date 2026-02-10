import { ExecutionResult, ModelSelection, RouterInput } from "./types";
import { resolveKey } from "./keys";

export async function executeModel(
  input: RouterInput,
  selection: ModelSelection
): Promise<ExecutionResult> {
  const key = resolveKey(selection.model);

  const start = Date.now();
  let output = "";
  let tokens = 0;

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
      tokens = response?.usage?.total_tokens || output.length;
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
      tokens = 2000;
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
      tokens = output.length;
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
      tokens = output.length;
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
      tokens = output.length;
    }

    else {
      output = "Unknown model routed.";
      tokens = output.length;
    }

  } catch (err: any) {
    output = `Model execution error: ${err.message}`;
    tokens = output.length;
  }

  return {
    output,
    tokens,
    duration_ms: Date.now() - start
  };
}
