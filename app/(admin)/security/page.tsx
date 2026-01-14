'use client';
import { useEffect, useState } from 'react';
import SecurityCard from './components/securityCard';
type SecuritySummary = {
  totalIncidents: number;
  criticalIncidents: number;
  lastScan: string;
};
export default function SecurityPage() {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  useEffect(() => {
    fetch('/api/security/summary')
      .then(res => res.json())
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);
  if (!summary) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading security dashboard…
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Security Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SecurityCard
          title="Total Incidents"
          value={summary.totalIncidents}
        />
        <SecurityCard
          title="Critical Incidents"
          value={summary.criticalIncidents}
          severity="critical"
        />
        <SecurityCard
          title="Last Scan"
          value={summary.lastScan}
        />
      </div>
    </div>
  );
}
