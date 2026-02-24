/**
 * Multi-Provider Adapters
 * VoyageAI, JinaAI, Nomic, StabilityAI
 */

// ============================================================================
// VOYAGEAI - Embeddings
// ============================================================================

export async function callVoyage(texts: string[], apiKey?: string): Promise<number[][]> {
  const token = apiKey || process.env.VOYAGE_API_KEY;
  if (!token) throw new Error('VOYAGE_API_KEY not configured');

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'voyage-2' }),
  });

  if (!response.ok) throw new Error(`Voyage error: ${response.status}`);
  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

// ============================================================================
// JINAAI - Embeddings
// ============================================================================

export async function callJina(texts: string[], apiKey?: string): Promise<number[][]> {
  const token = apiKey || process.env.JINA_API_KEY;
  if (!token) throw new Error('JINA_API_KEY not configured');

  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'jina-embeddings-v2-base-en' }),
  });

  if (!response.ok) throw new Error(`Jina error: ${response.status}`);
  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

// ============================================================================
// NOMIC - Embeddings
// ============================================================================

export async function callNomic(texts: string[], apiKey?: string): Promise<number[][]> {
  const token = apiKey || process.env.NOMIC_API_KEY;
  if (!token) throw new Error('NOMIC_API_KEY not configured');

  const response = await fetch('https://api-atlas.nomic.ai/v1/embedding/text', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, model: 'nomic-embed-text-v1' }),
  });

  if (!response.ok) throw new Error(`Nomic error: ${response.status}`);
  const data = await response.json();
  return data.embeddings;
}

// ============================================================================
// STABILITYAI - Image Generation
// ============================================================================

export async function callStability(
  prompt: string,
  modelId: string = 'stable-diffusion-xl-1024-v1-0',
  apiKey?: string
): Promise<string> {
  const token = apiKey || process.env.STABILITY_API_KEY;
  if (!token) throw new Error('STABILITY_API_KEY not configured');

  const response = await fetch(
    `https://api.stability.ai/v1/generation/${modelId}/text-to-image`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        steps: 30,
        samples: 1,
      }),
    }
  );

  if (!response.ok) throw new Error(`Stability error: ${response.status}`);
  const data = await response.json();
  
  // Return base64 image
  if (data.artifacts && data.artifacts[0]) {
    return data.artifacts[0].base64;
  }
  
  throw new Error('No image generated');
}
