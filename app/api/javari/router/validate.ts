import { ExecutionResult, ValidationResult, ModelSelection } from "./types";

export async function validateOutput(
  exec: ExecutionResult,
  selection: ModelSelection
): Promise<ValidationResult> {
  // Placeholder — real Claude validator goes in Step 3
  return {
    approved: true,
    output: exec.output
  };
}
