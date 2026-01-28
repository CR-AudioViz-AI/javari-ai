// app/api/vision/analyze/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VISION CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:28 PM EST
// Version: 1.0 - IMAGE UNDERSTANDING & ANALYSIS
//
// Capabilities:
// - Image description and understanding
// - Screenshot analysis for debugging
// - UI/UX review and suggestions
// - Code extraction from images
// - Chart and diagram interpretation
// - Document OCR and understanding
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface VisionRequest {
  image: string; // Base64 encoded image or URL
  imageType?: 'base64' | 'url';
  task: 'describe' | 'debug' | 'review_ui' | 'extract_code' | 'interpret_chart' | 'ocr' | 'custom';
  customPrompt?: string;
  context?: string;
}

interface VisionResult {
  success: boolean;
  task: string;
  analysis: string;
  structured?: any;
  confidence: number;
  provider: string;
  model: string;
  tokensUsed: number;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK-SPECIFIC PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const TASK_PROMPTS: Record<string, string> = {
  describe: `Describe this image in detail. Include:
- Main subject and composition
- Colors, lighting, and mood
- Any text visible
- Notable details or patterns
- Context or setting`,

  debug: `Analyze this screenshot for debugging purposes. Identify:
- Any visible errors or error messages
- Console logs or developer tool output
- UI elements that appear broken or misaligned
- Network requests or status codes
- Suggested fixes for any issues found

Format as a structured report with clear actionable items.`,

  review_ui: `Review this UI/UX design and provide professional feedback on:
- Visual hierarchy and layout
- Color scheme and accessibility (contrast, readability)
- Typography choices
- Spacing and alignment
- Mobile responsiveness indicators
- User experience considerations
- Specific improvements suggested

Rate overall design quality 1-10 and explain.`,

  extract_code: `Extract any code visible in this image. Provide:
- The exact code as text (preserve formatting)
- Programming language detected
- Any visible line numbers
- Syntax highlighting hints
- If partial, indicate what might be missing
- Any errors visible in the code

Output the code in a properly formatted code block.`,

  interpret_chart: `Analyze this chart or diagram and explain:
- Type of visualization (bar, line, pie, flowchart, etc.)
- Data being represented
- Key insights or trends
- Axis labels and scales
- Notable data points or outliers
- Conclusions that can be drawn

If it's a flowchart or diagram, explain the process or relationships shown.`,

  ocr: `Extract all text from this image:
- Preserve the original layout as much as possible
- Note any formatting (bold, italic, headers)
- Indicate where text might be unclear
- Group related text together
- Translate if not in English (and provide original)

Output as clean, readable text.`,

  custom: `Analyze this image based on the user's specific instructions.`
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISION PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeWithClaude(
  imageData: string,
  imageType: 'base64' | 'url',
  prompt: string
): Promise<{ analysis: string; tokensUsed: number }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  // Prepare image content
  const imageContent = imageType === 'url'
    ? { type: 'image' as const, source: { type: 'url' as const, url: imageData } }
    : { 
        type: 'image' as const, 
        source: { 
          type: 'base64' as const, 
          media_type: 'image/png' as const, // Assume PNG, could be improved
          data: imageData.replace(/^data:image\/\w+;base64,/, '')
        } 
      };
  
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        imageContent,
        { type: 'text', text: prompt }
      ]
    }]
  });
  
  const analysis = response.content[0].type === 'text' ? response.content[0].text : '';
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  
  return { analysis, tokensUsed };
}

async function analyzeWithOpenAI(
  imageData: string,
  imageType: 'base64' | 'url',
  prompt: string
): Promise<{ analysis: string; tokensUsed: number }> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  
  // Prepare image content
  const imageUrl = imageType === 'url' 
    ? imageData 
    : `data:image/png;base64,${imageData.replace(/^data:image\/\w+;base64,/, '')}`;
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: prompt }
      ]
    }]
  });
  
  const analysis = response.choices[0]?.message?.content || '';
  const tokensUsed = response.usage?.total_tokens || 0;
  
  return { analysis, tokensUsed };
}

