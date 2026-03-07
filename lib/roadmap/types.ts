// lib/roadmap/types.ts
// Purpose: Core type definitions for roadmap tasks, phases, and execution.
// Date: 2026-03-07 — added TaskType union and type field to RoadmapTask

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

/** Maps to devops task handlers in lib/execution/taskExecutor.ts */
export type TaskType =
  | "build_module"    // generate + commit a module file
  | "create_api"      // generate + commit an API route + deploy
  | "update_schema"   // run a Supabase SQL migration
  | "deploy_feature"  // commit files + trigger Vercel preview deploy
  | "ai_task"         // default: AI gateway execution only
  | string;           // extensible for future task types

export interface RoadmapTask {
  id         : string;
  title      : string;
  description: string;
  dependsOn  : string[];
  status     : TaskStatus;
  type?      : TaskType;          // if omitted, executor defaults to "ai_task"
  metadata?  : {                  // structured payload for DevOps handlers
    repo?       : string;
    filePath?   : string;
    fileContent?: string;
    sql?        : string;
    project?    : string;
  };
  result?    : string;
  error?     : string;
  cost?      : number;
}

export interface RoadmapPhase {
  id    : string;
  title : string;
  tasks : RoadmapTask[];
  status: TaskStatus;
}

export interface Roadmap {
  id        : string;
  title     : string;
  phases    : RoadmapPhase[];
  createdAt : number;
  updatedAt : number;
  maxBudget?: number; // USD
}
