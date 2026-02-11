// lib/javari/roadmap/types.ts

export interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours?: number;
  dependencies: string[];
  subtasks?: string[];
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  tasks: string[];
  estimatedDuration?: string;
}

export interface RoadmapMilestone {
  id: string;
  name: string;
  description: string;
  phaseId: string;
  criteria: string[];
}

export interface RoadmapDependency {
  fromTaskId: string;
  toTaskId: string;
  type: 'blocks' | 'enables' | 'requires';
}

export interface RoadmapRisk {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
  affectedTasks: string[];
}

export interface RoadmapResource {
  type: 'human' | 'tool' | 'infrastructure' | 'budget';
  name: string;
  allocation?: string;
}

export interface Roadmap {
  title: string;
  objective: string;
  phases: RoadmapPhase[];
  tasks: RoadmapTask[];
  milestones: RoadmapMilestone[];
  dependencies: RoadmapDependency[];
  risks: RoadmapRisk[];
  resources: RoadmapResource[];
  summary: string;
  estimatedTotalDuration?: string;
}

export interface RoadmapRequest {
  goal: string;
  context?: string;
  constraints?: string[];
  preferences?: {
    detailLevel?: 'high' | 'medium' | 'low';
    includeRisks?: boolean;
    includeResources?: boolean;
  };
}
