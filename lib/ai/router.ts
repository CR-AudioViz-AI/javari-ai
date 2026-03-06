import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TaskType = "simple" | "reasoning" | "validation";

function selectModel(taskType: TaskType) {
  switch (taskType) {
    case "reasoning":
      return "gpt-4o";
    case "validation":
      return "gpt-4o-mini";
    default:
      return "gpt-4o-mini";
  }
}

export async function runAI(taskType: TaskType, prompt: string) {
  const model = selectModel(taskType);

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    model,
    output: response.choices[0].message.content,
  };
}
