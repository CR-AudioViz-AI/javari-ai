import { Roadmap, RoadmapTask } from "./types";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
const MAX_RETRIES = 2;
export class RoadmapExecutionEngine {
  private executionId = Date.now();
  constructor(private roadmap: Roadmap) {}
  private canExecute(task: RoadmapTask): boolean {
    return (
      task.status === "pending" &&
      task.dependsOn.every((depId) => {
        const dep = this.findTask(depId);
        return dep?.status === "completed";
      })
    );
  }
  private findTask(id: string): RoadmapTask | undefined {
    for (const phase of this.roadmap.phases) {
      const task = phase.tasks.find((t) => t.id === id);
      if (task) return task;
    }
  }
  async run(): Promise<Roadmap> {
    for (const phase of this.roadmap.phases) {
      if (phase.status === "completed") continue;
      for (const task of phase.tasks) {
        if (this.canExecute(task)) {
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
    let attempts = 0;
    while (attempts <= MAX_RETRIES) {
      try {
        task.status = "running";
        attempts++;
        const response = await executeWithRouting(task.description);
        task.result = JSON.stringify(response);
        task.status = "completed";
        task.cost = 0;
        return;
      } catch (err: any) {
        if (attempts > MAX_RETRIES) {
          task.status = "failed";
          task.error = err?.message ?? "Unknown error";
          return;
        }
      }
    }
  }
}
