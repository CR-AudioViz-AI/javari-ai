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
    `You are the Builder AI operating under production-grade engineering standards.
Execute the following structured plan in full detail.
Output must be implementation-ready.
Plan JSON:
${architect.content}
`,
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
