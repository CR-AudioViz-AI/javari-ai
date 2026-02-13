// app/api/autonomous/execute/route.ts
// NODE RUNTIME - Autonomous Build Executor
// Handles: Multi-step ChatGPT → Claude → ChatGPT loops
// Max Duration: 60 seconds

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ExecuteRequest {
  message: string;
  provider?: string;
}

interface ExecutionStep {
  phase: string;
  provider: string;
  timestamp: number;
  duration: number;
  output: string;
  error?: string;
}

interface ExecutionResult {
  response: string;
  success: boolean;
  steps: ExecutionStep[];
  files: Array<{ name: string; content: string }>;
  plan: string;
  validation: string;
  totalTime: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const steps: ExecutionStep[] = [];

  try {
    const body: ExecuteRequest = await req.json();
    const { message } = body;

    if (!message?.trim()) {
      return Response.json({ 
        error: "Message required",
        response: "Please provide a message",
        success: false,
        files: [],
        plan: "",
        validation: "",
        steps: [],
        totalTime: 0
      }, { status: 400 });
    }

    console.log('[Autonomous] Starting execution:', message.substring(0, 100));

    // PHASE 1: ChatGPT Planning (15s max)
    const planStep = await executePlanningPhase(message, startTime);
    steps.push(planStep);

    if (planStep.error) {
      throw new Error(`Planning failed: ${planStep.error}`);
    }

    const plan = planStep.output;

    // PHASE 2: Claude Building (35s max)
    const buildStep = await executeBuildPhase(plan, message, startTime);
    steps.push(buildStep);

    if (buildStep.error) {
      throw new Error(`Building failed: ${buildStep.error}`);
    }

    // Extract files from Claude's response
    const files = extractFilesFromResponse(buildStep.output);

    // PHASE 3: ChatGPT Validation (10s max)
    const validateStep = await executeValidationPhase(plan, buildStep.output, startTime);
    steps.push(validateStep);

    const totalTime = Date.now() - startTime;

    console.log(`[Autonomous] Complete in ${totalTime}ms - ${files.length} files created`);

    // Generate summary response
    const summaryResponse = generateSummaryResponse(plan, files, validateStep.output, totalTime);

    const result: ExecutionResult = {
      response: summaryResponse,
      success: true,
      steps,
      files,
      plan,
      validation: validateStep.output,
      totalTime
    };

    return Response.json(result);

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    
    console.error('[Autonomous] Error:', error);

    const result: ExecutionResult = {
      response: `Autonomous build failed: ${error.message}`,
      success: false,
      steps,
      files: [],
      plan: '',
      validation: '',
      totalTime,
      error: error.message
    };

    return Response.json(result, { status: 500 });
  }
}

