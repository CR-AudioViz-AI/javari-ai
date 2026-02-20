import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyUser(token: string) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data) {
    console.error('[subtitle-generator] User verification failed:', error);
    throw new Error('Unauthorized');
  }
  return data;
}

async function deductCredits(userId: string, credits: number) {
  // Placeholder for credit deduction logic
  // Assume a function deductUserCredits(userId: string, credits: number): Promise<boolean>
  const success = await deductUserCredits(userId, credits);
  if (!success) {
    console.error('[subtitle-generator] Insufficient credits for user:', userId);
    throw new Error('Insufficient credits');
  }
}

async function processSubtitles(input: Record<string, unknown>) {
  // Placeholder for AI processing logic
  // Assume a function generateSubtitles(input: Record<string, unknown>): Promise<any>
  return await generateSubtitles(input);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Authorization header missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Invalid authorization header format' }, { status: 401 });
    }

    const user = await verifyUser(token);

    const input: Record<string, unknown> = await req.json();
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid input data' }, { status: 400 });
    }

    await deductCredits(user.id, 4);

    const result = await processSubtitles(input);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[subtitle-generator] Error processing request:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}