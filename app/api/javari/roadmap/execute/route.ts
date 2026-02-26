import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { task_id, mode } = await req.json();

    if (mode === 'all') {
      // Execute all ready tasks via autonomy loop
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javari-ai.vercel.app'}/api/autonomy/loop`, {
        method: 'POST'
      });
      return NextResponse.json(await response.json());
    }

    // Execute single task
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javari-ai.vercel.app'}/api/autonomy/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id })
    });

    return NextResponse.json(await response.json());
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
