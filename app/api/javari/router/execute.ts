import { ExecutionResult, ModelSelection, RouterInput } from "./types";

export async function executeModel(
  input: RouterInput,
  selection: ModelSelection
): Promise<ExecutionResult> {
  // Placeholder — real LLM calls will be added in Phase 2 Step 3
  const fake = `Simulated response from ${selection.model}.`;

  return {
    output: fake,
    tokens: fake.length,
    duration_ms: 200
  };
}
