/**
 * components/command/history/HistoryItem.tsx
 * Individual History Event Item
 * Created: 2026-02-22 03:23 ET
 * 
 * Displays single event with:
 * - Type-specific icon and color
 * - Time ago display
 * - Expandable details
 * - Smooth animations
 */

'use client';

import { useState, memo } from 'react';
import {
  CpuChipIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface HistoryEvent {
  id: string;
  type: 'cycle' | 'patch' | 'anomaly' | 'control' | 'roadmap_version';
  timestamp: string;
  summary: string;
  details: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

interface HistoryItemProps {
  event: HistoryEvent;
}

const eventConfig = {
  cycle: {
    icon: CpuChipIcon,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    label: 'Cycle',
  },
  patch: {
    icon: CommandLineIcon,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600',
    label: 'Patch',
  },
  anomaly: {
    icon: ExclamationTriangleIcon,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    label: 'Anomaly',
  },
  control: {
    icon: CommandLineIcon,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    iconColor: 'text-purple-600',
    label: 'Control',
  },
  roadmap_version: {
    icon: CameraIcon,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    label: 'Snapshot',
  },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function HistoryItemComponent({ event }: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  const config = eventConfig[event.type];
  const Icon = config.icon;
  const timeAgo = formatTimeAgo(event.timestamp);
  const absoluteTime = new Date(event.timestamp).toLocaleString();

  return (
    <div
      className={`border rounded-lg transition-all duration-200 ${config.borderColor} ${
        expanded ? config.bgColor : 'bg-white hover:bg-gray-50'
      }`}
    >
      {/* Main Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {/* Icon */}
        <div className={`flex-shrink-0 p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Badge & Time */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.bgColor} ${config.iconColor}`}>
              {config.label}
            </span>
            <span
              className="text-xs text-gray-500"
              title={absoluteTime}
            >
              {timeAgo}
            </span>
          </div>

          {/* Summary */}
          <p className="text-sm text-gray-900 font-medium truncate">
            {event.summary}
          </p>
        </div>

        {/* Expand Icon */}
        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="mt-3 space-y-2">
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Event ID:</span> {event.id}
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold">Timestamp:</span> {absoluteTime}
            </div>
            
            {/* Details Object */}
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Details:</p>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const HistoryItem = memo(HistoryItemComponent);
