import { Roadmap, RoadmapTask } from "./types";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
export class RoadmapExecutionEngine {
  constructor(private roadmap: Roadmap) {}
  private canExecute(task: RoadmapTask): boolean {
    return task.dependsOn.every((depId) => {
      const dep = this.findTask(depId);
      return dep?.status === "completed";
    });
  }
  private findTask(id: string): RoadmapTask | undefined {
    for (const phase of this.roadmap.phases) {
      const task = phase.tasks.find((t) => t.id === id);
      if (task) return task;
    }
  }
  async run(): Promise<Roadmap> {
    for (const phase of this.roadmap.phases) {
      for (const task of phase.tasks) {
        if (task.status === "pending" && this.canExecute(task)) {
          await this.executeTask(task);
        }
      }
      phase.status = phase.tasks.every((t) => t.status === "completed")
        ? "completed"
        : "running";
    }
    this.roadmap.updatedAt = Date.now();
    return this.roadmap;
  }
  private async executeTask(task: RoadmapTask) {
    try {
      task.status = "running";
      const response = await executeWithRouting(task.description);
      task.result = JSON.stringify(response);
      task.status = "completed";
      task.cost = 0; // placeholder — will wire telemetry later
    } catch (err: any) {
      task.status = "failed";
      task.error = err?.message ?? "Unknown error";
    }
  }
}
