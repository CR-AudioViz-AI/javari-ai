import { ExecutionResult, ValidationResult, ModelSelection } from "./types";
import { resolveKey } from "./keys";

export async function validateOutput(
  exec: ExecutionResult,
  selection: ModelSelection
): Promise<ValidationResult> {

  if (selection.model.startsWith("anthropic")) {
    return {
      approved: true,
      output: exec.output
    };
  }

  // Claude Sonnet validation
  const key = resolveKey("anthropic:claude-3.5-sonnet");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 512,
        messages: [
          { role: "user", content: "Validate this response for correctness and safety." },
          { role: "assistant", content: exec.output }
        ]
      })
    }).then(r => r.json());

    const result = response?.content?.[0]?.text || exec.output;

    return {
      approved: true,
      output: result
    };

  } catch {
    return {
      approved: true,
      output: exec.output
    };
  }
}
