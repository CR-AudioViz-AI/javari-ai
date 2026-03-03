import { executeWithFailover } from "@/lib/ai/executeWithFailover"
function extractJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
export async function runMultiAgent(prompt: string) {
  const architect = await executeWithFailover(
    `You are the Architect AI.
Return ONLY valid JSON.
No explanation.
No markdown.
No commentary.
Schema:
{
  "phases": [
    {
      "name": "string",
      "objectives": ["string"],
      "components": ["string"],
      "risks": ["string"],
      "dependencies": ["string"]
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
  const parsedPlan = extractJSON(architect.content as string)
  if (!parsedPlan) {
    return { success: false, error: "Architect failed to return valid JSON." }
  }
  const builder = await executeWithFailover(
    `You are the Builder AI operating under enterprise-grade production standards.
You must execute this structured plan in full technical detail:
${JSON.stringify(parsedPlan, null, 2)}
Output must be deeply technical and implementation-ready.
`,
    "builder"
  )
  if (!builder.success) {
    return { success: false, error: builder.content }
  }
  return {
    success: true,
    architect: parsedPlan,
    builder: builder.content
  }
}
