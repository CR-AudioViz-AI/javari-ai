import {
import { validateRequest } from './requestGuard';
import { validatePrompt } from './promptGuard';
import { validateSecrets } from './secretValidator';
import { logIncident } from './incidentLogger';
import { recordScanCompleted, recordThreatDetected } from './telemetry';
export type ScanTarget =
export default {}
