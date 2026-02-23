/**
 * app/command/control/page.tsx
 * Command Center Control Page
 * Created: 2026-02-22 03:20 ET
 * 
 * Server component that mounts the ControlPanel
 */

import { ControlPanel } from '@/components/command/control/ControlPanel';

export const metadata = {
  title: 'Control Panel | Command Center',
  description: 'Manage autonomy operations and system controls',
};

export const dynamic = 'force-dynamic';

export default function ControlPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <ControlPanel />
    </div>
  );
}
