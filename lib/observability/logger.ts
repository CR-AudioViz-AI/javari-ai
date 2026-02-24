// lib/observability/logger.ts
// CR AudioViz AI — Structured Logger
// 2026-02-20 — STEP 7 Production Hardening
//
// JSON-structured logging for all Javari subsystems.
// Writes to console (captured by Vercel) and optionally to Supabase.

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogSubsystem =
  | "autonomy"
  | "factory"
  | "routing"
  | "billing"
  | "auth"
  | "health"
  | "canary"
  | "rate_limit"
  | "analytics"
  | "security"
  | "api";

export interface LogEntry {
  level:      LogLevel;
  subsystem:  LogSubsystem;
  message:    string;
  traceId?:   string;
  userId?:    string;
  goalId?:    string;
  meta?:      Record<string, unknown>;
  durationMs?: number;
  timestamp:  string;
}

// ── In-memory ring buffer (100 entries) for /api/beta/checklist ─────────────

const LOG_BUFFER: LogEntry[] = [];
const BUFFER_SIZE = 100;

function pushBuffer(entry: LogEntry): void {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > BUFFER_SIZE) LOG_BUFFER.shift();
}

export function getRecentLogs(n = 20): LogEntry[] {
  return LOG_BUFFER.slice(-n);
}

// ── Core log function ────────────────────────────────────────────────────────

function log(
  level:     LogLevel,
  subsystem: LogSubsystem,
  message:   string,
  meta?:     Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">
): void {
  const entry: LogEntry = {
    level,
    subsystem,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  pushBuffer(entry);

  // JSON to stdout (Vercel captures this)
  const prefix = `[${level.toUpperCase()}][${subsystem}]`;
  const json   = JSON.stringify(entry);
  switch (level) {
    case "debug": console.debug(prefix, json); break;
    case "info":  console.info (prefix, json); break;
    case "warn":  console.warn (prefix, json); break;
    case "error":
    case "fatal": console.error(prefix, json); break;
  }
}

// ── Logger factory ───────────────────────────────────────────────────────────

export function createLogger(subsystem: LogSubsystem) {
  return {
    debug: (msg: string, meta?: Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">) =>
      log("debug", subsystem, msg, meta),
    info:  (msg: string, meta?: Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">) =>
      log("info",  subsystem, msg, meta),
    warn:  (msg: string, meta?: Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">) =>
      log("warn",  subsystem, msg, meta),
    error: (msg: string, meta?: Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">) =>
      log("error", subsystem, msg, meta),
    fatal: (msg: string, meta?: Omit<LogEntry, "level" | "subsystem" | "message" | "timestamp">) =>
      log("fatal", subsystem, msg, meta),
  };
}

// ── Pre-built loggers ────────────────────────────────────────────────────────

export const autonomyLog  = createLogger("autonomy");
export const factoryLog   = createLogger("factory");
export const routingLog   = createLogger("routing");
export const billingLog   = createLogger("billing");
export const authLog      = createLogger("auth");
export const healthLog    = createLogger("health");
export const canaryLog    = createLogger("canary");
export const rateLimitLog = createLogger("rate_limit");
export const analyticsLog = createLogger("analytics");
export const apiLog       = createLogger("api");
