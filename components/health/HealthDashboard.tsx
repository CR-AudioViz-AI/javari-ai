'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  WrenchIcon,
  TrendingUpIcon,
  ActivityIcon,
} from 'lucide-react';

interface HealthRecord {
  id: string;
  project_id: string;
  build_id?: string;
  build_status: 'success' | 'failed' | 'pending';
  error_type?: string;
  error_message?: string;
  auto_fixable: boolean;
  fix_suggestion?: string;
  fix_confidence?: number;
  fix_applied: boolean;
  fix_result?: 'success' | 'failed';
  build_duration_seconds?: number;
  files_affected?: string[];
  created_at: string;
}

interface HealthDashboardProps {
  projectId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function HealthDashboard({
  projectId,
  autoRefresh = false,
  refreshInterval = 60000,
}: HealthDashboardProps) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch health records
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      params.append('limit', '10');
      
      const recordsRes = await fetch(`/api/health?${params.toString()}`);
      if (!recordsRes.ok) throw new Error('Failed to fetch health records');
      const recordsData = await recordsRes.json();
      setRecords(recordsData.health_records || []);
      
      // Fetch stats
      const statsParams = new URLSearchParams();
      if (projectId) statsParams.append('project_id', projectId);
      
      const statsRes = await fetch(`/api/health/fix/stats?${statsParams.toString()}`);
      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      const statsData = await statsRes.json();
      setStats(statsData);
      
    } catch (err) {
      console.error('Error fetching health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAutoFix = async (recordId: string) => {
    try {
      const response = await fetch('/api/health/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health_record_id: recordId }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Auto-fix ${data.success ? 'successful' : 'completed'}!\n\n${data.message}`);
        await fetchHealth(); // Refresh data
      } else {
        alert(`Auto-fix failed: ${data.error || data.message}`);
      }
      
    } catch (err) {
      console.error('Error applying auto-fix:', err);
      alert('Failed to apply auto-fix');
    }
  };
  
  useEffect(() => {
    fetchHealth();
  }, [projectId]);
  
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);
  
  if (loading && !records.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <ActivityIcon className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Error loading health data</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }
  
  const latestFailure = records.find(r => r.build_status === 'failed');
  const recentSuccess = records.find(r => r.build_status === 'success');
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Failures */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Failures</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_failures}</p>
              </div>
              <XCircleIcon className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          {/* Auto-fixable */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto-fixable</p>
                <p className="text-2xl font-bold text-gray-900">{stats.auto_fixable_count}</p>
              </div>
              <WrenchIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          {/* Success Rate */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fix Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.success_rate}%</p>
              </div>
              <TrendingUpIcon className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          {/* Avg Confidence */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(stats.average_fix_confidence * 100).toFixed(0)}%
                </p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}
      
      {/* Latest Failure Alert */}
      {latestFailure && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangleIcon className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-900">Latest Build Failure</h3>
                {latestFailure.auto_fixable && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Auto-fixable
                  </span>
                )}
              </div>
              
              <p className="text-sm text-red-800 mb-3">
                {latestFailure.error_message || 'Build failed'}
              </p>
              
              {latestFailure.fix_suggestion && (
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Suggested Fix (Confidence: {((latestFailure.fix_confidence || 0) * 100).toFixed(0)}%):
                  </p>
                  <p className="text-sm text-gray-900">{latestFailure.fix_suggestion}</p>
                </div>
              )}
              
              {latestFailure.files_affected && latestFailure.files_affected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {latestFailure.files_affected.map((file, idx) => (
                    <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                      {file.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {latestFailure.auto_fixable && !latestFailure.fix_applied && (
              <button
                onClick={() => handleAutoFix(latestFailure.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                <WrenchIcon className="w-4 h-4" />
                Auto-Fix
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Recent Success */}
      {recentSuccess && !latestFailure && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-900">All Builds Passing</h3>
          </div>
          <p className="text-sm text-green-800 mt-2">
            Latest build completed successfully
            {recentSuccess.build_duration_seconds && 
              ` in ${recentSuccess.build_duration_seconds}s`}
          </p>
        </div>
      )}
      
      {/* Recent Build History */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Recent Build History</h3>
        
        {records.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No build history available</p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                  record.build_status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : record.build_status === 'failed'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {record.build_status === 'success' ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : record.build_status === 'failed' ? (
                    <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 capitalize">
                      {record.build_status}
                    </p>
                    {record.error_type && (
                      <p className="text-sm text-gray-600 truncate">{record.error_type}</p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-600">
                      {new Date(record.created_at).toLocaleString()}
                    </p>
                    {record.build_duration_seconds && (
                      <p className="text-xs text-gray-500">
                        {record.build_duration_seconds}s
                      </p>
                    )}
                  </div>
                </div>
                
                {record.auto_fixable && !record.fix_applied && record.build_status === 'failed' && (
                  <button
                    onClick={() => handleAutoFix(record.id)}
                    className="ml-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Fix
                  </button>
                )}
                
                {record.fix_applied && (
                  <span className={`ml-4 text-xs px-2 py-1 rounded-full ${
                    record.fix_result === 'success'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {record.fix_result === 'success' ? 'Fixed' : 'Fix attempted'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
