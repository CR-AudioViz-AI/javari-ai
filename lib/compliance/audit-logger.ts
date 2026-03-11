// lib/compliance/audit-logger.ts — CR AudioViz AI | 2026-03-11
export async function logAuditEvent(event: Record<string, unknown>): Promise<void> {
  console.log('[audit]', JSON.stringify(event));
}
export const auditLogger = { log: logAuditEvent };
export default auditLogger;
