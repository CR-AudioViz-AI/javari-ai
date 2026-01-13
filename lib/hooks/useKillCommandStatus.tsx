/**
 * JAVARI AI - KILL COMMAND UI HOOK
 * React hook for checking and displaying kill command status
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:31 PM EST
 */

'use client';

import { useState, useEffect } from 'react';

interface KillCommandStatus {
  active: boolean;
  message?: string;
  loading: boolean;
  error?: string;
}

/**
 * Custom hook to monitor kill command status
 * Updates every 10 seconds to stay current
 */
export function useKillCommandStatus() {
  const [status, setStatus] = useState<KillCommandStatus>({
    active: false,
    loading: true
  });

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/admin/kill-command', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({
          active: data.active,
          message: data.active ? 'System is in emergency lockdown mode' : undefined,
          loading: false
        });
      } else if (response.status === 403) {
        // User doesn't have permission to check status
        // Don't set active state, just clear loading
        setStatus({
          active: false,
          loading: false
        });
      } else {
        setStatus({
          active: false,
          loading: false,
          error: 'Failed to check system status'
        });
      }
    } catch (error) {
      setStatus({
        active: false,
        loading: false,
        error: 'Network error checking system status'
      });
    }
  };

  useEffect(() => {
    checkStatus();

    // Check every 10 seconds
    const interval = setInterval(checkStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Component to display kill command warning banner
 */
export function KillCommandBanner() {
  const { active, message, loading } = useKillCommandStatus();

  if (loading || !active) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-bold">⚠️ SYSTEM LOCKDOWN ACTIVE</p>
            <p className="text-sm">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="animate-pulse bg-white rounded-full w-3 h-3" />
          <span className="text-sm font-medium">LOCKED</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if current operation should be blocked
 * Shows user-friendly error if kill command is active
 */
export function useOperationGuard() {
  const { active } = useKillCommandStatus();

  const guardOperation = async (operation: () => Promise<any>) => {
    if (active) {
      throw new Error(
        'OPERATION_BLOCKED: System is in emergency lockdown mode. All operations are temporarily frozen.'
      );
    }

    return await operation();
  };

  return { guardOperation, isLocked: active };
}
