/**
 * components/command/history/HistoryViewer.tsx
 * Unified Event Timeline Viewer
 * Created: 2026-02-22 03:24 ET
 * 
 * Features:
 * - Polls /api/command-center/history every 3 seconds
 * - Multi-select filtering by event type
 * - Grouped by date
 * - Expandable items
 * - Live stream mode with new event notifications
 * - Pagination support
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { HistoryItem } from './HistoryItem';
import {
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface HistoryEvent {
  id: string;
  type: 'cycle' | 'patch' | 'anomaly' | 'control' | 'roadmap_version';
  timestamp: string;
  summary: string;
  details: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

interface HistoryResponse {
  events: HistoryEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    types: string[];
    startDate: string | null;
    endDate: string | null;
  };
}

const eventTypes = [
  { value: 'cycle', label: 'Cycles', color: 'blue' },
  { value: 'patch', label: 'Patches', color: 'purple' },
  { value: 'anomaly', label: 'Anomalies', color: 'red' },
  { value: 'control', label: 'Control', color: 'purple' },
  { value: 'roadmap_version', label: 'Snapshots', color: 'green' },
];

export function HistoryViewer() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['cycle', 'control', 'anomaly', 'roadmap_version']);
  const [showFilters, setShowFilters] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const typesParam = selectedTypes.join(',');
      const res = await fetch(`/api/command-center/history?types=${typesParam}&limit=50`);
      
      if (!res.ok) {
        throw new Error(`History API returned ${res.status}`);
      }

      const data = await res.json() as HistoryResponse;
      
      // Check for new events (compare first event ID)
      if (events.length > 0 && data.events.length > 0) {
        const firstOldId = events[0]?.id;
        const newEvents = data.events.filter(e => e.id !== firstOldId);
        if (newEvents.length > 0) {
          setNewEventsCount(newEvents.length);
        }
      }
      
      setEvents(data.events);
      setError(null);
    } catch (err) {
      console.error('[HistoryViewer] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, [selectedTypes, events]);

  // Poll every 3 seconds
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  // Toggle event type filter
  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Clear new events notification
  const clearNewEvents = () => {
    setNewEventsCount(0);
  };

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, HistoryEvent[]>);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event History</h1>
          <p className="text-sm text-gray-600 mt-1">
            Unified timeline of all autonomy events
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FunnelIcon className="h-5 w-5" />
          <span>Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filter Events</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-2">
            {eventTypes.map(type => (
              <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.value)}
                  onChange={() => toggleType(type.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{type.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Pills */}
      {selectedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTypes.map(type => {
            const config = eventTypes.find(t => t.value === type);
            return (
              <span
                key={type}
                className={`px-3 py-1 text-sm font-medium rounded-full bg-${config?.color}-100 text-${config?.color}-700`}
              >
                {config?.label}
              </span>
            );
          })}
        </div>
      )}

      {/* New Events Banner */}
      {newEventsCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{newEventsCount}</span> new event{newEventsCount !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={clearNewEvents}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="max-w-3xl mx-auto space-y-8">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No events found for selected filters</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="sticky top-0 bg-gray-100 px-4 py-2 rounded-lg mb-4 z-10">
                <h2 className="text-sm font-semibold text-gray-700">{date}</h2>
              </div>

              {/* Events for this date */}
              <div className="space-y-3">
                {dateEvents.map(event => (
                  <HistoryItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More Placeholder */}
      {events.length >= 50 && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">
            Showing {events.length} most recent events
          </p>
        </div>
      )}
    </div>
  );
}
