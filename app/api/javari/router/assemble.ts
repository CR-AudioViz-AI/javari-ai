import { FinalResponse, RouterInput, ExecutionResult } from "./types";

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
    usage_log_id: usageLogId
  };
}
