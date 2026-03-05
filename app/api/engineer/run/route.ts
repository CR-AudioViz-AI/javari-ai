import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { command } = await req.json();

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid command" },
        { status: 400 }
      );
    }

    // Basic security: block dangerous patterns
    const blockedPatterns = [
      /rm\s+-rf\s+\//,
      /:\(\)\{.*\};:/,
      />\s*\/dev\/sd/,
      /mkfs/,
      /dd\s+if=/,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(command)) {
        return NextResponse.json(
          { ok: false, error: "Command blocked for safety" },
          { status: 403 }
        );
      }
    }

    // Execute command with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      cwd: process.cwd(),
    });

    return NextResponse.json({
      ok: true,
      stdout,
      stderr,
      command,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Execution failed",
        stderr: err.stderr || "",
        stdout: err.stdout || "",
      },
      { status: 500 }
    );
  }
}
