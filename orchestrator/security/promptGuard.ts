import {
  ThreatAction,
  ThreatCategory,
  ThreatSeverity,
  ThreatDetection,
  SecurityScanResult,
  PromptValidationResult
} from './types';
import threatSignatures from './threatSignatures.json';
function compileRegex(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}
function scanPrompt(prompt: string): ThreatDetection[] {
  const detections: ThreatDetection[] = [];
  const now = new Date();
  const jailbreaks = threatSignatures.signatures.jailbreaks;
  for (const sig of jailbreaks) {
    if (!sig.enabled) continue;
    const regex = compileRegex(sig.pattern);
    if (regex.test(prompt)) {
      detections.push({
        signatureId: sig.id,
        category: sig.category as ThreatCategory,
        severity: sig.severity as ThreatSeverity,
        action: sig.action as ThreatAction,
        matchedContent: prompt.slice(0, 200),
        confidence: 0.95,
        detectedAt: now
      });
    }
  }
  return detections;
}
export function validatePrompt(prompt: string): PromptValidationResult {
  const start = Date.now();
  const detections = scanPrompt(prompt);
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
      contentType: 'prompt',
      contentLength: prompt.length
    }
  };
  return {
    isSafe: !blocked,
    scanResult,
    sanitizedPrompt: blocked ? undefined : prompt
  };
}
export function validateModelOutput(output: string): PromptValidationResult {
  // Output is scanned with the same logic as input prompts
  return validatePrompt(output);
}
