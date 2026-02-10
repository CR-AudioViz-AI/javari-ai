import { FinalResponse, RouterInput, ExecutionResult, CouncilResult } from "./types";

export function assemble(
  input: RouterInput,
  exec: ExecutionResult,
  model: string,
  validator: string,
  creditBalance: number,
  usageLogId?: string
): FinalResponse {
  return {
    reply: exec.output,
    model,
    validator,
    credits: exec.credit_cost,
    credit_balance: creditBalance,
    usage: exec.usage,
    credit_cost: exec.credit_cost,
    session_id: input.session_id || "new",
    enforced: true,
    usage_log_id: usageLogId,
    supermode: false
  };
}

export function assembleCouncil(
  input: RouterInput,
  council: CouncilResult,
  validatedOutput: string,
  creditBalance: number,
  usageLogId?: string
): FinalResponse {
  return {
    reply: validatedOutput,
    model: "council",
    validator: "anthropic:claude-3.5-sonnet",
    credits: council.credit_cost,
    credit_balance: creditBalance,
    usage: {
      input: 0,
      output: 0,
      total: council.total_tokens
    },
    credit_cost: council.credit_cost,
    session_id: input.session_id || "new",
    enforced: true,
    usage_log_id: usageLogId,
    supermode: true,
    timeline: council.timeline,
    contributors: council.contributors
  };
}
