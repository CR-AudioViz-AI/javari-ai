import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Generate code using OpenAI GPT-4
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert React/Next.js developer for CR AudioViz AI.

CRITICAL REQUIREMENTS:
1. Generate production-ready, complete, working code only
2. Use Next.js 14 with TypeScript and App Router
3. Use Tailwind CSS for styling with shadcn/ui components
4. Include proper error handling and loading states
5. Follow CR AudioViz AI brand colors: Navy #002B5B, Red #FD201D, Cyan #00BCD4
6. Add proper TypeScript types and interfaces
7. Include helpful comments for complex logic
8. Make components responsive and accessible (WCAG 2.2 AA)
9. Use 'use client' directive for client components
10. Export components as default exports

RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "fileName": "exact-file-path.tsx",
  "code": "complete file contents",
  "explanation": "brief explanation of what was built"
}

Do not include markdown code blocks or any other text. Only valid JSON.`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsed;
    try {
      // Remove any potential markdown code blocks
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response);
      throw new Error('Invalid response format from AI');
    }

    const { fileName, code, explanation } = parsed;

    if (!fileName || !code) {
      throw new Error('Missing fileName or code in AI response');
    }

    // Store generation in database
    const { error: dbError } = await supabase.from('developer_generations').insert({
      description,
      file_name: fileName,
      code,
      explanation: explanation || null,
      status: 'generated',
      model: 'gpt-4-turbo-preview',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if database insert fails
    }

    // Store in knowledge base for learning
    await supabase.from('developer_knowledge').insert({
      description,
      file_name: fileName,
      code_pattern: code.substring(0, 500), // Store snippet for pattern matching
      tags: ['ai-generated', 'auto-deploy'],
      success: true,
    });

    return NextResponse.json({
      fileName,
      code,
      explanation,
    });
  } catch (error: unknown) {
    logError(\'Code generation error:\', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Code generation failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
