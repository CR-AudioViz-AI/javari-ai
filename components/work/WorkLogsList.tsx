'use client';

import { useState, useEffect } from 'react';
import { JavariWorkLog } from '@/lib/types/javari-types';
import { WorkLogCard } from './WorkLogCard';
import { FilterIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';

interface WorkLogsListProps {
  chatSessionId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in ms
}

export function WorkLogsList({ 
  chatSessionId, 
  autoRefresh = false,
  refreshInterval = 30000 
}: WorkLogsListProps) {
  const [workLogs, setWorkLogs] = useState<JavariWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [actionType, setActionType] = useState<string>('');
  const [actionCategory, setActionCategory] = useState<string>('');
  const [impactLevel, setImpactLevel] = useState<string>('');
  const [needsReview, setNeedsReview] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  
  const fetchWorkLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query params
      const params = new URLSearchParams();
      if (chatSessionId) params.append('chat_session_id', chatSessionId);
      if (actionType) params.append('action_type', actionType);
      if (actionCategory) params.append('action_category', actionCategory);
      if (impactLevel) params.append('impact_level', impactLevel);
      if (needsReview !== null) params.append('needs_review', needsReview.toString());
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      
      const response = await fetch(`/api/work?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch work logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      setWorkLogs(data.work_logs || []);
      setTotal(data.total || 0);
      
    } catch (err) {
      console.error('Error fetching work logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch work logs');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (id: string) => {
    // TODO: Implement edit modal
    console.log('Edit work log:', id);
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work log?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/work/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete work log');
      }
      
      // Refresh list
      await fetchWorkLogs();
      
    } catch (err) {
      console.error('Error deleting work log:', err);
      alert('Failed to delete work log');
    }
  };
  
  const resetFilters = () => {
    setActionType('');
    setActionCategory('');
    setImpactLevel('');
    setNeedsReview(null);
    setOffset(0);
  };
  
  // Initial fetch
  useEffect(() => {
    fetchWorkLogs();
  }, [chatSessionId, actionType, actionCategory, impactLevel, needsReview, limit, offset]);
  
  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchWorkLogs();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);
  
  const hasFilters = actionType || actionCategory || impactLevel || needsReview !== null;
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Work Logs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {workLogs.length} of {total} work logs
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
              showFilters || hasFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FilterIcon className="w-4 h-4" />
            Filters
            {hasFilters && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                Active
              </span>
            )}
          </button>
          
          <button
            onClick={fetchWorkLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                value={actionType}
                onChange={(e) => {
                  setActionType(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="file_created">File Created</option>
                <option value="file_modified">File Modified</option>
                <option value="file_deleted">File Deleted</option>
                <option value="api_created">API Created</option>
                <option value="test_written">Test Written</option>
                <option value="bug_fixed">Bug Fixed</option>
                <option value="feature_added">Feature Added</option>
                <option value="refactored">Refactored</option>
                <option value="deployed">Deployed</option>
              </select>
            </div>
            
            {/* Action Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={actionCategory}
                onChange={(e) => {
                  setActionCategory(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">All Categories</option>
                <option value="code">Code</option>
                <option value="config">Config</option>
                <option value="docs">Documentation</option>
                <option value="tests">Tests</option>
                <option value="deployment">Deployment</option>
              </select>
            </div>
            
            {/* Impact Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impact Level
              </label>
              <select
                value={impactLevel}
                onChange={(e) => {
                  setImpactLevel(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">All Impacts</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            {/* Needs Review */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Status
              </label>
              <select
                value={needsReview === null ? '' : needsReview.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  setNeedsReview(value === '' ? null : value === 'true');
                  setOffset(0);
                }}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="true">Needs Review</option>
                <option value="false">No Review Needed</option>
              </select>
            </div>
          </div>
          
          {hasFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Loading State */}
      {loading && workLogs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCwIcon className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error loading work logs</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !error && workLogs.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-gray-200">
          <SearchIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No work logs found</h3>
          <p className="text-gray-600">
            {hasFilters ? 'Try adjusting your filters' : 'Work logs will appear here once created'}
          </p>
        </div>
      )}
      
      {/* Work Logs Grid */}
      {!loading && !error && workLogs.length > 0 && (
        <div className="grid gap-4">
          {workLogs.map((workLog) => (
            <WorkLogCard
              key={workLog.id}
              workLog={workLog}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      
      {/* Pagination */}
      {!loading && !error && total > limit && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
