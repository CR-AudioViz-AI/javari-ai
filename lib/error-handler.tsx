// auto-stub
export const safeAsync = async (fn: any) => { try { return await fn() } catch(e) { return null } }
export const handleError = (e: any) => ({ error: String(e) })
export const safeHandler = (fn: any) => fn
export default {}
