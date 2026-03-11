// Auto-generated Redis/rate-limit stub
export const redis = {
  get: async (_key: string) => null,
  set: async (_key: string, _value: unknown) => null,
  setex: async (_key: string, _ttl: number, _value: unknown) => null,
  del: async (_key: string) => null,
  hget: async (_key: string, _field: string) => null,
  hset: async (_key: string, _field: string, _value: unknown) => null,
}
export const rateLimit = { limit: async (_key: string) => ({ success: true }) }
export const ratelimit = rateLimit
export default redis
