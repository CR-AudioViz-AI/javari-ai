// lib/javari/memory/semantic-store.ts
// Semantic memory store for Javari — conversation context persistence
// Updated: May 14, 2026

interface MemoryEntry {
  id:        string
  userId:    string
  content:   string
  embedding?: number[]
  createdAt: string
  tags:      string[]
}

// In-memory store for current session (persists for serverless function lifetime)
const sessionStore = new Map<string, MemoryEntry[]>()

export async function storeMemory(userId: string, content: string, tags: string[] = []): Promise<string> {
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const entry: MemoryEntry = { id, userId, content, createdAt: new Date().toISOString(), tags }
  const existing = sessionStore.get(userId) ?? []
  // Keep last 50 memories per user in session
  const updated = [...existing.slice(-49), entry]
  sessionStore.set(userId, updated)
  return id
}

export async function retrieveMemory(userId: string, query: string, limit = 5): Promise<MemoryEntry[]> {
  const memories = sessionStore.get(userId) ?? []
  if (!query) return memories.slice(-limit)
  // Simple keyword search (no embeddings needed for free tier)
  const queryLower = query.toLowerCase()
  const scored = memories.map(m => ({
    entry: m,
    score: m.content.toLowerCase().split(' ').filter(w => queryLower.includes(w)).length
  }))
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry)
}

export async function clearMemory(userId: string): Promise<void> {
  sessionStore.delete(userId)
}

export async function getMemoryCount(userId: string): Promise<number> {
  return (sessionStore.get(userId) ?? []).length
}

// Alias exports for backward compatibility
export const searchSimilar = retrieveMemory
export async function searchMemory(userId: string, query: string, limit = 5) {
  return retrieveMemory(userId, query, limit)
}
