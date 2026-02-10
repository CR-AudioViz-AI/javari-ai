import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { classifyIntent } from "./classify";
import { selectModel } from "./selectModel";
import { executeModel } from "./execute";
import { validateOutput } from "./validate";
import { assemble } from "./assemble";
import { RouterInput } from "./types";
import { 
  getSupabaseUser, 
  getUserCredits, 
  deductCredits, 
  logUsage 
} from "./utils";

export async function POST(req: Request) {
  try {
    // 1. Extract auth token from cookies
    const cookieStore = cookies();
    const authCookie = cookieStore.get("sb-access-token");
    const accessToken = authCookie?.value;

    // 2. Authenticate user
    const userAuth = await getSupabaseUser(accessToken);
    
    if (!userAuth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // 3. Check credit balance
    const creditBalance = await getUserCredits(userAuth.user_id);
    
    if (creditBalance <= 0) {
      return NextResponse.json(
        { 
          error: "Insufficient credits. Please purchase more credits to continue.",
          credit_balance: 0
        },
        { status: 402 }
      );
    }

    // 4. Parse request body
    const body: RouterInput = await req.json();
    body.user_id = userAuth.user_id;

    // 5. Classify intent and select model
    const intent = await classifyIntent(body);
    const selected = selectModel(intent);

    // 6. Execute model
    const exec = await executeModel(body, selected);

    // 7. Validate output
    const val = await validateOutput(exec, selected);

    // 8. Check if user has enough credits for this request
    if (exec.credit_cost > creditBalance) {
      return NextResponse.json(
        { 
          error: `This request costs ${exec.credit_cost} credits, but you only have ${creditBalance} credits.`,
          credit_balance: creditBalance,
          credit_cost: exec.credit_cost
        },
        { status: 402 }
      );
    }

    // 9. Deduct credits
    const newBalance = await deductCredits(userAuth.user_id, exec.credit_cost);

    // 10. Log usage
    const usageLogId = await logUsage(userAuth.user_id, {
      user_id: userAuth.user_id,
      model: selected.model,
      input_tokens: exec.usage.input,
      output_tokens: exec.usage.output,
      total_tokens: exec.usage.total,
      credit_cost: exec.credit_cost,
      request_message: body.message,
      response_text: val.output,
      session_id: body.session_id
    });

    // 11. Assemble final response
    const final = assemble(
      body,
      { ...exec, output: val.output },
      selected.model,
      "anthropic:claude-3.5-sonnet",
      newBalance,
      usageLogId || undefined
    );

    return NextResponse.json(final);

  } catch (error: any) {
    console.error("Router error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
