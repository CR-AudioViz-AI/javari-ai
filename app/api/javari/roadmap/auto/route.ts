// /app/api/javari/roadmap/auto/route.ts
// Autonomous roadmap execution loop with AI provider integration
// Created: 2025-02-02 23:40 EST
// Updated: 2025-02-03 00:30 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AutoExecuteRequest {
  roadmapId: string;
}

interface RoadmapState {
  id: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completion_percentage: number;
}

interface TaskRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  dependencies: string[];
  metadata: Record<string, any>;
}

interface AIProviderResponse {
  success: boolean;
  content?: string;
  error?: string;
  provider?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const MAX_ITERATIONS = 50;
  let iterationCount = 0;

  try {
    const body: AutoExecuteRequest = await request.json();
    const { roadmapId } = body;

    if (!roadmapId) {
      return NextResponse.json(
        { error: 'roadmapId is required' },
        { status: 400 }
      );
    }

    // Force roadmap into executing state before loop
    await supabase
      .from('javari_roadmaps')
      .update({
        status: 'executing',
        updated_at: new Date().toISOString()
      })
      .eq('id', roadmapId);

    // Initial roadmap state fetch
    let roadmapState = await fetchRoadmapState(supabase, roadmapId);
    
    if (!roadmapState) {
      return NextResponse.json(
        { error: 'Roadmap not found' },
        { status: 404 }
      );
    }

    // Execute loop
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // Execute one task
      const executed = await executeNextTask(supabase, roadmapId);

      if (!executed) {
        // No eligible tasks - mark as blocked or completed
        const pendingCount = roadmapState.pending_tasks;
        const newStatus = pendingCount > 0 ? 'blocked' : 'completed';
        
        await supabase
          .from('javari_roadmaps')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', roadmapId);

        roadmapState.status = newStatus;
        break;
      }

      // Reload state after execution
      const updatedState = await fetchRoadmapState(supabase, roadmapId);
      
      if (!updatedState) {
        break;
      }

      roadmapState = updatedState;

      // Check break conditions
      if (roadmapState.status === 'blocked' || roadmapState.status === 'completed') {
        break;
      }
    }

