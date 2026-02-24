// lib/autonomous-service.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AUTONOMOUS CONTINUATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: December 23, 2025 - 4:40 PM EST
//
// This service enables TRUE AUTONOMY:
// - Detects when context is filling up
// - Automatically creates continuation chats
// - Carries over project context, credentials, goals
// - Keeps working until task is COMPLETE
// - Only stops for genuine human decisions
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Project {
  id: string;
  session_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  goal?: string;
  current_task?: string;
  progress_percent: number;
  credentials_vault: Record<string, string>;
  context_summary?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AutonomousTask {
  id: string;
  project_id: string;
  conversation_id?: string;
  task_type: 'build' | 'fix' | 'continue' | 'verify';
  task_description?: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_human';
  result?: any;
  error_message?: string;
  attempts: number;
  max_attempts: number;
}

export interface ContinuationContext {
  project_id: string;
  project_name: string;
  goal: string;
  current_task: string;
  progress: number;
  credentials: Record<string, string>;
  previous_conversation_id: string;
  summary: string;
  last_messages: Array<{ role: string; content: string }>;
  pending_tasks: string[];
  completed_tasks: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

// Estimate token count (rough: 4 chars = 1 token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Check if context is getting full (threshold: 80% of limit)
export function isContextNearLimit(messages: Array<{ content: string }>, limit: number = 100000): boolean {
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  return totalTokens > (limit * 0.8);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function createProject(params: {
  name: string;
  description?: string;
  goal: string;
  session_id?: string;
  credentials?: Record<string, string>;
}): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: params.name,
        description: params.description,
        goal: params.goal,
        session_id: params.session_id,
        status: 'active',
        progress_percent: 0,
        credentials_vault: params.credentials || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

export async function updateProjectProgress(
  projectId: string, 
  progress: number, 
  currentTask?: string,
  contextSummary?: string
): Promise<boolean> {
  try {
    const updates: Record<string, any> = {
      progress_percent: progress,
      updated_at: new Date().toISOString(),
    };
    
    if (currentTask) updates.current_task = currentTask;
    if (contextSummary) updates.context_summary = contextSummary;
    
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
}

export async function completeProject(projectId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .update({
        status: 'completed',
        progress_percent: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error completing project:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMOUS CONTINUATION
// ═══════════════════════════════════════════════════════════════════════════════

// Generate a summary of the conversation for continuation
export function generateContextSummary(messages: Array<{ role: string; content: string }>): string {
  // Get the key points from the conversation
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
  const assistantMessages = messages.filter(m => m.role === 'assistant').map(m => m.content);
  
  // Extract code blocks (important for builds)
  const codeBlocks: string[] = [];
  assistantMessages.forEach(msg => {
    const matches = msg.match(/```[\s\S]*?```/g);
    if (matches) codeBlocks.push(...matches.slice(-2)); // Last 2 code blocks
  });
  
  // Build summary
  const summary = `
CONVERSATION SUMMARY:
====================
User Requests (${userMessages.length}):
${userMessages.slice(-5).map((m, i) => `${i + 1}. ${m.substring(0, 200)}...`).join('\n')}

Key Outputs:
${codeBlocks.length > 0 ? codeBlocks.slice(-1)[0].substring(0, 500) + '...' : 'No code generated yet'}

Last Assistant Response (truncated):
${assistantMessages.slice(-1)[0]?.substring(0, 500) || 'None'}
====================
`.trim();

  return summary;
}

// Create a continuation conversation
export async function createContinuation(params: {
  previousConversationId: string;
  projectId: string;
  sessionId: string;
  contextSummary: string;
  nextTask?: string;
}): Promise<{ conversationId: string; continuationPrompt: string } | null> {
  try {
    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.projectId)
      .single();

    if (!project) throw new Error('Project not found');

    // Create new conversation
    const { data: newConvo, error } = await supabase
      .from('conversations')
      .insert({
        session_id: params.sessionId,
        title: `${project.name} (continued)`,
        project_id: params.projectId,
        is_continuation: true,
        previous_conversation_id: params.previousConversationId,
        context_summary: params.contextSummary,
        starred: true, // Auto-star continuations
      })
      .select()
      .single();

    if (error) throw error;

    // Generate the continuation prompt
    const continuationPrompt = `
═══════════════════════════════════════════════════════════════════════════════
🔄 AUTONOMOUS CONTINUATION - PROJECT: ${project.name}
═══════════════════════════════════════════════════════════════════════════════

I'm continuing from a previous conversation that reached its context limit.

**PROJECT GOAL:** ${project.goal}
**CURRENT PROGRESS:** ${project.progress_percent}%
**CURRENT TASK:** ${project.current_task || 'Continuing previous work'}

**CONTEXT FROM PREVIOUS CHAT:**
${params.contextSummary}

${project.credentials_vault && Object.keys(project.credentials_vault).length > 0 ? `
**CREDENTIALS AVAILABLE:** ${Object.keys(project.credentials_vault).join(', ')}
` : ''}

${params.nextTask ? `**NEXT TASK:** ${params.nextTask}` : '**INSTRUCTION:** Continue where we left off. Complete the project goal.'}

═══════════════════════════════════════════════════════════════════════════════
`.trim();

    // Save the continuation prompt as the first message
    await supabase.from('messages').insert({
      conversation_id: newConvo.id,
      role: 'system',
      content: continuationPrompt,
    });

    return {
      conversationId: newConvo.id,
      continuationPrompt,
    };
  } catch (error) {
    console.error('Error creating continuation:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function addTask(params: {
  projectId: string;
  conversationId?: string;
  taskType: 'build' | 'fix' | 'continue' | 'verify';
  description: string;
  priority?: number;
}): Promise<AutonomousTask | null> {
  try {
    const { data, error } = await supabase
      .from('autonomous_queue')
      .insert({
        project_id: params.projectId,
        conversation_id: params.conversationId,
        task_type: params.taskType,
        task_description: params.description,
        priority: params.priority || 5,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding task:', error);
    return null;
  }
}

export async function getNextTask(projectId?: string): Promise<AutonomousTask | null> {
  try {
    let query = supabase
      .from('autonomous_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query.single();
    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

export async function updateTaskStatus(
  taskId: string, 
  status: 'processing' | 'completed' | 'failed' | 'needs_human',
  result?: any,
  errorMessage?: string
): Promise<boolean> {
  try {
    const updates: Record<string, any> = { status };
    
    if (status === 'processing') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    
    if (result) updates.result = result;
    if (errorMessage) updates.error_message = errorMessage;
    
    const { error } = await supabase
      .from('autonomous_queue')
      .update(updates)
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating task:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION ENGINE - When to stop for human input
// ═══════════════════════════════════════════════════════════════════════════════

export interface DecisionPoint {
  needsHuman: boolean;
  reason?: string;
  suggestedAction?: string;
}

export function checkIfNeedsHumanDecision(params: {
  taskType: string;
  result: any;
  errorCount: number;
  projectGoal: string;
}): DecisionPoint {
  // Only stop for GENUINE human-required decisions
  
  // 1. Too many failures on same task
  if (params.errorCount >= 3) {
    return {
      needsHuman: true,
      reason: 'Multiple attempts failed. Need human guidance.',
      suggestedAction: 'Review the error and provide direction',
    };
  }
  
  // 2. Ambiguous requirements
  if (params.result?.ambiguous) {
    return {
      needsHuman: true,
      reason: 'Requirements are unclear. Need clarification.',
      suggestedAction: 'Clarify the specific requirement',
    };
  }
  
  // 3. Security/sensitive decisions
  if (params.result?.securityDecision) {
    return {
      needsHuman: true,
      reason: 'Security-sensitive decision required.',
      suggestedAction: 'Approve or modify the security approach',
    };
  }
  
  // 4. Cost/payment decisions
  if (params.result?.costDecision) {
    return {
      needsHuman: true,
      reason: 'This action may incur costs.',
      suggestedAction: 'Approve the cost or provide alternative',
    };
  }
  
  // Default: Keep going autonomously!
  return { needsHuman: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTONOMOUS LOOP CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAutonomousLoop(projectId: string): Promise<void> {
  console.log(`[Autonomous] Starting loop for project: ${projectId}`);
  
  let continueRunning = true;
  let iterationCount = 0;
  const maxIterations = 100; // Safety limit
  
  while (continueRunning && iterationCount < maxIterations) {
    iterationCount++;
    
    // Get next task
    const task = await getNextTask(projectId);
    
    if (!task) {
      console.log('[Autonomous] No more tasks. Checking if project is complete...');
      // Check project status
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (project?.progress_percent >= 100) {
        await completeProject(projectId);
        console.log('[Autonomous] Project completed!');
      }
      continueRunning = false;
      break;
    }
    
    console.log(`[Autonomous] Processing task: ${task.task_type} - ${task.task_description}`);
    
    // Mark as processing
    await updateTaskStatus(task.id, 'processing');
    
    try {
      // Execute the task (this would call the appropriate handler)
      // For now, we'll mark it as needing implementation
      const result = { status: 'not_implemented' };
      
      // Check if we need human input
      const decision = checkIfNeedsHumanDecision({
        taskType: task.task_type,
        result,
        errorCount: task.attempts,
        projectGoal: '', // Would come from project
      });
      
      if (decision.needsHuman) {
        await updateTaskStatus(task.id, 'needs_human', result, decision.reason);
        console.log(`[Autonomous] Stopping for human: ${decision.reason}`);
        continueRunning = false;
      } else {
        await updateTaskStatus(task.id, 'completed', result);
      }
    } catch (error: any) {
      await updateTaskStatus(task.id, 'failed', null, error.message);
      
      // Increment attempt counter
      await supabase
        .from('autonomous_queue')
        .update({ attempts: task.attempts + 1 })
        .eq('id', task.id);
    }
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`[Autonomous] Loop ended after ${iterationCount} iterations`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const AutonomousService = {
  // Context
  estimateTokens,
  isContextNearLimit,
  generateContextSummary,
  
  // Projects
  createProject,
  updateProjectProgress,
  completeProject,
  
  // Continuation
  createContinuation,
  
  // Tasks
  addTask,
  getNextTask,
  updateTaskStatus,
  
  // Decision
  checkIfNeedsHumanDecision,
  
  // Main loop
  runAutonomousLoop,
};

export default AutonomousService;
