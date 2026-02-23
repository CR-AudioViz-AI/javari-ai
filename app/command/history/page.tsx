/**
 * app/command/history/page.tsx
 * Command Center History Page
 * Created: 2026-02-22 03:26 ET
 * 
 * Server component that mounts the HistoryViewer
 */

import { HistoryViewer } from '@/components/command/history/HistoryViewer';

export const metadata = {
  title: 'Event History | Command Center',
  description: 'Unified timeline of all autonomy events',
};

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <HistoryViewer />
    </div>
  );
}
