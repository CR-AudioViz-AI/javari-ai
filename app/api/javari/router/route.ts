import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, mode, provider } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Simple echo response for now (will be replaced with real AI later)
    const response = {
      response: `[${mode.toUpperCase()} MODE via ${provider}] Echo: ${message}`,
      provider,
      mode,
      metadata: {
        reasoning: 'This is a simplified router response for testing',
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Router error', details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0-simplified',
    timestamp: new Date().toISOString()
  });
}