async function analyzeWithGemini(
  imageData: string,
  imageType: 'base64' | 'url',
  prompt: string
): Promise<{ analysis: string; tokensUsed: number }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  
  // Prepare image data
  let imagePart;
  if (imageType === 'url') {
    // Fetch image and convert to base64
    const response = await fetch(imageData);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    imagePart = {
      inlineData: {
        data: base64,
        mimeType: 'image/png'
      }
    };
  } else {
    imagePart = {
      inlineData: {
        data: imageData.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: 'image/png'
      }
    };
  }
  
  const result = await model.generateContent([prompt, imagePart]);
  const analysis = result.response.text();
  
  return { analysis, tokensUsed: Math.ceil(analysis.length / 4) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeImage(request: VisionRequest): Promise<VisionResult> {
  const startTime = Date.now();
  
  // Build prompt
  let prompt = TASK_PROMPTS[request.task] || TASK_PROMPTS.custom;
  if (request.task === 'custom' && request.customPrompt) {
    prompt = request.customPrompt;
  }
  if (request.context) {
    prompt = `Context: ${request.context}\n\n${prompt}`;
  }
  
  // Determine image type
  const imageType = request.imageType || 
    (request.image.startsWith('http') ? 'url' : 'base64');
  
  // Try providers in order
  const providers = [
    { name: 'Claude', model: 'claude-3-5-sonnet-20241022', fn: analyzeWithClaude },
    { name: 'OpenAI', model: 'gpt-4o', fn: analyzeWithOpenAI },
    { name: 'Gemini', model: 'gemini-1.5-pro', fn: analyzeWithGemini }
  ];
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    try {
      const { analysis, tokensUsed } = await provider.fn(
        request.image,
        imageType,
        prompt
      );
      
      // Parse structured data if applicable
      let structured;
      if (request.task === 'extract_code') {
        const codeMatch = analysis.match(/```(\w+)?\n([\s\S]*?)```/);
        if (codeMatch) {
          structured = {
            language: codeMatch[1] || 'unknown',
            code: codeMatch[2].trim()
          };
        }
      } else if (request.task === 'review_ui') {
        const ratingMatch = analysis.match(/(\d+)\/10|(\d+) out of 10/i);
        if (ratingMatch) {
          structured = {
            rating: parseInt(ratingMatch[1] || ratingMatch[2])
          };
        }
      }
      
      return {
        success: true,
        task: request.task,
        analysis,
        structured,
        confidence: 0.9,
        provider: provider.name,
        model: provider.model,
        tokensUsed,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`[Vision] ${provider.name} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      continue;
    }
  }
  
  throw lastError || new Error('All vision providers failed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: VisionRequest = await request.json();
    
    // Validate request
    if (!body.image) {
      return NextResponse.json({
        success: false,
        error: 'Image is required (base64 or URL)'
      }, { status: 400 });
    }
    
    if (!body.task) {
      return NextResponse.json({
        success: false,
        error: 'Task is required',
        availableTasks: Object.keys(TASK_PROMPTS)
      }, { status: 400 });
    }
    
    // Analyze image
    const result = await analyzeImage(body);
    
    // Log analysis
    await supabase.from('vision_analyses').insert({
      task: body.task,
      image_type: body.imageType || 'base64',
      has_context: !!body.context,
      provider: result.provider,
      model: result.model,
      tokens_used: result.tokensUsed,
      duration_ms: result.duration,
      created_at: new Date().toISOString()
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Vision] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent analyses
  const { data: recentAnalyses } = await supabase
    .from('vision_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Vision',
    version: '1.0',
    description: 'Image understanding and analysis capabilities',
    tasks: Object.entries(TASK_PROMPTS).map(([task, prompt]) => ({
      task,
      description: prompt.split('\n')[0]
    })),
    providers: [
      { name: 'Claude', model: 'claude-3-5-sonnet-20241022', priority: 1 },
      { name: 'OpenAI', model: 'gpt-4o', priority: 2 },
      { name: 'Gemini', model: 'gemini-1.5-pro', priority: 3 }
    ],
    recentAnalyses: recentAnalyses || [],
    usage: {
      method: 'POST',
      body: {
        image: 'Base64 encoded image or URL',
        imageType: 'optional - "base64" or "url" (auto-detected)',
        task: 'describe | debug | review_ui | extract_code | interpret_chart | ocr | custom',
        customPrompt: 'Required if task is "custom"',
        context: 'optional additional context'
      },
      examples: [
        {
          task: 'debug',
          description: 'Screenshot of error - will identify issues and suggest fixes'
        },
        {
          task: 'review_ui',
          description: 'Design mockup - will provide professional UI/UX feedback'
        },
        {
          task: 'extract_code',
          description: 'Code screenshot - will extract and format the code'
        }
      ]
    },
    timestamp: new Date().toISOString()
  });
}
