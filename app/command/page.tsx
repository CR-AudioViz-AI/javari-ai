/**
 * app/command/page.tsx
 * Command Center Home Page
 * Created: 2026-02-22 03:02 ET
 * 
 * Main dashboard entry point with system status overview
 */

import { ClockIcon, CpuChipIcon, ServerIcon } from '@heroicons/react/24/outline';

export default function CommandCenterPage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Command Center
        </h1>
        <p className="text-gray-600">
          Autonomous operations monitoring and control for Javari OS
        </p>
      </div>

      {/* Welcome Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-blue-900 mb-2">
          Command Center Initialized
        </h2>
        <p className="text-blue-700">
          Select a section from the sidebar to monitor and control Javari&apos;s autonomous operations.
        </p>
      </div>

      {/* Quick Stats Grid (Placeholder) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* System Uptime */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">System Uptime</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">99.8%</p>
          <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
        </div>

        {/* Active Processes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Active Cycles</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">Running</p>
          <p className="text-sm text-gray-500 mt-1">Every 15 minutes</p>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ServerIcon className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">System Health</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">Healthy</p>
          <p className="text-sm text-gray-500 mt-1">All systems operational</p>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/command/status"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">Status</h3>
          <p className="text-sm text-gray-600">
            View real-time system status and metrics
          </p>
        </a>

        <a
          href="/command/history"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">History</h3>
          <p className="text-sm text-gray-600">
            Browse timeline of all autonomy events
          </p>
        </a>

        <a
          href="/command/control"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">Control</h3>
          <p className="text-sm text-gray-600">
            Start, pause, or stop autonomous cycles
          </p>
        </a>

        <a
          href="/command/telemetry"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-1">Telemetry</h3>
          <p className="text-sm text-gray-600">
            Track model usage and cost metrics
          </p>
        </a>
      </div>

      {/* Info Banner */}
      <div className="mt-8 bg-gray-100 border border-gray-300 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Note:</span> This is Phase 1 of the Command Center UI.
          Functional dashboards will be added in Phase 2.
        </p>
      </div>
    </div>
  );
}
