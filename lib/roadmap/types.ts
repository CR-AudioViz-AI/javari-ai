export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";
export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  dependsOn: string[];
  status: TaskStatus;
  result?: string;
  error?: string;
  cost?: number;
}
export interface RoadmapPhase {
  id: string;
  title: string;
  tasks: RoadmapTask[];
  status: TaskStatus;
}
export interface Roadmap {
  id: string;
  title: string;
  phases: RoadmapPhase[];
  createdAt: number;
  updatedAt: number;
}
