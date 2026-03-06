/**
 * Roadmap Execution API
 * Orchestrates full roadmap execution workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { loadRoadmap } from "@/lib/roadmap/roadmap-loader";
import { processQueue } from "@/lib/execution/queue";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/javari/start-roadmap
 * Start roadmap execution workflow
 */
export async function POST(req: NextRequest) {
  const executionId = `exec-${Date.now()}`;
  
  console.log("[start-roadmap] ====== STARTING ROADMAP EXECUTION ======");
  console.log("[start-roadmap] Execution ID:", executionId);

  try {
    const body = await req.json();
    const { 
      roadmapId,
      userId = "roadmap-executor",
      autoStart = true,
      maxTasks = 5 
    } = body;

    // Step 1: Load canonical roadmap
    console.log("[start-roadmap] Step 1: Loading canonical roadmap...");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let roadmapTasks: any[] = [];

    if (roadmapId) {
      // Load specific roadmap from database
      const { data, error } = await supabase
        .from("roadmaps")
        .select("tasks")
        .eq("roadmap_id", roadmapId)
        .single();

      if (error) {
        console.error("[start-roadmap] Error loading roadmap:", error.message);
        return NextResponse.json(
          { ok: false, error: `Failed to load roadmap: ${error.message}` },
          { status: 404 }
        );
      }

      roadmapTasks = data?.tasks || [];
    } else {
      // Use default/canonical roadmap if no ID provided
      // This would load from a predefined location
      console.log("[start-roadmap] No roadmapId provided, using default roadmap");
      
      // For now, return error - require roadmapId
      return NextResponse.json(
        { ok: false, error: "roadmapId is required" },
        { status: 400 }
      );
    }

    if (!roadmapTasks || roadmapTasks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No tasks found in roadmap" },
        { status: 400 }
      );
    }

    console.log(`[start-roadmap] ✅ Loaded ${roadmapTasks.length} tasks`);

    // Step 2: Run ingestion engine (convert to RoadmapItem format)
    console.log("[start-roadmap] Step 2: Running ingestion engine...");
    
    const formattedTasks = roadmapTasks.map((task: any, index: number) => ({
      id: task.id || `task-${Date.now()}-${index}`,
      title: task.title || `Task ${index + 1}`,
      description: task.description || "",
      priority: task.priority || 5,
      dependencies: task.dependencies || [],
    }));

    console.log("[start-roadmap] ✅ Tasks formatted for ingestion");

    // Step 3: Populate roadmap_tasks table
    console.log("[start-roadmap] Step 3: Populating roadmap_tasks...");
    
    const ingestionResult = loadRoadmap(formattedTasks);
    
    if (!ingestionResult.success) {
      return NextResponse.json(
        { ok: false, error: ingestionResult.error },
        { status: 500 }
      );
    }

    console.log(`[start-roadmap] ✅ Loaded ${ingestionResult.tasksLoaded} tasks into queue`);

    // Step 4: Begin execution queue (if autoStart is true)
    let queueResult = null;
    
    if (autoStart) {
      console.log("[start-roadmap] Step 4: Starting execution queue...");
      
      queueResult = await processQueue(maxTasks, userId);
      
      console.log(`[start-roadmap] ✅ Queue processed: ${queueResult.executed} tasks executed`);
    } else {
      console.log("[start-roadmap] Step 4: Skipped (autoStart = false)");
    }

    // Step 5: Return execution summary
    console.log("[start-roadmap] ✅ Roadmap execution initiated");

    return NextResponse.json({
      ok: true,
      execution_id: executionId,
      tasks_loaded: ingestionResult.tasksLoaded,
      tasks_executed: queueResult?.executed || 0,
      tasks_succeeded: queueResult?.succeeded || 0,
      tasks_failed: queueResult?.failed || 0,
      auto_started: autoStart,
      roadmap_id: roadmapId,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[start-roadmap] ❌ Execution failed:", error.message);
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message,
        execution_id: executionId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/start-roadmap?execution_id=xxx
 * Get execution status
 */
export async function GET(req: NextRequest) {
  try {
    const executionId = req.nextUrl.searchParams.get("execution_id");

    if (!executionId) {
      return NextResponse.json(
        { ok: false, error: "execution_id parameter required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get execution logs for this execution
    const { data: logs, error: logsError } = await supabase
      .from("execution_logs")
      .select("*")
      .eq("execution_id", executionId)
      .order("timestamp", { ascending: false });

    if (logsError) {
      console.error("[start-roadmap] Error fetching logs:", logsError.message);
    }

    // Get current queue stats
    const { data: tasks, error: tasksError } = await supabase
      .from("roadmap_tasks")
      .select("status");

    if (tasksError) {
      console.error("[start-roadmap] Error fetching tasks:", tasksError.message);
    }

    const stats = {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === "pending").length || 0,
      in_progress: tasks?.filter(t => t.status === "in_progress").length || 0,
      completed: tasks?.filter(t => t.status === "completed").length || 0,
      failed: tasks?.filter(t => t.status === "failed").length || 0,
      retry: tasks?.filter(t => t.status === "retry").length || 0,
    };

    return NextResponse.json({
      ok: true,
      execution_id: executionId,
      stats,
      logs: logs || [],
      log_count: logs?.length || 0,
    });

  } catch (error: any) {
    console.error("[start-roadmap] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
