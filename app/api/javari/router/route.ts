import { NextResponse } from "next/server";
import { classifyIntent } from "./classify";
import { selectModel } from "./selectModel";
import { executeModel, executeSuperMode } from "./execute";
import { validateOutput, validateCouncil } from "./validate";
import { assemble, assembleCouncil } from "./assemble";
import { RouterInput } from "./types";
import { 
  getSupabaseUser, 
  getUserCredits, 
  deductCredits, 
  logUsage 
} from "./utils";

export async function POST(req: Request) {
  try {
    const userAuth = await getSupabaseUser(req);
    
    if (!userAuth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

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

    const body: RouterInput = await req.json();
    body.user_id = userAuth.user_id;

    const isSuperMode = body.supermode === true;

    if (isSuperMode) {
      const council = await executeSuperMode(body);

      const validatedOutput = await validateCouncil(council);
      council.validated = true;

      if (council.credit_cost > creditBalance) {
        return NextResponse.json(
          { 
            error: `SuperMode costs ${council.credit_cost} credits, but you only have ${creditBalance} credits.`,
            credit_balance: creditBalance,
            credit_cost: council.credit_cost
          },
          { status: 402 }
        );
      }

      const newBalance = await deductCredits(userAuth.user_id, council.credit_cost);

      const usageLogId = await logUsage(userAuth.user_id, {
        user_id: userAuth.user_id,
        model: "council",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: council.total_tokens,
        credit_cost: council.credit_cost,
        request_message: body.message,
        response_text: validatedOutput,
        session_id: body.session_id,
        supermode: true
      });

      const final = assembleCouncil(
        body,
        council,
        validatedOutput,
        newBalance,
        usageLogId || undefined
      );

      return NextResponse.json(final);
    }

    const intent = await classifyIntent(body);
    const selected = selectModel(intent);
    const exec = await executeModel(body, selected);
    const val = await validateOutput(exec, selected);

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

    const newBalance = await deductCredits(userAuth.user_id, exec.credit_cost);

    const usageLogId = await logUsage(userAuth.user_id, {
      user_id: userAuth.user_id,
      model: selected.model,
      input_tokens: exec.usage.input,
      output_tokens: exec.usage.output,
      total_tokens: exec.usage.total,
      credit_cost: exec.credit_cost,
      request_message: body.message,
      response_text: val.output,
      session_id: body.session_id,
      supermode: false
    });

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
