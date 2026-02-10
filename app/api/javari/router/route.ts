import { NextResponse } from "next/server";
import { classifyIntent } from "./classify";
import { selectModel } from "./selectModel";
import { executeModel } from "./execute";
import { validateOutput } from "./validate";
import { assemble } from "./assemble";
import { RouterInput } from "./types";

export async function POST(req: Request) {
  const body: RouterInput = await req.json();

  const intent = await classifyIntent(body);
  const selected = selectModel(intent);
  const exec = await executeModel(body, selected);
  const val = await validateOutput(exec, selected);

  const final = assemble(body, exec, selected.model, "anthropic:claude-3.5-sonnet");

  return NextResponse.json(final);
}
