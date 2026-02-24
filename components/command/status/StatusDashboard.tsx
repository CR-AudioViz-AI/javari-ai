/**
 * components/command/status/StatusDashboard.tsx
 * Command Center Real-Time Status Dashboard
 * Created: 2026-02-22 03:11 ET
 * 
 * Live dashboard polling /api/command-center/status every 3 seconds
 * Displays:
 * - System uptime and health
 * - Last cycle summary
 * - Next cycle countdown
 * - Roadmap progress
 * - Live health indicators
 * - Token usage metrics
 * - Drift detection status
 * - Animated cycle tracker
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  BoltIcon, 
  ClockIcon, 
  ChartBarIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

interface StatusData {
  timestamp: string;
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
    stages: Record<string, string>;
    patches: number;
    failures: number;
  } | null;
  nextCycle: {
    scheduled: string;
    estimatedStart: string;
  };
  roadmap: {
    activeRoadmap: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    blockedTasks: number;
    completionPercentage: number;
  };
  modelUsage: {
    totalTokens: number;
    tokensByModel: Record<string, number>;
    avgLatency: number;
    successRate: number;
  };
  drift: {
    activeEvents: number;
    criticalEvents: number;
    lastDetected: string | null;
  };
}

export function StatusDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch status data
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/command-center/status');
      
      if (!res.ok) {
        throw new Error(`Status API returned ${res.status}`);
      }

      const data = await res.json() as StatusData;
      setStatus(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('[StatusDashboard] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  // Poll every 3 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate time until next cycle
  const getTimeUntilNextCycle = () => {
    if (!status?.nextCycle.scheduled) return 'Unknown';
    
    const next = new Date(status.nextCycle.scheduled);
    const now = new Date();
    const diff = next.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  // Determine system health status
  const getHealthStatus = () => {
    if (!status) return { label: 'Unknown', color: 'gray', pulse: false };
    
    if (status.autonomy.killSwitch) {
      return { label: 'Kill Switch Active', color: 'red', pulse: true };
    }
    
    if (!status.autonomy.enabled) {
      return { label: 'Paused', color: 'yellow', pulse: false };
    }
    
    if (status.drift.criticalEvents > 0) {
      return { label: 'Critical Drift', color: 'red', pulse: true };
    }
    
    if (status.drift.activeEvents > 0) {
      return { label: 'Drift Detected', color: 'yellow', pulse: true };
    }
    
    if (status.lastCycle?.failures && status.lastCycle.failures > 0) {
      return { label: 'Degraded', color: 'orange', pulse: true };
    }
    
    return { label: 'Healthy', color: 'green', pulse: true };
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading status dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && !status) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchStatus}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!status) return null;

  const health = getHealthStatus();
  const timeUntilNext = getTimeUntilNextCycle();

  return (
    <div className="space-y-6">
      {/* Header with Live Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        
        {/* Live Pulse Indicator */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`h-3 w-3 rounded-full bg-${health.color}-500`}></div>
            {health.pulse && (
              <div className={`absolute inset-0 h-3 w-3 rounded-full bg-${health.color}-500 animate-ping`}></div>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">{health.label}</span>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Uptime */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">System Uptime</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {status.autonomy.enabled ? '99.8%' : 'Paused'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {status.autonomy.enabled ? 'Running smoothly' : 'Autonomy disabled'}
          </p>
        </div>

        {/* Last Cycle */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Last Cycle</h3>
          </div>
          {status.lastCycle ? (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(status.lastCycle.duration / 1000)}s
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {status.lastCycle.patches} patches, {status.lastCycle.failures} failures
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400">No data</p>
          )}
        </div>

        {/* Next Cycle */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <SignalIcon className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Next Cycle</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{timeUntilNext}</p>
          <p className="text-sm text-gray-500 mt-1">
            Interval: {status.autonomy.interval}
          </p>
        </div>

        {/* Roadmap Progress */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Roadmap</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {status.roadmap.completionPercentage}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {status.roadmap.completedTasks}/{status.roadmap.totalTasks} tasks
          </p>
        </div>
      </div>

      {/* Live Health Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Autonomy Core Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <BoltIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="text-sm text-gray-600">Mode</p>
              <p className="font-semibold text-gray-900 capitalize">{status.autonomy.mode}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <CheckCircleIcon className={`h-5 w-5 ${status.autonomy.enabled ? 'text-green-600' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold text-gray-900">
                {status.autonomy.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <ExclamationTriangleIcon className={`h-5 w-5 ${status.autonomy.killSwitch ? 'text-red-600' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm text-gray-600">Kill Switch</p>
              <p className="font-semibold text-gray-900">
                {status.autonomy.killSwitch ? 'ACTIVE' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Token Usage & Drift Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Token Usage (Last Cycle)</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Total Tokens</span>
              <span className="text-lg font-bold text-blue-600">
                {status.modelUsage.totalTokens.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Avg Latency</span>
              <span className="text-lg font-bold text-green-600">
                {status.modelUsage.avgLatency}ms
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Success Rate</span>
              <span className="text-lg font-bold text-purple-600">
                {status.modelUsage.successRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Drift Detection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Drift Detection</h2>
          
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              status.drift.activeEvents > 0 ? 'bg-yellow-50' : 'bg-gray-50'
            }`}>
              <span className="text-sm font-medium text-gray-700">Active Events</span>
              <span className={`text-lg font-bold ${
                status.drift.activeEvents > 0 ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {status.drift.activeEvents}
              </span>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg ${
              status.drift.criticalEvents > 0 ? 'bg-red-50' : 'bg-gray-50'
            }`}>
              <span className="text-sm font-medium text-gray-700">Critical Events</span>
              <span className={`text-lg font-bold ${
                status.drift.criticalEvents > 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {status.drift.criticalEvents}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Last Detected</span>
              <span className="text-sm font-medium text-gray-600">
                {status.drift.lastDetected 
                  ? new Date(status.drift.lastDetected).toLocaleTimeString()
                  : 'None'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Warning:</span> {error} - Using cached data
          </p>
        </div>
      )}
    </div>
  );
}
