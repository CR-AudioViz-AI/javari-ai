/**
 * components/command/control/ControlPanel.tsx
 * Command Center Control Panel
 * Created: 2026-02-22 03:18 ET
 * 
 * Interactive control panel for autonomy operations:
 * - Start/Pause autonomy
 * - Kill switch toggle
 * - Step execution
 * - Safety controls
 * - System state monitoring
 * - Action history log
 */

'use client';

import { useEffect, useState } from 'react';
import { ActionButton } from './ActionButton';
import {
  PlayIcon,
  PauseIcon,
  BoltIcon,
  ForwardIcon,
  ShieldCheckIcon,
  TrashIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface StatusData {
  autonomy: {
    enabled: boolean;
    killSwitch: boolean;
    mode: string;
    ring: number;
    interval: string;
  };
  lastCycle: {
    id: string;
    timestamp: string;
    duration: number;
    patches: number;
    failures: number;
  } | null;
  nextCycle: {
    scheduled: string;
    estimatedStart: string;
  };
  drift: {
    activeEvents: number;
    criticalEvents: number;
  };
}

interface ControlAction {
  id: string;
  timestamp: Date;
  action: string;
  status: 'success' | 'error';
  message: string;
}

export function ControlPanel() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<ControlAction[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/command-center/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json() as StatusData;
      setStatus(data);
    } catch (err) {
      console.error('[ControlPanel] Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll status every 3 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Execute control action
  const executeAction = async (action: string, confirmMessage?: string) => {
    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    setActionLoading(action);

    try {
      const res = await fetch('/api/command-center/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error(`Control action failed: ${res.status}`);
      }

      const result = await res.json();

      // Add to history
      const historyEntry: ControlAction = {
        id: Date.now().toString(),
        timestamp: new Date(),
        action,
        status: 'success',
        message: result.result?.message || 'Action completed',
      };
      setActionHistory(prev => [historyEntry, ...prev].slice(0, 6));

      // Show success toast
      setToast({ message: `${action} executed successfully`, type: 'success' });

      // Refresh status immediately
      fetchStatus();

    } catch (err) {
      console.error('[ControlPanel] Action error:', err);

      const historyEntry: ControlAction = {
        id: Date.now().toString(),
        timestamp: new Date(),
        action,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      setActionHistory(prev => [historyEntry, ...prev].slice(0, 6));

      setToast({
        message: `${action} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading control panel...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">Failed to load system status. Please refresh the page.</p>
      </div>
    );
  }

  const isKilled = status.autonomy.killSwitch;
  const isPaused = !status.autonomy.enabled;
  const isRunning = status.autonomy.enabled && !status.autonomy.killSwitch;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Control Panel</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage autonomy operations and system controls
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border-2 ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-900'
              : 'bg-red-50 border-red-500 text-red-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : (
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            )}
            <p className="font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Section A: Autonomy Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Autonomy Controls</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Button */}
          <ActionButton
            variant="success"
            fullWidth
            icon={<PlayIcon className="h-5 w-5" />}
            onClick={() => executeAction('resume_autonomy')}
            disabled={isRunning || isKilled}
            loading={actionLoading === 'resume_autonomy'}
            aria-label="Start autonomy"
          >
            Start
          </ActionButton>

          {/* Pause Button */}
          <ActionButton
            variant="warning"
            fullWidth
            icon={<PauseIcon className="h-5 w-5" />}
            onClick={() => executeAction('pause_autonomy', 'Are you sure you want to pause autonomy?')}
            disabled={isPaused || isKilled}
            loading={actionLoading === 'pause_autonomy'}
            aria-label="Pause autonomy"
          >
            Pause
          </ActionButton>

          {/* Kill Switch Toggle */}
          <ActionButton
            variant="danger"
            fullWidth
            icon={<BoltIcon className="h-5 w-5" />}
            onClick={() =>
              executeAction(
                isKilled ? 'kill_switch_off' : 'kill_switch_on',
                isKilled
                  ? 'Disable kill switch and resume operations?'
                  : '⚠️ EMERGENCY STOP - This will immediately halt all autonomous operations. Continue?'
              )
            }
            loading={actionLoading === 'kill_switch_on' || actionLoading === 'kill_switch_off'}
            aria-label={isKilled ? 'Disable kill switch' : 'Enable kill switch'}
          >
            {isKilled ? 'Resume' : 'Kill Switch'}
          </ActionButton>

          {/* Step Run */}
          <ActionButton
            variant="info"
            fullWidth
            icon={<ForwardIcon className="h-5 w-5" />}
            onClick={() => executeAction('step', 'Run a single autonomy cycle?')}
            disabled={isKilled}
            loading={actionLoading === 'step'}
            aria-label="Run single cycle"
          >
            Step Run
          </ActionButton>
        </div>
      </div>

      {/* Section B: Safety Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Safety & Maintenance</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Clear Drift Events */}
          <ActionButton
            variant="warning"
            fullWidth
            icon={<TrashIcon className="h-5 w-5" />}
            onClick={() => executeAction('clear_drift', 'Clear all drift events?')}
            disabled={status.drift.activeEvents === 0}
            loading={actionLoading === 'clear_drift'}
            aria-label="Clear drift events"
          >
            Clear Drift ({status.drift.activeEvents})
          </ActionButton>

          {/* Create Roadmap Snapshot */}
          <ActionButton
            variant="info"
            fullWidth
            icon={<CameraIcon className="h-5 w-5" />}
            onClick={() => executeAction('snapshot_roadmap')}
            loading={actionLoading === 'snapshot_roadmap'}
            aria-label="Create roadmap snapshot"
          >
            Create Snapshot
          </ActionButton>

          {/* Enhanced Safety Toggle */}
          <ActionButton
            variant="primary"
            fullWidth
            icon={<ShieldCheckIcon className="h-5 w-5" />}
            onClick={() => executeAction('toggle_safety')}
            loading={actionLoading === 'toggle_safety'}
            aria-label="Toggle enhanced safety"
          >
            Enhanced Safety
          </ActionButton>
        </div>
      </div>

      {/* Section C: System State Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">System State</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Mode */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Mode</p>
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {status.autonomy.mode}
            </p>
          </div>

          {/* Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <p className={`text-lg font-semibold ${
              isKilled ? 'text-red-600' : isPaused ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {isKilled ? 'Killed' : isPaused ? 'Paused' : 'Running'}
            </p>
          </div>

          {/* Kill Switch */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Kill Switch</p>
            <p className={`text-lg font-semibold ${
              status.autonomy.killSwitch ? 'text-red-600' : 'text-gray-400'
            }`}>
              {status.autonomy.killSwitch ? 'ACTIVE' : 'Inactive'}
            </p>
          </div>

          {/* Next Cycle */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Next Cycle</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.autonomy.interval}
            </p>
          </div>

          {/* Last Cycle Duration */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Last Cycle</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.lastCycle ? `${Math.round(status.lastCycle.duration / 1000)}s` : 'N/A'}
            </p>
          </div>

          {/* Error Count */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Errors</p>
            <p className={`text-lg font-semibold ${
              (status.lastCycle?.failures || 0) > 0 ? 'text-red-600' : 'text-gray-400'
            }`}>
              {status.lastCycle?.failures || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Section D: Action History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Actions</h2>

        {actionHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No actions executed yet</p>
        ) : (
          <div className="space-y-2">
            {actionHistory.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  entry.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {entry.status === 'success' ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{entry.action}</p>
                    <p className="text-sm text-gray-600">{entry.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ClockIcon className="h-4 w-4" />
                  <span>{entry.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning Banner */}
      {isKilled && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Kill Switch Active</p>
              <p className="text-sm text-red-700">
                All autonomous operations are halted. Click "Resume" to disable the kill switch and restart.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
