// app/api/competitor-intel/route.ts
// Javari Competitor Intelligence — crawls competitors weekly
// Identifies gaps, opportunities, and threats automatically
// CR AudioViz AI · EIN 39-3646201 · May 2026
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COMPETITORS = [
  { name: 'Jasper', url: 'https://jasper.ai', category: 'content', pricing_url: 'https://jasper.ai/pricing' },
  { name: 'Copy.ai', url: 'https://copy.ai', category: 'content', pricing_url: 'https://copy.ai/pricing' },
  { name: 'Canva', url: 'https://canva.com', category: 'design', pricing_url: 'https://canva.com/pricing' },
  { name: 'ElevenLabs', url: 'https://elevenlabs.io', category: 'voice', pricing_url: 'https://elevenlabs.io/pricing' },
  { name: 'Runway', url: 'https://runwayml.com', category: 'video', pricing_url: 'https://runwayml.com/pricing' },
  { name: 'Midjourney', url: 'https://midjourney.com', category: 'image', pricing_url: 'https://midjourney.com/pricing' },
  { name: 'Synthesia', url: 'https://synthesia.io', category: 'avatar-video', pricing_url: 'https://synthesia.io/pricing' },
]

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = []
  const openaiKey = process.env.OPENAI_API_KEY

  for (const competitor of COMPETITORS) {
    try {
      // Fetch competitor site
      const res = await fetch(competitor.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JavariBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      const html = await res.text()

      // Extract key info via AI analysis
      if (openaiKey) {
        const analysis = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Analyze this competitor AI tool homepage HTML and extract:
1. Main features (list up to 5)
2. Target audience
3. Key differentiators
4. Any new features mentioned
5. Pricing tier names if visible

HTML excerpt: ${html.substring(0, 3000)}

Respond in JSON: { features: [], audience: "", differentiators: [], new_features: [], pricing_tiers: [] }`
            }],
            response_format: { type: 'json_object' },
            max_tokens: 500,
          }),
        })
        const aiData = await analysis.json()
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}')

        results.push({
          competitor: competitor.name,
          category: competitor.category,
          url: competitor.url,
          ...parsed,
          analyzed_at: new Date().toISOString(),
        })
      } else {
        results.push({
          competitor: competitor.name,
          category: competitor.category,
          status: 'reachable',
          analyzed_at: new Date().toISOString(),
        })
      }
    } catch (e: any) {
      results.push({
        competitor: competitor.name,
        category: competitor.category,
        error: e.message,
        analyzed_at: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      analyzed: results.filter(r => r.features).length,
      errors: results.filter(r => r.error).length,
    },
    run_at: new Date().toISOString(),
  })
}
