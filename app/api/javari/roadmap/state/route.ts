import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get all tasks from execution_graph
    const { data: tasks, error } = await supabase
      .from('execution_graph')
      .select('*')
      .order('phase', { ascending: true })
      .order('priority', { ascending: false });

    if (error) throw error;

    // Group by phase
    const phases = [
      { id: 'p0', name: 'Phase 0 — Foundation', order: 1, status: 'active', tasks: [] },
      { id: 'p1', name: 'Phase 1 — Architecture', order: 2, status: 'idle', tasks: [] },
      { id: 'p2', name: 'Phase 2 — Integration', order: 3, status: 'idle', tasks: [] },
      { id: 'p3', name: 'Phase 3 — UI Layer', order: 4, status: 'idle', tasks: [] },
      { id: 'p4', name: 'Phase 4 — Deployment', order: 5, status: 'idle', tasks: [] },
      { id: 'p5', name: 'Phase 5 — Operations', order: 6, status: 'idle', tasks: [] },
    ];

    tasks?.forEach((task: any) => {
      const phaseIdx = task.phase || 0;
      if (phases[phaseIdx]) {
        phases[phaseIdx].tasks.push({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority >= 5 ? 'critical' : task.priority >= 4 ? 'high' : task.priority >= 3 ? 'medium' : 'low',
          dependencies: task.dependencies || [],
          estimatedHours: task.estimated_effort_hours
        });
      }
    });

    const completedTasks = tasks?.filter(t => t.status === 'complete').length || 0;
    const totalTasks = tasks?.length || 0;

    const roadmap = {
      id: 'master-roadmap-v2',
      title: 'CR AudioViz AI Master Roadmap V2.0',
      version: '2.0.0',
      status: 'executing',
      progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      totalTasks,
      completedTasks,
      failedTasks: tasks?.filter(t => t.status === 'failed').length || 0,
      phases,
      milestones: [
        { id: 'm1', name: 'Foundation Complete', achieved: false },
        { id: 'm2', name: 'Architecture Defined', achieved: false },
        { id: 'm3', name: 'Core Integration Live', achieved: false },
        { id: 'm4', name: 'UI Layer Deployed', achieved: false },
        { id: 'm5', name: 'Production Ready', achieved: false }
      ],
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({ success: true, roadmap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
