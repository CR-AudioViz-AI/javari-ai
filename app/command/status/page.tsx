/**
 * app/command/status/page.tsx
 * Command Center Status Page
 * Created: 2026-02-22 03:13 ET
 * 
 * Server component that mounts the real-time StatusDashboard
 */

import { StatusDashboard } from '@/components/command/status/StatusDashboard';

export const metadata = {
  title: 'System Status | Command Center',
  description: 'Real-time system status and health monitoring',
};

export default function StatusPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <StatusDashboard />
    </div>
  );
}
