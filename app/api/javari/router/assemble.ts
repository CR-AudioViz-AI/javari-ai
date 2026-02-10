import { FinalResponse, RouterInput, ExecutionResult } from "./types";

export function assemble(
  input: RouterInput,
  exec: ExecutionResult,
  model: string,
  validator: string
): FinalResponse {
  return {
    reply: exec.output,
    model,
    validator,
    credits: 1.0,
    usage: {
      input: input.message.length,
      output: exec.output.length
    },
    session_id: input.session_id || "new"
  };
}
