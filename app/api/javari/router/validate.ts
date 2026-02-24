import { ExecutionResult, ValidationResult, CouncilResult } from "./types";
import { resolveKey } from "./keys";

export async function validateOutput(
  exec: ExecutionResult,
  model: { model: string }
): Promise<ValidationResult> {
  // Use Claude for validation
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
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Validate this AI output for accuracy and coherence. Remove any hallucinations or logical errors. Return only the validated output:\n\n${exec.output}`
        }]
      })
    });

    const data = await response.json();
    const validated = data?.content?.[0]?.text || exec.output;

    return {
      approved: true,
      output: validated
    };
  } catch (err) {
    return {
      approved: false,
      output: exec.output
    };
  }
}

export async function validateCouncil(council: CouncilResult): Promise<string> {
  const key = resolveKey("anthropic:claude-3.5-sonnet");
  
  const contributorSummary = council.contributors
    .filter(c => c.selected)
    .map(c => `${c.model}: ${c.reasoning}`)
    .join("\n");

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
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `You are validating an AI Council output. Multiple models provided input. Synthesize their best insights into a single coherent response. Remove contradictions and hallucinations.\n\nContributors:\n${contributorSummary}\n\nDraft Output:\n${council.final}\n\nProvide the final validated response:`
        }]
      })
    });

    const data = await response.json();
    return data?.content?.[0]?.text || council.final;
  } catch (err) {
    return council.final;
  }
}