// PHASE 1: Planning with ChatGPT
async function executePlanningPhase(message: string, startTime: number): Promise<ExecutionStep> {
  const phaseStart = Date.now();
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a software architect. Create a concise implementation plan with specific file structure and requirements. Keep under 300 words.'
          },
          {
            role: 'user',
            content: `Create an implementation plan for: ${message}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const plan = data.choices[0]?.message?.content || '';

    return {
      phase: 'planning',
      provider: 'chatgpt',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: plan
    };

  } catch (error: any) {
    return {
      phase: 'planning',
      provider: 'chatgpt',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: '',
      error: error.message
    };
  }
}

// PHASE 2: Building with Claude
async function executeBuildPhase(plan: string, originalMessage: string, startTime: number): Promise<ExecutionStep> {
  const phaseStart = Date.now();
  
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const client = new Anthropic({
      apiKey: anthropicKey
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `${plan}\n\nBased on this plan, build the complete implementation for: ${originalMessage}\n\nProvide all code files with clear file names. Format each file as:\n\n=== FILENAME: path/to/file.ext ===\n[complete file content]\n=== END FILE ===`
        }
      ]
    });

    const buildOutput = response.content
      .filter(block => block.type === 'text')
      .map(block => 'text' in block ? block.text : '')
      .join('\n');

    return {
      phase: 'building',
      provider: 'claude',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: buildOutput
    };

  } catch (error: any) {
    return {
      phase: 'building',
      provider: 'claude',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: '',
      error: error.message
    };
  }
}

// PHASE 3: Validation with ChatGPT
async function executeValidationPhase(plan: string, buildOutput: string, startTime: number): Promise<ExecutionStep> {
  const phaseStart = Date.now();
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a code reviewer. Validate the implementation matches the plan. List what was built correctly and any issues. Keep under 200 words.'
          },
          {
            role: 'user',
            content: `PLAN:\n${plan}\n\nIMPLEMENTATION:\n${buildOutput.substring(0, 2000)}\n\nValidate this implementation.`
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const validation = data.choices[0]?.message?.content || '';

    return {
      phase: 'validation',
      provider: 'chatgpt',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: validation
    };

  } catch (error: any) {
    return {
      phase: 'validation',
      provider: 'chatgpt',
      timestamp: Date.now() - startTime,
      duration: Date.now() - phaseStart,
      output: '',
      error: error.message
    };
  }
}

// Extract files from Claude's response
function extractFilesFromResponse(output: string): Array<{ name: string; content: string }> {
  const files: Array<{ name: string; content: string }> = [];
  
  // Pattern 1: === FILENAME: path/to/file.ext ===
  const filePattern = /===\s*FILENAME:\s*(.+?)\s*===\n([\s\S]*?)(?:===\s*END FILE\s*===|(?====\s*FILENAME:)|$)/gi;
  
  let match;
  while ((match = filePattern.exec(output)) !== null) {
    const name = match[1].trim();
    const content = match[2].trim();
    
    if (name && content) {
      files.push({ name, content });
    }
  }

  // Pattern 2: Markdown code blocks with filenames
  if (files.length === 0) {
    const mdFilePattern = /(?:^|\n)(?:#{1,6}\s+)?(?:File:|Filename:|\*\*File:\*\*|\*\*Filename:\*\*)\s*`?([^\n`]+?)`?\n+```(\w+)?\n([\s\S]*?)```/gi;
    
    while ((match = mdFilePattern.exec(output)) !== null) {
      const name = match[1].trim();
      const content = match[3].trim();
      
      if (name && content) {
        files.push({ name, content });
      }
    }
  }

  // Pattern 3: Generic code blocks (fallback)
  if (files.length === 0) {
    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    let blockIndex = 1;
    
    while ((match = codeBlockPattern.exec(output)) !== null) {
      const language = match[1] || 'txt';
      const content = match[2].trim();
      
      if (content && content.length > 10) {
        files.push({
          name: `file${blockIndex}.${language}`,
          content
        });
        blockIndex++;
      }
    }
  }

  return files;
}

// Generate human-readable summary
function generateSummaryResponse(plan: string, files: Array<{name: string; content: string}>, validation: string, totalTime: number): string {
  let response = `✅ **Autonomous Build Complete** (${totalTime}ms)\n\n`;
  
  response += `**Files Generated:** ${files.length}\n`;
  files.forEach(file => {
    response += `- ${file.name}\n`;
  });
  
  response += `\n**Build Time:** ${(totalTime / 1000).toFixed(2)}s\n\n`;
  
  if (validation) {
    response += `**Validation:** ${validation}\n\n`;
  }
  
  response += `All files are ready for download.`;
  
  return response;
}

export async function GET() {
  return Response.json({
    status: "healthy",
    runtime: "nodejs",
    version: "7.0-HYBRID-AUTONOMOUS",
    capabilities: [
      "multi-step execution",
      "file generation",
      "chatgpt planning",
      "claude building",
      "automated validation"
    ],
    maxDuration: 60,
    timestamp: new Date().toISOString()
  });
}
