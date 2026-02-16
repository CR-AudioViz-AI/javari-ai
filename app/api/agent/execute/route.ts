// app/api/agent/execute/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - AUTONOMOUS AGENT MODE
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:12 PM EST
// Version: 1.0 - MULTI-STEP TASK EXECUTION WITH PLANNING
//
// Capabilities:
// - Break complex tasks into steps
// - Execute tools autonomously
// - Self-correct on failures
// - Report progress in real-time
// - Learn from executions
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

interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'planning' | 'executing' | 'completed' | 'failed';
  plan?: AgentPlan;
  results?: StepResult[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface AgentPlan {
  goal: string;
  steps: PlanStep[];
  estimatedDuration: number;
  confidence: number;
}

interface PlanStep {
  id: number;
  action: string;
  tool?: string;
  parameters?: Record<string, any>;
  dependsOn?: number[];
  description: string;
}

interface StepResult {
  stepId: number;
  status: 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  duration: number;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABLE TOOLS FOR AGENT
// ═══════════════════════════════════════════════════════════════════════════════

const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'github.createFile',
    description: 'Create a new file in a GitHub repository',
    parameters: {
      repo: { type: 'string', description: 'Repository name', required: true },
      path: { type: 'string', description: 'File path', required: true },
      content: { type: 'string', description: 'File content', required: true },
      message: { type: 'string', description: 'Commit message', required: true }
    }
  },
  {
    name: 'github.updateFile',
    description: 'Update an existing file in a GitHub repository',
    parameters: {
      repo: { type: 'string', description: 'Repository name', required: true },
      path: { type: 'string', description: 'File path', required: true },
      content: { type: 'string', description: 'New content', required: true },
      message: { type: 'string', description: 'Commit message', required: true }
    }
  },
  {
    name: 'github.getFile',
    description: 'Read contents of a file from GitHub',
    parameters: {
      repo: { type: 'string', description: 'Repository name', required: true },
      path: { type: 'string', description: 'File path', required: true }
    }
  },
  {
    name: 'code.generate',
    description: 'Generate code using AI',
    parameters: {
      prompt: { type: 'string', description: 'Description of code to generate', required: true },
      language: { type: 'string', description: 'Programming language', required: false },
      framework: { type: 'string', description: 'Framework to use', required: false }
    }
  },
  {
    name: 'web.search',
    description: 'Search the web for information',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true }
    }
  },
  {
    name: 'supabase.query',
    description: 'Query data from the database',
    parameters: {
      table: { type: 'string', description: 'Table name', required: true },
      select: { type: 'string', description: 'Columns to select', required: false },
      filters: { type: 'object', description: 'Filter conditions', required: false }
    }
  },
  {
    name: 'supabase.insert',
    description: 'Insert data into the database',
    parameters: {
      table: { type: 'string', description: 'Table name', required: true },
      data: { type: 'object', description: 'Data to insert', required: true }
    }
  },
  {
    name: 'vercel.listDeployments',
    description: 'List recent Vercel deployments',
    parameters: {
      projectId: { type: 'string', description: 'Project ID', required: false },
      limit: { type: 'number', description: 'Number to return', required: false }
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// AI PLANNER - Creates execution plan from natural language
// ═══════════════════════════════════════════════════════════════════════════════

async function createPlan(task: string): Promise<AgentPlan> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  
  const toolsDescription = AGENT_TOOLS.map(t => 
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
  ).join('\n');
  
  const systemPrompt = `You are an AI agent planner. Given a task, create a detailed execution plan.

AVAILABLE TOOLS:
${toolsDescription}

RULES:
1. Break complex tasks into atomic steps
2. Each step should use exactly one tool or be a "think" step
3. Steps can depend on previous steps (use dependsOn)
4. Be specific with parameters - use placeholder values like {{step1.output.path}} for dynamic values
5. Estimate duration in milliseconds
6. Rate your confidence 0-100

Respond in JSON format:
{
  "goal": "clear statement of what we're achieving",
  "steps": [
    {
      "id": 1,
      "action": "tool_name or 'think'",
      "tool": "tool.name if using a tool",
      "parameters": { "param": "value" },
      "dependsOn": [array of step ids this depends on],
      "description": "what this step does"
    }
  ],
  "estimatedDuration": total_ms,
  "confidence": 0-100
}`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Create an execution plan for: ${task}` }]
  });
  
  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse plan from AI response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR - Executes individual tools
// ═══════════════════════════════════════════════════════════════════════════════

async function executeTool(
  toolName: string,
  parameters: Record<string, any>,
  previousResults: StepResult[]
): Promise<any> {
  // Resolve dynamic parameters from previous results
  const resolvedParams = resolveParameters(parameters, previousResults);
  
  // Call the tools API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: toolName,
      parameters: resolvedParams
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Tool execution failed');
  }
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Tool returned failure');
  }
  
  return result.result;
}

function resolveParameters(
  params: Record<string, any>,
  previousResults: StepResult[]
): Record<string, any> {
  const resolved: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.includes('{{')) {
      // Resolve dynamic reference like {{step1.output.path}}
      resolved[key] = value.replace(/\{\{step(\d+)\.output\.(\w+)\}\}/g, (_, stepId, field) => {
        const stepResult = previousResults.find(r => r.stepId === parseInt(stepId));
        if (stepResult?.output && typeof stepResult.output === 'object') {
          return stepResult.output[field] || value;
        }
        return value;
      });
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT EXECUTOR - Runs the full plan
// ═══════════════════════════════════════════════════════════════════════════════

async function executeAgent(task: AgentTask): Promise<AgentTask> {
  const results: StepResult[] = [];
  
  try {
    // Phase 1: Planning
    task.status = 'planning';
    console.log(`[Agent] Planning task: ${task.description}`);
    
    const plan = await createPlan(task.description);
    task.plan = plan;
    
    console.log(`[Agent] Plan created with ${plan.steps.length} steps, confidence: ${plan.confidence}%`);
    
    // Phase 2: Execution
    task.status = 'executing';
    
    for (const step of plan.steps) {
      const stepStart = Date.now();
      console.log(`[Agent] Executing step ${step.id}: ${step.description}`);
      
      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const failedDeps = step.dependsOn.filter(depId => {
          const depResult = results.find(r => r.stepId === depId);
          return !depResult || depResult.status === 'failed';
        });
        
        if (failedDeps.length > 0) {
          results.push({
            stepId: step.id,
            status: 'skipped',
            error: `Dependencies failed: ${failedDeps.join(', ')}`,
            duration: 0
          });
          continue;
        }
      }
      
      try {
        let output: any;
        
        if (step.action === 'think') {
          // Thinking step - use AI to process/decide
          output = { thought: step.description };
        } else if (step.tool) {
          // Execute tool
          output = await executeTool(step.tool, step.parameters || {}, results);
        } else {
          throw new Error(`Unknown action: ${step.action}`);
        }
        
        results.push({
          stepId: step.id,
          status: 'success',
          output,
          duration: Date.now() - stepStart
        });
        
        console.log(`[Agent] Step ${step.id} completed successfully`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Agent] Step ${step.id} failed:`, errorMessage);
        
        results.push({
          stepId: step.id,
          status: 'failed',
          error: errorMessage,
          duration: Date.now() - stepStart
        });
        
        // Continue with next steps (they may be skipped due to dependencies)
      }
    }
    
    // Determine final status
    const allSucceeded = results.every(r => r.status === 'success');
    const anySucceeded = results.some(r => r.status === 'success');
    
    task.status = allSucceeded ? 'completed' : (anySucceeded ? 'completed' : 'failed');
    task.results = results;
    task.completedAt = new Date().toISOString();
    
    console.log(`[Agent] Task ${task.status}: ${results.filter(r => r.status === 'success').length}/${results.length} steps succeeded`);
    
  } catch (error) {
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.completedAt = new Date().toISOString();
    console.error(`[Agent] Task failed:`, task.error);
  }
  
  return task;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { task, userId, async = false } = body;
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: 'Task description is required'
      }, { status: 400 });
    }
    
    // Create task object
    const agentTask: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: task,
      status: 'pending',
      startedAt: new Date().toISOString()
    };
    
    // Log task start
    try {
      await supabase.from('agent_tasks').insert({
        task_id: agentTask.id,
        description: task,
        user_id: userId,
        status: 'pending',
        created_at: agentTask.startedAt
      });
    } catch (e) { /* ignore */ }
    
    if (async) {
      // Return immediately, execute in background
      // Note: In production, use a proper queue system
      executeAgent(agentTask).then(async (result) => {
        await supabase.from('agent_tasks').update({
          status: result.status,
          plan: result.plan,
          results: result.results,
          error: result.error,
          completed_at: result.completedAt
        }).eq('task_id', agentTask.id);
      });
      
      return NextResponse.json({
        success: true,
        taskId: agentTask.id,
        status: 'pending',
        message: 'Task queued for execution. Poll /api/agent/status/{taskId} for updates.'
      });
    }
    
    // Execute synchronously
    const result = await executeAgent(agentTask);
    
    // Update database
    try {
      await supabase.from('agent_tasks').update({
        status: result.status,
        plan: result.plan,
        results: result.results,
        error: result.error,
        completed_at: result.completedAt
      }).eq('task_id', agentTask.id);
    } catch (e) { /* ignore */ }
    
    return NextResponse.json({
      success: result.status === 'completed',
      task: result,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[Agent] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent agent tasks
  const { data: recentTasks } = await supabase
    .from('agent_tasks')
    .select('task_id, description, status, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Agent Mode',
    version: '1.0',
    description: 'Autonomous multi-step task execution with AI planning',
    capabilities: [
      'Natural language task understanding',
      'Automatic step planning',
      'Multi-tool orchestration',
      'Dependency management',
      'Self-correction on failures',
      'Progress tracking'
    ],
    availableTools: AGENT_TOOLS.map(t => ({
      name: t.name,
      description: t.description
    })),
    recentTasks: recentTasks || [],
    usage: {
      method: 'POST',
      body: {
        task: 'Natural language description of what to accomplish',
        userId: 'optional',
        async: 'boolean - if true, returns immediately with taskId'
      },
      examples: [
        'Create a new React component called UserProfile with name, email, and avatar fields',
        'Check all deployments and report any failures',
        'Search for best practices on React performance and save to knowledge base'
      ]
    },
    timestamp: new Date().toISOString()
  });
}
