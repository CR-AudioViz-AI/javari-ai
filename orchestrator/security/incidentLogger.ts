import fs from 'fs';
import path from 'path';
import {
  SecurityIncident,
  ThreatAction,
  ThreatCategory,
  ThreatSeverity
} from './types';
const LOG_DIR = path.resolve(process.cwd(), 'security-logs');
const LOG_FILE = path.join(LOG_DIR, 'incidents.jsonl');
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
export function logIncident(
  incident: Omit<SecurityIncident, 'id' | 'timestamp'>
): void {
  ensureLogDir();
  const record: SecurityIncident = {
    ...incident,
    id: crypto.randomUUID(),
    timestamp: new Date()
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
}
export function getIncidents(): SecurityIncident[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
  return lines.map(line => JSON.parse(line));
}
export function exportIncidents(format: 'json' | 'csv'): string {
  const incidents = getIncidents();
  if (format === 'csv') {
    const header = Object.keys(incidents[0] || {}).join(',');
    const rows = incidents.map(i =>
      Object.values(i)
        .map(v => JSON.stringify(v))
        .join(',')
    );
    return [header, ...rows].join('\n');
  }
  return JSON.stringify(incidents, null, 2);
}
