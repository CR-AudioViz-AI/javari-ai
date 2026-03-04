import { Roadmap, RoadmapTask } from "./types";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import { saveRoadmap } from "./persistence";
import { logCost } from "./cost-logger";
const MAX_RETRIES = 2;
export class RoadmapExecutionEngine {
  private totalCost = 0;
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
  private isBudgetExceeded(): boolean {
    if (!this.roadmap.maxBudget) return false;
    return this.totalCost >= this.roadmap.maxBudget;
  }
  async run(): Promise<Roadmap> {
    for (const phase of this.roadmap.phases) {
      if (phase.status === "completed") continue;
      for (const task of phase.tasks) {
        if (this.isBudgetExceeded()) {
          task.status = "blocked";
          continue;
        }
        if (this.canExecute(task)) {
          await this.executeTask(task);
          await saveRoadmap(this.roadmap);
        }
      }
      phase.status = phase.tasks.every((t) => t.status === "completed")
        ? "completed"
        : "running";
      await saveRoadmap(this.roadmap);
    }
    this.roadmap.updatedAt = Date.now();
    await saveRoadmap(this.roadmap);
    return this.roadmap;
  }
  private async executeTask(task: RoadmapTask) {
    let attempts = 0;
    while (attempts <= MAX_RETRIES) {
      try {
        task.status = "running";
        attempts++;
        const response = await executeWithRouting(task.description);
        const tokens = response?.usage?.total_tokens ?? 0;
        const cost = response?.estimatedCost ?? 0;
        this.totalCost += cost;
        if (this.isBudgetExceeded()) {
          task.status = "blocked";
          task.error = "Budget exceeded";
          return;
        }
        task.result = response.output;
        task.status = "completed";
        task.cost = cost;
        await logCost({
          roadmapId: this.roadmap.id,
          taskId: task.id,
          model: response.model,
          provider: response.provider,
          tokens,
          cost,
        });
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
