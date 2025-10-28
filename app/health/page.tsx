'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface BuildHealth {
  id: string;
  project_id: string;
  build_status: 'success' | 'failed' | 'pending';
  error_type?: string;
  error_message?: string;
  auto_fixable: boolean;
  fix_suggestion?: string;
  fix_confidence?: number;
  fix_applied: boolean;
  fix_result?: 'success' | 'failed';
  build_duration_seconds?: number;
  files_affected: string[];
  build_started_at: string;
  build_completed_at?: string;
}

interface HealthStats {
  total_builds: number;
  successful_builds: number;
  failed_builds: number;
  pending_builds: number;
  success_rate: number;
  auto_fix_rate: number;
  avg_build_duration: number;
}

export default function HealthPage() {
  const [builds, setBuilds] = useState<BuildHealth[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [autoHealing, setAutoHealing] = useState(false);

  useEffect(() => {
    fetchBuilds();
    fetchStats();
  }, []);

  const fetchBuilds = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setBuilds(data.builds || []);
      }
    } catch (error) {
      console.error('Error fetching builds:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/health/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const triggerAutoFix = async (buildId: string) => {
    setAutoHealing(true);
    try {
      const response = await fetch('/api/health/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId })
      });
      
      if (response.ok) {
        await fetchBuilds();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error triggering auto-fix:', error);
    } finally {
      setAutoHealing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const filteredBuilds = builds.filter(build => {
    if (filterStatus === 'all') return true;
    return build.build_status === filterStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#4FFFB0] animate-pulse">Loading build health...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#4FFFB0] to-[#00D9FF] bg-clip-text text-transparent">
                Build Health Monitoring
              </h1>
              <p className="text-gray-400">Real-time tracking of build status and auto-healing</p>
            </div>
            <Button
              onClick={() => { fetchBuilds(); fetchStats(); }}
              className="bg-[#4FFFB0]/20 hover:bg-[#4FFFB0]/30 border border-[#4FFFB0]/30"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-3xl font-bold text-green-400">
                    {stats.success_rate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400/30" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {stats.successful_builds}/{stats.total_builds} builds
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-red-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Failed Builds</p>
                  <p className="text-3xl font-bold text-red-400">{stats.failed_builds}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400/30" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Requires attention
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-[#00D9FF]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Auto-Fix Rate</p>
                  <p className="text-3xl font-bold text-[#00D9FF]">
                    {stats.auto_fix_rate.toFixed(1)}%
                  </p>
                </div>
                <Zap className="w-8 h-8 text-[#00D9FF]/30" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Self-healing active
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-yellow-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Duration</p>
                  <p className="text-3xl font-bold text-yellow-400">
                    {stats.avg_build_duration.toFixed(0)}s
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Per build average
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            className={filterStatus === 'all' ? 'bg-[#4FFFB0]/20' : ''}
          >
            All Builds
          </Button>
          <Button
            variant={filterStatus === 'success' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('success')}
            className={filterStatus === 'success' ? 'bg-green-500/20' : ''}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Success
          </Button>
          <Button
            variant={filterStatus === 'failed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('failed')}
            className={filterStatus === 'failed' ? 'bg-red-500/20' : ''}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Failed
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
            className={filterStatus === 'pending' ? 'bg-yellow-500/20' : ''}
          >
            <Clock className="w-4 h-4 mr-2" />
            Pending
          </Button>
        </div>

        {/* Builds List */}
        <div className="space-y-4">
          {filteredBuilds.length === 0 ? (
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-8 text-center">
              <p className="text-gray-400">No builds found</p>
            </Card>
          ) : (
            filteredBuilds.map((build) => (
              <Card key={build.id} className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6 hover:border-[#4FFFB0]/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-[#4FFFB0]/10 rounded-lg">
                      {getStatusIcon(build.build_status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={getStatusColor(build.build_status)}>
                          {build.build_status}
                        </Badge>
                        {build.auto_fixable && (
                          <Badge className="bg-[#00D9FF]/10 text-[#00D9FF]">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto-fixable
                          </Badge>
                        )}
                        {build.fix_applied && (
                          <Badge className="bg-green-500/10 text-green-400">
                            Fix Applied
                          </Badge>
                        )}
                      </div>

                      {build.error_type && (
                        <div className="mb-3">
                          <p className="text-red-400 font-semibold mb-1">{build.error_type}</p>
                          {build.error_message && (
                            <p className="text-gray-400 text-sm font-mono bg-black/30 p-2 rounded">
                              {build.error_message}
                            </p>
                          )}
                        </div>
                      )}

                      {build.fix_suggestion && (
                        <div className="mb-3 bg-[#00D9FF]/10 border border-[#00D9FF]/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-[#00D9FF]" />
                            <span className="text-sm font-semibold text-[#00D9FF]">
                              Auto-Fix Suggestion
                            </span>
                            {build.fix_confidence && (
                              <Badge className="bg-[#00D9FF]/20 text-[#00D9FF] text-xs">
                                {(build.fix_confidence * 100).toFixed(0)}% confident
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-300">{build.fix_suggestion}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Duration</p>
                          <p className="text-white font-medium">
                            {build.build_duration_seconds 
                              ? `${build.build_duration_seconds}s`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Files Affected</p>
                          <p className="text-white font-medium">{build.files_affected.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Started</p>
                          <p className="text-white font-medium">
                            {new Date(build.build_started_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {build.files_affected.length > 0 && (
                        <div className="mt-3">
                          <p className="text-gray-400 text-sm mb-1">Affected Files:</p>
                          <div className="flex flex-wrap gap-2">
                            {build.files_affected.slice(0, 5).map((file, idx) => (
                              <Badge key={idx} className="bg-gray-500/10 text-gray-300 text-xs">
                                {file}
                              </Badge>
                            ))}
                            {build.files_affected.length > 5 && (
                              <Badge className="bg-gray-500/10 text-gray-300 text-xs">
                                +{build.files_affected.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {build.auto_fixable && !build.fix_applied && (
                      <Button
                        onClick={() => triggerAutoFix(build.id)}
                        disabled={autoHealing}
                        className="bg-[#00D9FF]/20 hover:bg-[#00D9FF]/30 border border-[#00D9FF]/30"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {autoHealing ? 'Healing...' : 'Auto-Fix'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
