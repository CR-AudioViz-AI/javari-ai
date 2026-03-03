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
  let parsedPlan
  try {
    parsedPlan = JSON.parse(architect.content as string)
  } catch {
    return {
      success: false,
      error: "Architect did not return valid JSON plan."
    }
  }
  // 2️⃣ Builder executes plan
  const builder = await executeWithFailover(
    `You are the Builder AI operating under production-grade engineering standards.
You must strictly follow this execution plan:
${JSON.stringify(parsedPlan, null, 2)}
Produce a complete, enterprise-grade implementation strategy.`,
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