    // Return final state
    return NextResponse.json({
      roadmapId,
      finalStatus: roadmapState.status,
      totalTasks: roadmapState.total_tasks,
      completedTasks: roadmapState.completed_tasks,
      completionPercentage: roadmapState.completion_percentage,
      iterations: iterationCount,
      maxIterationsReached: iterationCount >= MAX_ITERATIONS
    });

  } catch (error) {
    console.error('Autonomous execution error:', error);
    return NextResponse.json(
      { 
        error: 'Autonomous execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function fetchRoadmapState(
  supabase: any,
  roadmapId: string
): Promise<RoadmapState | null> {
  try {
    // Get task counts
    const { data: tasks, error: tasksError } = await supabase
      .from('roadmap_tasks')
      .select('status')
      .eq('roadmap_id', roadmapId);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return null;
    }

    const total = tasks?.length || 0;
    const completed = tasks?.filter((t: any) => t.status === 'complete').length || 0;
    const pending = tasks?.filter((t: any) => t.status === 'pending').length || 0;
    const inProgress = tasks?.filter((t: any) => t.status === 'in_progress').length || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get roadmap status
    const { data: roadmap, error: roadmapError } = await supabase
      .from('javari_roadmaps')
      .select('id, status')
      .eq('id', roadmapId)
      .single();

    if (roadmapError) {
      console.error('Error fetching roadmap:', roadmapError);
      return null;
    }

    return {
      id: roadmapId,
      status: roadmap?.status || 'pending',
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      in_progress_tasks: inProgress,
      completion_percentage: percentage
    };

  } catch (error) {
    console.error('fetchRoadmapState error:', error);
    return null;
  }
}

async function executeNextTask(
  supabase: any,
  roadmapId: string
): Promise<boolean> {
  try {
    // Fetch all tasks for dependency checking
    const { data: allTasks, error: fetchError } = await supabase
      .from('roadmap_tasks')
      .select('id, name, description, status, priority, dependencies, metadata')
      .eq('roadmap_id', roadmapId)
      .order('priority', { ascending: true });

    if (fetchError || !allTasks) {
      console.error('Error fetching tasks:', fetchError);
      return false;
    }

    const tasks: TaskRecord[] = allTasks;
    const completedTaskIds = new Set(
      tasks.filter(t => t.status === 'complete').map(t => t.id)
    );

    // Find first eligible pending task
    const eligibleTask = tasks.find(task => {
      if (task.status !== 'pending') return false;
      
      // Check dependencies
      const deps = Array.isArray(task.dependencies) ? task.dependencies : [];
      return deps.every(depId => completedTaskIds.has(depId));
    });

    if (!eligibleTask) {
      return false;
    }

    // STEP 1: Mark task as in_progress
    const { error: inProgressError } = await supabase
      .from('roadmap_tasks')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', eligibleTask.id);

    if (inProgressError) {
      console.error('Error marking task in_progress:', inProgressError);
      return false;
    }

    // STEP 2: Execute AI provider logic
    const aiResponse = await executeWithAIProvider(eligibleTask);

    // STEP 3 & 4: Persist result or error
    if (aiResponse.success) {
      const { error: completeError } = await supabase
        .from('roadmap_tasks')
        .update({
          status: 'complete',
          metadata: {
            ...eligibleTask.metadata,
            result: aiResponse.content,
            provider: aiResponse.provider,
            completed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', eligibleTask.id);

      if (completeError) {
        console.error('Error marking task complete:', completeError);
        return false;
      }

      return true;

    } else {
      // Provider failed - mark as failed but don't crash loop
      const { error: failedError } = await supabase
        .from('roadmap_tasks')
        .update({
          status: 'failed',
          metadata: {
            ...eligibleTask.metadata,
            error: aiResponse.error || 'AI provider execution failed',
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', eligibleTask.id);

      if (failedError) {
        console.error('Error marking task failed:', failedError);
      }

      // Return false to signal no successful execution, triggering roadmap blocked state
      return false;
    }

  } catch (error) {
    console.error('executeNextTask error:', error);
    return false;
  }
}

async function executeWithAIProvider(task: TaskRecord): Promise<AIProviderResponse> {
  try {
    // Construct prompt from task
    const prompt = `Task: ${task.name}\n\nDescription: ${task.description}\n\nExecute this task and provide a detailed result.`;

    // Provider priority order
    const providers = [
      { name: 'anthropic', execute: executeWithAnthropic },
      { name: 'openai', execute: executeWithOpenAI },
      { name: 'gemini', execute: executeWithGemini },
      { name: 'openrouter', execute: executeWithOpenRouter }
    ];

    // Try each provider in sequence until one succeeds
    for (const provider of providers) {
      try {
        const result = await provider.execute(prompt);
        if (result) {
          return {
            success: true,
            content: result,
            provider: provider.name
          };
        }
      } catch (providerError) {
        console.error(`Provider ${provider.name} failed:`, providerError);
        continue;
      }
    }

    // All providers failed
    return {
      success: false,
      error: 'All AI providers failed'
    };

  } catch (error) {
    console.error('executeWithAIProvider error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown AI execution error'
    };
  }
}

async function executeWithAnthropic(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content?.[0]?.text || null;

  } catch (error) {
    console.error('Anthropic execution error:', error);
    return null;
  }
}

async function executeWithOpenAI(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 4096
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;

  } catch (error) {
    console.error('OpenAI execution error:', error);
    return null;
  }
}

async function executeWithGemini(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ]
        })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;

  } catch (error) {
    console.error('Gemini execution error:', error);
    return null;
  }
}

async function executeWithOpenRouter(prompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://javariai.com',
        'X-Title': 'Javari AI Roadmap Executor'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;

  } catch (error) {
    console.error('OpenRouter execution error:', error);
    return null;
  }
}
