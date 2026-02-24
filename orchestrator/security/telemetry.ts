import crypto from 'crypto';
import { ThreatAction, ThreatCategory, ThreatSeverity } from './types';

type TelemetryMetric =
  | 'security.scan.count'
  | 'security.scan.latency_ms'
  | 'security.threat.count'
  | 'security.incident.count'
  | 'security.asset.signed_url.validation';

type TelemetryEventName =
  | 'SecurityScanCompleted'
  | 'SecurityIncidentLogged';

type Labels = Record<string, string>;

type TelemetryEvent = {
  name: TelemetryEventName;
  timestamp: string; // ISO 8601
  data: Record<string, unknown>;
};

type TelemetryMetricPoint = {
  metric: TelemetryMetric;
  timestamp: string; // ISO 8601
  value: number;
  labels?: Labels;
};

function nowIso(): string {
  return new Date().toISOString();
}

function enabled(): boolean {
  const v = (process.env.SECURITY_TELEMETRY_ENABLED ?? 'true').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function sampleRateForSeverity(severity: ThreatSeverity): number {
  // Events are 100% for high/critical; 10% otherwise
  if (severity === ThreatSeverity.HIGH || severity === ThreatSeverity.CRITICAL) return 1.0;
  return 0.1;
}

function shouldSample(p: number): boolean {
  if (p >= 1) return true;
  if (p <= 0) return false;
  return Math.random() < p;
}

export function hashIdentifier(value: string): string {
  // Stable one-way hash for IDs like userId or ipAddress (never emit raw)
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEmit(obj: unknown): void {
  if (!enabled()) return;
  // Emit as single-line JSON for easy ingestion (stdout)
  // Never include payloads or secrets here; callers must pass redacted data only.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj));
}

export function emitMetric(point: TelemetryMetricPoint): void {
  safeEmit({ kind: 'metric', ...point });
}

export function emitEvent(evt: TelemetryEvent): void {
  safeEmit({ kind: 'event', ...evt });
}

export function recordScanCompleted(args: {
  scanId: string;
  type: 'request' | 'prompt' | 'secrets';
  maxSeverity: ThreatSeverity;
  recommendedAction: ThreatAction;
  durationMs: number;
  result: 'allow' | 'block';
}): void {
  emitMetric({
    metric: 'security.scan.count',
    timestamp: nowIso(),
    value: 1,
    labels: {
      type: args.type,
      result: args.result
    }
  });

  emitMetric({
    metric: 'security.scan.latency_ms',
    timestamp: nowIso(),
    value: args.durationMs,
    labels: {
      type: args.type
    }
  });

  const p = sampleRateForSeverity(args.maxSeverity);
  if (shouldSample(p)) {
    emitEvent({
      name: 'SecurityScanCompleted',
      timestamp: nowIso(),
      data: {
        scanId: args.scanId,
        type: args.type,
        maxSeverity: args.maxSeverity,
        recommendedAction: args.recommendedAction,
        durationMs: args.durationMs
      }
    });
  }
}

export function recordThreatDetected(args: {
  category: ThreatCategory;
  severity: ThreatSeverity;
}): void {
  emitMetric({
    metric: 'security.threat.count',
    timestamp: nowIso(),
    value: 1,
    labels: {
      category: args.category,
      severity: args.severity
    }
  });
}

export function recordIncidentLogged(args: {
  incidentId: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  actionTaken: ThreatAction;
  userId?: string;
  ipAddress?: string;
}): void {
  emitMetric({
    metric: 'security.incident.count',
    timestamp: nowIso(),
    value: 1,
    labels: {
      category: args.category,
      action: args.actionTaken
    }
  });

  const p = sampleRateForSeverity(args.severity);
  if (shouldSample(p)) {
    emitEvent({
      name: 'SecurityIncidentLogged',
      timestamp: nowIso(),
      data: {
        incidentId: args.incidentId,
        category: args.category,
        severity: args.severity,
        actionTaken: args.actionTaken,
        userIdHash: args.userId ? hashIdentifier(args.userId) : undefined,
        ipHash: args.ipAddress ? hashIdentifier(args.ipAddress) : undefined
      }
    });
  }
}

export function recordAssetSignedUrlValidation(args: {
  result: 'valid' | 'invalid' | 'expired' | 'tampered';
}): void {
  emitMetric({
    metric: 'security.asset.signed_url.validation',
    timestamp: nowIso(),
    value: 1,
    labels: {
      result: args.result
    }
  });
}
