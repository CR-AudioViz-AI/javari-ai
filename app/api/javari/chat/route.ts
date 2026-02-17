import { NextResponse } from "next/server";
import { unifiedJavariEngine } from "@/lib/javari/engine/unified";
export const maxDuration = 30;
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { messages, persona, context, files } = json;
    const result = await unifiedJavariEngine({
      messages,
      persona,
      context,
      files
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      messages: [
        { role: "assistant", content: "An internal error occurred." }
      ],
      error: err?.message || "Unknown error",
      success: false
    });
  }
}
