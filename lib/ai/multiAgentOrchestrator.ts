import { executeWithFailover } from "@/lib/ai/executeWithFailover"
export async function runMultiAgent(prompt: string) {
  // 1️⃣ Architect plans
  const architect = await executeWithFailover(
    `You are the Architect AI operating under the Henderson Standard.
Return ONLY structured JSON in this format:
{
  "phases": [
    {
      "name": "Phase Name",
      "objectives": [],
      "components": [],
      "risks": [],
      "dependencies": []
    }
  ]
}
Task:
${prompt}
`,
    "architect"
  )
  if (!architect.success) {
    return { success: false, error: architect.content }
  }
  // 2️⃣ Builder executes plan
  const builder = await executeWithFailover(
    `You are the Builder AI. Execute the following plan precisely and produce final output.\n\nPlan:\n${architect.content}`,
    "builder"
  )
  if (!builder.success) {
    return { success: false, error: builder.content }
  }
  return {
    success: true,
    architect: architect.content,
    builder: builder.content
  }
}
