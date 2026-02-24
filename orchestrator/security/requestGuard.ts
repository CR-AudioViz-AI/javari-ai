import {
  ThreatAction,
  ThreatCategory,
  ThreatSeverity,
  SecurityScanResult,
  ThreatDetection,
  RequestData,
  RequestValidationResult
} from './types';
import threatSignatures from './threatSignatures.json';

const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_STRING_LENGTH = 100_000;

const ALLOWED_MIME_TYPES = [
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint'
];

function compileRegex(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}

function scanContent(content: string): ThreatDetection[] {
  const detections: ThreatDetection[] = [];
  const now = new Date();

  for (const bucket of Object.values(threatSignatures.signatures)) {
    for (const sig of bucket) {
      if (!sig.enabled) continue;
      const regex = compileRegex(sig.pattern);
      if (regex.test(content)) {
        detections.push({
          signatureId: sig.id,
          category: sig.category as ThreatCategory,
          severity: sig.severity as ThreatSeverity,
          action: sig.action as ThreatAction,
          matchedContent: content.slice(0, 200),
          confidence: 0.9,
          detectedAt: now
        });
      }
    }
  }

  return detections;
}

export function sanitizeString(input: string): string {
  if (input.length > MAX_STRING_LENGTH) {
    return input.slice(0, MAX_STRING_LENGTH);
  }
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizeObject(v);
    }
    return result;
  }
  return obj;
}

export function validateFileUpload(
  filename: string,
  mimeType: string,
  size: number
): RequestValidationResult {
  const detections: ThreatDetection[] = [];
  let action: ThreatAction = ThreatAction.LOG;

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    action = ThreatAction.BLOCK;
  }

  if (size > MAX_PAYLOAD_BYTES) {
    action = ThreatAction.BLOCK;
  }

  if (/\.\./.test(filename)) {
    action = ThreatAction.BLOCK;
  }

  const scanResult: SecurityScanResult = {
    scanId: crypto.randomUUID(),
    timestamp: new Date(),
    threatDetected: action === ThreatAction.BLOCK,
    maxSeverity: ThreatSeverity.HIGH,
    recommendedAction: action,
    detections,
    metadata: {
      scanDuration: 0,
      signaturesChecked: 0,
      contentType: mimeType,
      contentLength: size
    }
  };

  return {
    allowed: action !== ThreatAction.BLOCK,
    scanResult,
    actionTaken: action
  };
}

export function validateRequest(request: RequestData): RequestValidationResult {
  const start = Date.now();
  const bodyString =
    typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body ?? '');

  const detections = scanContent(bodyString);
  const blocked = detections.some(d => d.action === ThreatAction.BLOCK);

  const scanResult: SecurityScanResult = {
    scanId: crypto.randomUUID(),
    timestamp: new Date(),
    threatDetected: detections.length > 0,
    maxSeverity: detections.reduce(
      (max, d) => (d.severity > max ? d.severity : max),
      ThreatSeverity.INFO
    ),
    recommendedAction: blocked ? ThreatAction.BLOCK : ThreatAction.LOG,
    detections,
    metadata: {
      scanDuration: Date.now() - start,
      signaturesChecked: detections.length,
      contentType: 'request',
      contentLength: bodyString.length
    }
  };

  return {
    allowed: !blocked,
    scanResult,
    actionTaken: scanResult.recommendedAction
  };
}
