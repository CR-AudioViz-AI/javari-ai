// =============================================================================
// JAVARI AI - HEALTH STATUS BADGE COMPONENT
// =============================================================================
// Displays real-time system health with auto-refresh
// Created: Saturday, December 13, 2025 - 6:20 PM EST
// =============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  checks?: Record<string, {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    latency_ms: number;
  }>;
}

interface HealthStatusBadgeProps {
  refreshInterval?: number; // seconds, default 30
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

// -----------------------------------------------------------------------------
// Status Colors & Icons
// -----------------------------------------------------------------------------

const STATUS_CONFIG = {
  healthy: {
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgLight: 'bg-green-50',
    border: 'border-green-200',
    icon: '✓',
    label: 'All Systems Operational'
  },
  degraded: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: '⚠',
    label: 'Partial Outage'
  },
  unhealthy: {
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgLight: 'bg-red-50',
    border: 'border-red-200',
    icon: '✕',
    label: 'System Issues'
  },
  loading: {
    color: 'bg-gray-400',
    textColor: 'text-gray-600',
    bgLight: 'bg-gray-50',
    border: 'border-gray-200',
    icon: '○',
    label: 'Checking...'
  },
  error: {
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgLight: 'bg-gray-50',
    border: 'border-gray-200',
    icon: '?',
    label: 'Unable to Check'
  }
} as const;

// -----------------------------------------------------------------------------
// Helper: Format Uptime
// -----------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function HealthStatusBadge({
  refreshInterval = 30,
  showDetails = false,
  compact = false,
  className = ''
}: HealthStatusBadgeProps) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await response.json();
      setHealth(data);
      setError(null);
      setLastChecked(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchHealth, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchHealth, refreshInterval]);

  // Determine current status
  const currentStatus = loading 
    ? 'loading' 
    : error 
      ? 'error' 
      : health?.status || 'error';
  
  const config = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];

  // Compact badge (just the dot and status)
  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 ${className}`}
        title={config.label}
      >
        <span className={`w-2 h-2 rounded-full ${config.color} ${loading ? 'animate-pulse' : ''}`} />
        <span className={`text-xs ${config.textColor} font-medium`}>
          {currentStatus === 'healthy' ? 'OK' : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Main Badge */}
      <button
        onClick={() => showDetails && setExpanded(!expanded)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
          ${config.bgLight} ${config.border}
          ${showDetails ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
        `}
      >
        {/* Status Indicator */}
        <span className={`
          w-3 h-3 rounded-full ${config.color}
          ${loading ? 'animate-pulse' : ''}
        `} />
        
        {/* Status Text */}
        <span className={`font-medium ${config.textColor}`}>
          {config.icon} {config.label}
        </span>
        
        {/* Uptime (if available) */}
        {health?.uptime && (
          <span className="text-xs text-gray-500 ml-2">
            Up {formatUptime(health.uptime)}
          </span>
        )}
        
        {/* Expand Icon */}
        {showDetails && (
          <span className={`ml-auto text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        )}
      </button>

      {/* Expanded Details */}
      {showDetails && expanded && health && (
        <div className={`mt-2 p-4 rounded-lg border ${config.bgLight} ${config.border}`}>
          {/* Summary */}
          <div className="flex gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>{health.summary.passed} Passed</span>
            </div>
            {health.summary.warnings > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>{health.summary.warnings} Warnings</span>
              </div>
            )}
            {health.summary.failed > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>{health.summary.failed} Failed</span>
              </div>
            )}
          </div>

          {/* Individual Checks */}
          {health.checks && (
            <div className="space-y-2">
              {Object.entries(health.checks).map(([key, check]) => (
                <div 
                  key={key}
                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      check.status === 'pass' ? 'bg-green-500' :
                      check.status === 'warn' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="font-medium text-gray-700">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{check.message}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {check.latency_ms}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last Checked */}
          {lastChecked && (
            <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
              <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); fetchHealth(); }}
                className="text-blue-500 hover:text-blue-700"
              >
                Refresh Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && showDetails && expanded && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button 
            onClick={fetchHealth}
            className="ml-2 text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Export Default
// -----------------------------------------------------------------------------

export default HealthStatusBadge;
