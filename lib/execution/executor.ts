import {
  fetchPendingTasks,
  markTaskRunning,
  markTaskComplete,
  markTaskFailed,
} from "./queue";
import { RoadmapTask } from "./types";
import { runAI } from "../ai/router";

async function builder(task: RoadmapTask) {
  const prompt = `
Execute the following roadmap task:
Title: ${task.title}
Description: ${task.description}
  `;

  const result = await runAI("simple", prompt);

  return {
    model: result.model,
    output: result.output,
  };
}

async function validator(task: RoadmapTask, buildResult: any) {
  const validationPrompt = `
Validate the following output for the roadmap task.
Task: ${task.title}
Output:
${buildResult.output}

Respond with VALID or INVALID.
  `;

  const result = await runAI("validation", validationPrompt);

  return {
    valid: result.output.includes("VALID"),
    output: buildResult,
  };
}

export async function runExecutionCycle() {
  const tasks = await fetchPendingTasks();

  if (!tasks.length) {
    return { executed: 0 };
  }

  let executed = 0;

  for (const task of tasks) {
    try {
      await markTaskRunning(task);

      const buildResult = await builder(task);
      const validation = await validator(task, buildResult);

      if (validation.valid) {
        await markTaskComplete(task, validation.output);
        executed++;
      } else {
        await markTaskFailed(task, "Validation failed");
      }
    } catch (err: any) {
      await markTaskFailed(task, err.message || "Unknown execution error");
    }
  }

  return { executed };
}
