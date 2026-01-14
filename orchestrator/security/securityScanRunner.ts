import {
  SecurityScanResult,
  ThreatSeverity,
  ThreatAction
} from './types';
import { validateRequest } from './requestGuard';
import { validatePrompt } from './promptGuard';
import { validateSecrets } from './secretValidator';
import { logIncident } from './incidentLogger';
export type ScanTarget =
  | { type: 'request'; payload: Parameters<typeof validateRequest>[0] }
  | { type: 'prompt'; payload: string }
  | { type: 'secrets' };
export function runSecurityScan(target: ScanTarget): SecurityScanResult {
  if (target.type === 'request') {
    const result = validateRequest(target.payload);
    if (!result.allowed) {
      logIncident({
        severity: ThreatSeverity.HIGH,
        category: 'injection' as any,
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
    if (!result.isSafe) {
      logIncident({
        severity: ThreatSeverity.HIGH,
        category: 'prompt_injection' as any,
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
      scanDuration: 0,
      signaturesChecked: 0,
      contentType: 'secrets',
      contentLength: 0
    }
  };
  if (!secrets.valid) {
    logIncident({
      severity: ThreatSeverity.CRITICAL,
      category: 'data_exfiltration' as any,
      threats: [],
      actionTaken: ThreatAction.ALERT,
      description: `Missing required secrets: ${secrets.missing.join(', ')}`,
      resolved: false
    });
  }
  return scanResult;
}
