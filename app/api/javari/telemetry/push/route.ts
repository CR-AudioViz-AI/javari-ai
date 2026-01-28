import { NextResponse } from "next/server";
import telemetryEngine from "@/lib/telemetry-engine";

export async function POST(req: Request) {
  const { type, payload } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  switch (type) {
    case "heartbeat":
      telemetryEngine.emitHeartbeat(payload.taskId, payload.message);
      break;
    case "modeChange":
      telemetryEngine.emitModeChange(payload.mode);
      break;
    case "progress":
      telemetryEngine.emitProgress(payload.taskId, payload.percent);
      break;
    default:
      return NextResponse.json({ error: "Unknown telemetry type" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
