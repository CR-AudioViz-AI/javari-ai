'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wrench,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface BuildHealth {
  id: string;
  project_id: string;
  project_name: string;
  build_status: 'success' | 'failed' | 'building' | 'cancelled';
  error_message?: string;
  build_duration_ms?: number;
  deployment_url?: string;
  git_commit_sha?: string;
  git_commit_message?: string;
  auto_fix_attempted: boolean;
  auto_fix_successful?: boolean;
  fix_confidence_score?: number;
  created_at: string;
}

interface HealthStats {
  overallHealth: number;
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  avgBuildTime: number;
  autoFixSuccessRate: number;
}

export function BuildHealthMonitor() {
  const [builds, setBuilds] = useState<BuildHealth[]>([]);
  const [stats, setStats] = useState<HealthStats>({
    overallHealth: 100,
    totalBuilds: 0,
    successfulBuilds: 0,
    failedBuilds: 0,
    avgBuildTime: 0,
    autoFixSuccessRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'failed' | 'success'>('all');

  useEffect(() => {
    loadBuildHealth();
    // Refresh every 30 seconds
    const interval = setInterval(loadBuildHealth, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadBuildHealth = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual API call when build health tracking is set up
      // For now, show mock data structure
      setBuilds([]);
      setStats({
        overallHealth: 100,
        totalBuilds: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
        avgBuildTime: 0,
        autoFixSuccessRate: 0,
      });
    } catch (error: unknown) {
      console.error('Error loading build health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'building':
        return 'text-blue-400';
      case 'cancelled':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} className="text-green-400" />;
      case 'failed':
        return <AlertCircle size={20} className="text-red-400" />;
      case 'building':
        return <RefreshCw size={20} className="text-blue-400 animate-spin" />;
      default:
        return <Clock size={20} className="text-gray-400" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Build Health</h1>
          <p className="text-gray-400 mt-1">Monitor build status and auto-fix performance</p>
        </div>
        <button
          onClick={loadBuildHealth}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Overall Health</span>
            <Activity size={20} className={getHealthColor(stats.overallHealth)} />
          </div>
          <div className={`text-3xl font-bold ${getHealthColor(stats.overallHealth)}`}>
            {stats.overallHealth}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.overallHealth >= 80 ? 'Excellent' : stats.overallHealth >= 60 ? 'Good' : 'Needs Attention'}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Builds</span>
            <Activity size={20} className="text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalBuilds}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.successfulBuilds} successful • {stats.failedBuilds} failed
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Avg Build Time</span>
            <Clock size={20} className="text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{formatDuration(stats.avgBuildTime)}</div>
          <div className="text-xs text-gray-500 mt-1">Average duration</div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Auto-Fix Success</span>
            <Wrench size={20} className="text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-400">{stats.autoFixSuccessRate}%</div>
          <div className="text-xs text-gray-500 mt-1">Self-healing rate</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All Builds
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'failed'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Failed Only
        </button>
        <button
          onClick={() => setFilter('success')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Successful Only
        </button>
      </div>

      {/* Build List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading build health data...</div>
      ) : builds.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="mx-auto mb-4 text-gray-500" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">No build data yet</h3>
          <p className="text-gray-400 mb-4">
            Build health monitoring will appear here once you start deploying
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {builds.map((build) => (
            <div
              key={build.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">{getStatusIcon(build.build_status)}</div>

                {/* Build Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{build.project_name}</h3>
                      {build.git_commit_message && (
                        <p className="text-sm text-gray-400 truncate">{build.git_commit_message}</p>
                      )}
                    </div>
                    {build.deployment_url && (
                      <a
                        href={build.deployment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        <ExternalLink size={14} />
                        View
                      </a>
                    )}
                  </div>

                  {/* Build Details */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-2">
                    {build.git_commit_sha && (
                      <span className="font-mono">{build.git_commit_sha.slice(0, 8)}</span>
                    )}
                    {build.build_duration_ms && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDuration(build.build_duration_ms)}
                      </span>
                    )}
                    <span>{new Date(build.created_at).toLocaleString()}</span>
                  </div>

                  {/* Error Message */}
                  {build.error_message && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-2">
                      <p className="text-sm text-red-400 font-mono">{build.error_message}</p>
                    </div>
                  )}

                  {/* Auto-Fix Info */}
                  {build.auto_fix_attempted && (
                    <div className="flex items-center gap-2 text-sm">
                      <Wrench size={14} className="text-blue-400" />
                      <span className="text-gray-400">
                        Auto-fix attempted
                        {build.auto_fix_successful !== undefined && (
                          <span
                            className={
                              build.auto_fix_successful ? 'text-green-400 ml-1' : 'text-red-400 ml-1'
                            }
                          >
                            ({build.auto_fix_successful ? 'Success' : 'Failed'})
                          </span>
                        )}
                        {build.fix_confidence_score !== undefined && (
                          <span className="text-gray-500 ml-1">
                            • {build.fix_confidence_score}% confidence
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coming Soon Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <Activity className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-white font-medium mb-1">Build Health Monitoring - Coming Soon</h4>
            <p className="text-sm text-gray-400">
              This feature will automatically track all your Vercel deployments, detect failures, and attempt
              self-healing fixes. Integration with Vercel webhooks is being developed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
