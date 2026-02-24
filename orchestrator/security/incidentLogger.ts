import fs from 'fs';
import path from 'path';
import { SecurityIncident } from './types';
import { recordIncidentLogged } from './telemetry';

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

  recordIncidentLogged({
    incidentId: record.id,
    category: record.category,
    severity: record.severity as any,
    actionTaken: record.actionTaken,
    userId: record.userId,
    ipAddress: record.ipAddress
  });
}

export function getIncidents(): SecurityIncident[] {
  if (!fs.existsSync(LOG_FILE)) return [];

  const raw = fs.readFileSync(LOG_FILE, 'utf8').trim();
  if (!raw) return [];

  const lines = raw.split('\n');
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
