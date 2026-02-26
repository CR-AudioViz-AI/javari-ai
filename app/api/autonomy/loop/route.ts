import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const loopLog: string[] = [];
  const log = (msg: string) => {
    loopLog.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };

  try {
    log('AUTONOMY LOOP STARTED');

    // Get all tasks
    const { data: allTasks } = await supabase
      .from('execution_graph')
      .select('*')
      .order('priority', { ascending: false })
      .order('phase', { ascending: true });

    if (!allTasks) {
      throw new Error('Failed to load tasks');
    }

    log(`Loaded ${allTasks.length} tasks`);

    // Find ready tasks (status=pending, no unmet dependencies)
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const readyTasks = [];

    for (const task of allTasks) {
      if (task.status !== 'pending') continue;

      const deps = task.dependencies || [];
      const unmet = deps.filter(depId => {
        const depTask = taskMap.get(depId);
        return depTask && depTask.status !== 'complete';
      });

      if (unmet.length === 0) {
        readyTasks.push(task);
      }
    }

    log(`Found ${readyTasks.length} ready tasks`);

    // Execute ready tasks (limit to 5 per loop)
    const tasksToExecute = readyTasks.slice(0, 5);
    const executed = [];

    for (const task of tasksToExecute) {
      log(`Executing: ${task.title}`);

      // Call execute API
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/autonomy/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id })
      });

      const result = await response.json();
      
      if (result.success) {
        log(`  ✓ Completed: ${task.title}`);
        executed.push(task.id);
      } else {
        log(`  ✗ Failed: ${task.title} - ${result.error}`);
      }
    }

    log(`Executed ${executed.length} tasks`);
    log('AUTONOMY LOOP COMPLETE');

    return NextResponse.json({
      success: true,
      total_tasks: allTasks.length,
      ready_tasks: readyTasks.length,
      executed_tasks: executed.length,
      executed_ids: executed,
      log: loopLog
    });

  } catch (error: any) {
    log(`ERROR: ${error.message}`);
    return NextResponse.json({
      success: false,
      error: error.message,
      log: loopLog
    }, { status: 500 });
  }
}
