// lib/javari/revenue/credits.ts
// Credits system for javari-ai — delegates to craudiovizai central services
// Updated: May 14, 2026

const CENTRAL_URL = process.env.CRAUDIOVIZAI_URL ?? 'https://craudiovizai.com'

export async function checkBalance(userId: string): Promise<{ balance: number; tier: string }> {
  try {
    const res = await fetch(`${CENTRAL_URL}/api/credits/balance`, {
      headers: { 'x-user-id': userId }
    })
    if (!res.ok) return { balance: 0, tier: 'free' }
    const d = await res.json()
    return { balance: d.balance ?? 0, tier: d.tier ?? 'free' }
  } catch { return { balance: 0, tier: 'free' } }
}

export async function deductCredits(userId: string, amount: number, action: string): Promise<boolean> {
  try {
    const res = await fetch(`${CENTRAL_URL}/api/credits/spend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ amount, action, appId: 'javari-ai' })
    })
    return res.ok
  } catch { return false }
}

export async function grantCredits(userId: string, amount: number, reason: string): Promise<boolean> {
  try {
    const res = await fetch(`${CENTRAL_URL}/api/credits/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ amount, reason, appId: 'javari-ai' })
    })
    return res.ok
  } catch { return false }
}

export class CostEstimate {
  model: string; provider: string; estimatedCost: number
  constructor({ model = 'llama-3.3-70b-versatile', provider = 'groq', estimatedCost = 0 } = {}) {
    this.model = model; this.provider = provider; this.estimatedCost = estimatedCost
  }
  isFree() { return this.estimatedCost === 0 }
}

export class CreditBalance {
  balance: number; tier: string
  constructor({ balance = 0, tier = 'free' } = {}) { this.balance = balance; this.tier = tier }
}

export class DeductResult {
  success: boolean; newBalance: number
  constructor({ success = false, newBalance = 0 } = {}) { this.success = success; this.newBalance = newBalance }
}
