type ProviderResult = {
  success: boolean
  content?: string
  provider?: string
}
type ProviderExecutor = (prompt: string) => Promise<string | null>
interface Provider {
  name: string
  execute: ProviderExecutor
}
function getProviders(): Provider[] {
  return [
    {
      name: "anthropic",
      execute: async (prompt: string) => {
        const key = null
        if (!key) return null
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }]
          })
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.content?.[0]?.text ?? null
      }
    },
    {
      name: "openai",
      execute: async (prompt: string) => {
        const key = process.env.OPENAI_API_KEY
        if (!key) return null
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2048
          })
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.choices?.[0]?.message?.content ?? null
      }
    }
  ]
}
export async function executeWithFailover(prompt: string): Promise<ProviderResult> {
  const providers = getProviders()
  for (const provider of providers) {
    try {
      const result = await provider.execute(prompt)
      if (result) {
        return {
          success: true,
          content: result,
          provider: provider.name
        }
      }
    } catch {
      continue
    }
  }
  return {
    success: false,
    content: "Javari is switching execution engines. Please retry."
  }
}
