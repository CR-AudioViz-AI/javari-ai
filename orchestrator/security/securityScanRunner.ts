import {
  SecurityScanResult,
  ThreatSeverity,
  ThreatAction,
  ThreatCategory,
  ThreatDetection
} from './types';
import { validateRequest } from './requestGuard';
import { validatePrompt } from './promptGuard';
import { validateSecrets } from './secretValidator';
import { logIncident } from './incidentLogger';
import { recordScanCompleted, recordThreatDetected } from './telemetry';

export type ScanTarget =
  | { type: 'request'; payload: Parameters<typeof validateRequest>[0] }
  | { type: 'prompt'; payload: string }
  | { type: 'secrets' };

function maxSeverity(detections: ThreatDetection[]): ThreatSeverity {
  const order: ThreatSeverity[] = [
    ThreatSeverity.INFO,
    ThreatSeverity.LOW,
    ThreatSeverity.MEDIUM,
    ThreatSeverity.HIGH,
    ThreatSeverity.CRITICAL
  ];

  let max = ThreatSeverity.INFO;
  for (const d of detections) {
    if (order.indexOf(d.severity) > order.indexOf(max)) {
      max = d.severity;
    }
  }
  return max;
}

export function runSecurityScan(target: ScanTarget): SecurityScanResult {
  const start = Date.now();

  if (target.type === 'request') {
    const result = validateRequest(target.payload);
    const ms = Date.now() - start;

    for (const d of result.scanResult.detections) {
      recordThreatDetected({ category: d.category, severity: d.severity });
    }

    recordScanCompleted({
      scanId: result.scanResult.scanId,
      type: 'request',
      maxSeverity: result.scanResult.maxSeverity,
      recommendedAction: result.scanResult.recommendedAction,
      durationMs: ms,
      result: result.allowed ? 'allow' : 'block'
    });

    if (!result.allowed) {
      logIncident({
        severity: ThreatSeverity.HIGH,
        category: ThreatCategory.INJECTION,
        threats: result.scanResult.detections,
        actionTaken: result.actionTaken,
        description: 'Request blocked by security scan',
        resolved: false
      });
    }

    return result.scanResult;
  }

  if (target.type === 'prompt') {
    const result = validatePrompt(target.payload);
    const ms = Date.now() - start;

    for (const d of result.scanResult.detections) {
      recordThreatDetected({ category: d.category, severity: d.severity });
    }

    recordScanCompleted({
      scanId: result.scanResult.scanId,
      type: 'prompt',
      maxSeverity: result.scanResult.maxSeverity,
      recommendedAction: result.scanResult.recommendedAction,
      durationMs: ms,
      result: result.isSafe ? 'allow' : 'block'
    });

    if (!result.isSafe) {
      logIncident({
        severity: ThreatSeverity.HIGH,
        category: ThreatCategory.PROMPT_INJECTION,
        threats: result.scanResult.detections,
        actionTaken: result.scanResult.recommendedAction,
        description: 'Prompt blocked by security scan',
        resolved: false
      });
    }

    return result.scanResult;
  }

  const secrets = validateSecrets();

  const scanResult: SecurityScanResult = {
    scanId: crypto.randomUUID(),
    timestamp: new Date(),
    threatDetected: !secrets.valid,
    maxSeverity: secrets.valid ? ThreatSeverity.INFO : ThreatSeverity.CRITICAL,
    recommendedAction: secrets.valid ? ThreatAction.LOG : ThreatAction.ALERT,
    detections: [],
    metadata: {
      scanDuration: Date.now() - start,
      signaturesChecked: 0,
      contentType: 'secrets',
      contentLength: 0
    }
  };

  recordScanCompleted({
    scanId: scanResult.scanId,
    type: 'secrets',
    maxSeverity: scanResult.maxSeverity,
    recommendedAction: scanResult.recommendedAction,
    durationMs: scanResult.metadata.scanDuration,
    result: secrets.valid ? 'allow' : 'block'
  });

  if (!secrets.valid) {
    logIncident({
      severity: ThreatSeverity.CRITICAL,
      category: ThreatCategory.DATA_EXFILTRATION,
      threats: [],
      actionTaken: ThreatAction.ALERT,
      description: `Missing required secrets: ${secrets.missing.join(', ')}`,
      resolved: false
    });
  }

  return scanResult;
}
