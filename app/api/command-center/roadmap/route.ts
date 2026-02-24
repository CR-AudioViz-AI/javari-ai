/**
 * app/api/command-center/roadmap/route.ts
 * Command Center Roadmap Endpoint
 * Created: 2026-02-22 02:44 ET
 * 
 * Roadmap version control operations:
 * - GET: List roadmap versions
 * - POST: Create snapshot, restore version, compute diff
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RoadmapAction {
  operation: 'snapshot' | 'versions' | 'restore' | 'diff';
  roadmapId?: string;
  versionId?: string;
  versionA?: number;
  versionB?: number;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const roadmapId = searchParams.get('roadmapId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List versions
    let query = supabase
      .from('autonomy_roadmap_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (roadmapId) {
      query = query.eq('roadmap_id', roadmapId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch versions: ${error.message}`);
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      versions: data || [],
      count: data?.length || 0,
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Roadmap GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: RoadmapAction = await req.json();
    const { operation, roadmapId, versionId, versionA, versionB } = body;

    const validOps = ['snapshot', 'versions', 'restore', 'diff'];
    if (!validOps.includes(operation)) {
      return NextResponse.json(
        { error: 'Invalid operation', code: 'INVALID_OPERATION', validOperations: validOps },
        { status: 400 }
      );
    }

    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = {};

    switch (operation) {
      case 'snapshot': {
        if (!roadmapId) {
          return NextResponse.json(
            { error: 'roadmapId required for snapshot operation', code: 'MISSING_ROADMAP_ID' },
            { status: 400 }
          );
        }

        // Get current roadmap state
        const { data: roadmapData, error: roadmapError } = await supabase
          .from('autonomy_roadmaps')
          .select('*')
          .eq('roadmap_id', roadmapId)
          .single();

        if (roadmapError || !roadmapData) {
          return NextResponse.json(
            { error: 'Roadmap not found', code: 'ROADMAP_NOT_FOUND' },
            { status: 404 }
          );
        }

        // Get last version for diff calculation
        const { data: lastVersion } = await supabase
          .from('autonomy_roadmap_versions')
          .select('snapshot')
          .eq('roadmap_id', roadmapId)
          .order('version', { ascending: false })
          .limit(1)
          .single();

        const currentSnapshot = {
          roadmap_id: roadmapData.roadmap_id,
          title: roadmapData.title,
          status: roadmapData.status,
          tasks: roadmapData.tasks,
          dependencies: roadmapData.dependencies,
          metadata: roadmapData.metadata,
        };

        // Compute diff if previous version exists
        let diff = null;
        if (lastVersion) {
          diff = computeDiff(lastVersion.snapshot, currentSnapshot);
        }

        // Save snapshot
        const { data: snapshotData, error: snapshotError } = await supabase.rpc('save_roadmap_snapshot', {
          p_roadmap_id: roadmapId,
          p_snapshot: currentSnapshot,
          p_diff: diff,
          p_created_by: 'command_center_api',
        });

        if (snapshotError) {
          throw new Error(`Failed to save snapshot: ${snapshotError.message}`);
        }

        result = {
          snapshotId: snapshotData,
          roadmapId,
          timestamp: new Date().toISOString(),
          diff,
        };
        break;
      }

      case 'restore': {
        if (!versionId) {
          return NextResponse.json(
            { error: 'versionId required for restore operation', code: 'MISSING_VERSION_ID' },
            { status: 400 }
          );
        }

        // Get version snapshot
        const { data: versionData, error: versionError } = await supabase
          .from('autonomy_roadmap_versions')
          .select('*')
          .eq('id', versionId)
          .single();

        if (versionError || !versionData) {
          return NextResponse.json(
            { error: 'Version not found', code: 'VERSION_NOT_FOUND' },
            { status: 404 }
          );
        }

        // Restore snapshot to active roadmap
        const snapshot = versionData.snapshot;
        const { error: updateError } = await supabase
          .from('autonomy_roadmaps')
          .update({
            title: snapshot.title,
            tasks: snapshot.tasks,
            dependencies: snapshot.dependencies,
            metadata: snapshot.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('roadmap_id', snapshot.roadmap_id);

        if (updateError) {
          throw new Error(`Failed to restore: ${updateError.message}`);
        }

        result = {
          restored: true,
          versionId,
          roadmapId: snapshot.roadmap_id,
          version: versionData.version,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'diff': {
        if (versionA === undefined || versionB === undefined || !roadmapId) {
          return NextResponse.json(
            { error: 'roadmapId, versionA, and versionB required for diff operation', code: 'MISSING_PARAMS' },
            { status: 400 }
          );
        }

        // Get both versions
        const { data: versionsData, error: versionsError } = await supabase
          .from('autonomy_roadmap_versions')
          .select('*')
          .eq('roadmap_id', roadmapId)
          .in('version', [versionA, versionB]);

        if (versionsError || !versionsData || versionsData.length !== 2) {
          return NextResponse.json(
            { error: 'Versions not found', code: 'VERSIONS_NOT_FOUND' },
            { status: 404 }
          );
        }

        const vA = versionsData.find(v => v.version === versionA);
        const vB = versionsData.find(v => v.version === versionB);

        if (!vA || !vB) {
          return NextResponse.json(
            { error: 'Version mismatch', code: 'VERSION_MISMATCH' },
            { status: 404 }
          );
        }

        const diff = computeDiff(vA.snapshot, vB.snapshot);

        result = {
          roadmapId,
          versionA,
          versionB,
          diff,
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Unimplemented operation', code: 'NOT_IMPLEMENTED' },
          { status: 501 }
        );
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      operation,
      result,
    }, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Command Center Roadmap POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to compute diff between two snapshots
function computeDiff(oldSnapshot: any, newSnapshot: any): any {
  const diff: any = {
    added: [],
    removed: [],
    modified: [],
  };

  // Compare tasks
  const oldTasks = oldSnapshot.tasks || [];
  const newTasks = newSnapshot.tasks || [];

  const oldTaskIds = new Set(oldTasks.map((t: any) => t.id));
  const newTaskIds = new Set(newTasks.map((t: any) => t.id));

  // Find added tasks
  newTasks.forEach((task: any) => {
    if (!oldTaskIds.has(task.id)) {
      diff.added.push({ type: 'task', task });
    }
  });

  // Find removed tasks
  oldTasks.forEach((task: any) => {
    if (!newTaskIds.has(task.id)) {
      diff.removed.push({ type: 'task', task });
    }
  });

  // Find modified tasks
  newTasks.forEach((newTask: any) => {
    const oldTask = oldTasks.find((t: any) => t.id === newTask.id);
    if (oldTask) {
      const changes: any = {};
      if (oldTask.status !== newTask.status) changes.status = { old: oldTask.status, new: newTask.status };
      if (JSON.stringify(oldTask.dependencies) !== JSON.stringify(newTask.dependencies)) {
        changes.dependencies = { old: oldTask.dependencies, new: newTask.dependencies };
      }
      if (Object.keys(changes).length > 0) {
        diff.modified.push({ type: 'task', id: newTask.id, changes });
      }
    }
  });

  return diff;
}
