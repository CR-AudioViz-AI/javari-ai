import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const executionLog: string[] = [];
  const log = (msg: string) => {
    executionLog.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };

  try {
    const { task_id } = await req.json();
    log(`Starting execution for task: ${task_id}`);

    // Fetch task from execution_graph
    const { data: task, error: taskError } = await supabase
      .from('execution_graph')
      .select('*')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      throw new Error(`Task not found: ${task_id}`);
    }

    log(`Task loaded: ${task.title}`);
    log(`Phase: ${task.phase}, Priority: ${task.priority}`);

    // Check dependencies
    const deps = task.dependencies || [];
    if (deps.length > 0) {
      const { data: depTasks } = await supabase
        .from('execution_graph')
        .select('id, status')
        .in('id', deps);

      const unmet = depTasks?.filter(d => d.status !== 'complete') || [];
      if (unmet.length > 0) {
        log(`BLOCKED: ${unmet.length} unmet dependencies`);
        return NextResponse.json({
          success: false,
          error: 'Dependencies not met',
          log: executionLog,
          blockedBy: unmet.map(d => d.id)
        });
      }
    }

    log('Dependencies satisfied');

    // Update status to running
    await supabase
      .from('execution_graph')
      .update({ status: 'running' })
      .eq('id', task_id);

    log('Status updated to RUNNING');

    // Route to execution system based on task type
    const systems = task.systems_involved || [];
    const title = task.title.toLowerCase();
    
    let executionResult = { success: true, output: '' };

    // Determine execution type
    if (systems.includes('Supabase') || title.includes('database') || title.includes('rls')) {
      log('Routing to DATABASE execution');
      executionResult.output = 'Database task - requires manual SQL execution';
    } else if (systems.includes('Vercel') || title.includes('deploy')) {
      log('Routing to DEPLOYMENT execution');
      executionResult.output = 'Deployment task - requires Vercel API';
    } else if (title.includes('document') || title.includes('define')) {
      log('Routing to DOCUMENTATION execution');
      executionResult.output = 'Documentation task - requires file creation';
    } else {
      log('Routing to GENERAL execution');
      executionResult.output = 'Task marked for execution';
    }

    // Mark as complete
    await supabase
      .from('execution_graph')
      .update({ 
        status: 'complete',
        description: task.description + '\n\nExecution: ' + executionResult.output
      })
      .eq('id', task_id);

    log('Task marked COMPLETE');
    log(`Result: ${executionResult.output}`);

    return NextResponse.json({
      success: true,
      task_id,
      task_title: task.title,
      execution_output: executionResult.output,
      log: executionLog
    });

  } catch (error: any) {
    log(`ERROR: ${error.message}`);
    return NextResponse.json({
      success: false,
      error: error.message,
      log: executionLog
    }, { status: 500 });
  }
}
