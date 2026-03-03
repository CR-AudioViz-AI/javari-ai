// /app/api/env-check/route.ts
// Environment variable diagnostic endpoint
// Created: 2025-02-02 23:57 EST

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY
  });
}
