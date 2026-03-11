// lib/middleware/rate-limit.ts — CR AudioViz AI | 2026-03-11
export function rateLimit(config?: { limit?: number; window?: number }) {
  return {
    check: async (_req: unknown): Promise<{ success: boolean; remaining: number }> => ({
      success: true,
      remaining: config?.limit ?? 100
    })
  };
}
export default rateLimit;
