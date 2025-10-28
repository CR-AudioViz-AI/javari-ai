'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  FileIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  GitCommitIcon,
  RocketIcon,
  BarChart3Icon
} from 'lucide-react';

interface WorkLogStatsProps {
  chatSessionId?: string;
  startDate?: string;
  endDate?: string;
  autoRefresh?: boolean;
}

interface Stats {
  total_logs: number;
  by_action_type: Record<string, number>;
  by_category: Record<string, number>;
  by_impact: Record<string, number>;
  code_metrics: {
    total_lines_added: number;
    total_lines_deleted: number;
    net_code_change: number;
    total_complexity_added: number;
  };
  cost_metrics: {
    total_cost_saved: number;
    total_cost_incurred: number;
    net_cost_impact: number;
  };
  file_metrics: {
    files_affected_count: number;
    unique_files_count: number;
  };
  quality_metrics: {
    breaking_changes_count: number;
    tests_added_count: number;
    breaking_change_percentage: number;
    test_coverage_percentage: number;
  };
  review_metrics: {
    needs_review_count: number;
    review_completed_count: number;
    review_pending_count: number;
    review_completion_rate: number;
  };
  tracking_metrics: {
    unique_commits_count: number;
    unique_deployments_count: number;
  };
}

export function WorkLogStats({ 
  chatSessionId, 
  startDate, 
  endDate,
  autoRefresh = false 
}: WorkLogStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (chatSessionId) params.append('chat_session_id', chatSessionId);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await fetch(`/api/work/stats?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      
      const data = await response.json();
      setStats(data);
      
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStats();
  }, [chatSessionId, startDate, endDate]);
  
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [autoRefresh]);
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-lg" />
        <div className="h-32 bg-gray-200 rounded-lg" />
      </div>
    );
  }
  
  if (error || !stats) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Error loading statistics</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Work Logs */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <BarChart3Icon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.total_logs}</span>
          </div>
          <div className="text-blue-100 text-sm font-medium">Total Work Logs</div>
        </div>
        
        {/* Net Code Change */}
        <div className={`rounded-lg p-6 text-white ${
          stats.code_metrics.net_code_change >= 0
            ? 'bg-gradient-to-br from-green-500 to-green-600'
            : 'bg-gradient-to-br from-red-500 to-red-600'
        }`}>
          <div className="flex items-center justify-between mb-2">
            {stats.code_metrics.net_code_change >= 0 ? (
              <TrendingUpIcon className="w-8 h-8 opacity-80" />
            ) : (
              <TrendingDownIcon className="w-8 h-8 opacity-80" />
            )}
            <span className="text-3xl font-bold">
              {stats.code_metrics.net_code_change >= 0 ? '+' : ''}
              {stats.code_metrics.net_code_change.toLocaleString()}
            </span>
          </div>
          <div className="text-opacity-80 text-white text-sm font-medium">Net Code Change</div>
        </div>
        
        {/* Cost Impact */}
        <div className={`rounded-lg p-6 text-white ${
          stats.cost_metrics.net_cost_impact >= 0
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
            : 'bg-gradient-to-br from-orange-500 to-orange-600'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <DollarSignIcon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">
              ${Math.abs(stats.cost_metrics.net_cost_impact).toFixed(0)}
            </span>
          </div>
          <div className="text-opacity-80 text-white text-sm font-medium">
            {stats.cost_metrics.net_cost_impact >= 0 ? 'Cost Saved' : 'Cost Incurred'}
          </div>
        </div>
        
        {/* Files Affected */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <FileIcon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.file_metrics.unique_files_count}</span>
          </div>
          <div className="text-purple-100 text-sm font-medium">Unique Files Modified</div>
        </div>
      </div>
      
      {/* Code Metrics */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Code Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-green-600">
              +{stats.code_metrics.total_lines_added.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">Lines Added</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              -{stats.code_metrics.total_lines_deleted.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">Lines Deleted</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              +{stats.code_metrics.total_complexity_added}
            </div>
            <div className="text-sm text-gray-600 mt-1">Complexity Added</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.file_metrics.files_affected_count}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total File Changes</div>
          </div>
        </div>
      </div>
      
      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quality Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">Tests Added</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">
                  {stats.quality_metrics.tests_added_count}
                </div>
                <div className="text-xs text-gray-600">
                  {stats.quality_metrics.test_coverage_percentage.toFixed(1)}% coverage
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-orange-600" />
                <span className="text-gray-700">Breaking Changes</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-900">
                  {stats.quality_metrics.breaking_changes_count}
                </div>
                <div className="text-xs text-gray-600">
                  {stats.quality_metrics.breaking_change_percentage.toFixed(1)}% of changes
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Review Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Needs Review</span>
              <span className="text-xl font-bold text-yellow-600">
                {stats.review_metrics.needs_review_count}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Reviewed</span>
              <span className="text-xl font-bold text-green-600">
                {stats.review_metrics.review_completed_count}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Pending</span>
              <span className="text-xl font-bold text-orange-600">
                {stats.review_metrics.review_pending_count}
              </span>
            </div>
            
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">Completion Rate</span>
                <span className="text-2xl font-bold text-blue-600">
                  {stats.review_metrics.review_completion_rate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Distribution */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Action Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(stats.by_action_type).map(([type, count]) => (
            <div key={type} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-600 mt-1 capitalize">
                {type.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tracking Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <GitCommitIcon className="w-6 h-6 opacity-80" />
            <span className="text-3xl font-bold">{stats.tracking_metrics.unique_commits_count}</span>
          </div>
          <div className="text-gray-300 text-sm font-medium">Unique Commits Tracked</div>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <RocketIcon className="w-6 h-6 opacity-80" />
            <span className="text-3xl font-bold">{stats.tracking_metrics.unique_deployments_count}</span>
          </div>
          <div className="text-indigo-200 text-sm font-medium">Deployments Tracked</div>
        </div>
      </div>
    </div>
  );
}
