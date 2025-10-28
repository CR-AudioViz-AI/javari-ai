'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Code, 
  FileCode,
  GitCommit,
  ExternalLink,
  Filter,
  Search,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react';

interface WorkLog {
  id: string;
  chat_session_id: string;
  action_type: string;
  action_category: string;
  description: string;
  impact_level: string;
  files_affected: string[];
  lines_added: number;
  lines_deleted: number;
  tests_added: boolean;
  breaking_change: boolean;
  cost_saved: number;
  cost_incurred: number;
  needs_review: boolean;
  commit_sha?: string;
  deploy_url?: string;
  created_at: string;
}

interface WorkLogStats {
  total_logs: number;
  total_files_affected: number;
  total_lines_added: number;
  total_lines_deleted: number;
  total_cost_saved: number;
  total_cost_incurred: number;
  critical_actions: number;
  breaking_changes: number;
}

export default function WorkLogsPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [stats, setStats] = useState<WorkLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWorkLogs();
    fetchStats();
  }, []);

  const fetchWorkLogs = async () => {
    try {
      const response = await fetch('/api/work/log');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.work_logs || []);
      }
    } catch (error) {
      console.error('Error fetching work logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/work/log/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'file_created': return <FileText className="w-4 h-4" />;
      case 'file_modified': return <FileCode className="w-4 h-4" />;
      case 'api_created': return <Code className="w-4 h-4" />;
      case 'deployed': return <GitCommit className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'major': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'moderate': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'minor': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'code': return 'bg-purple-500/10 text-purple-400';
      case 'config': return 'bg-blue-500/10 text-blue-400';
      case 'docs': return 'bg-green-500/10 text-green-400';
      case 'tests': return 'bg-cyan-500/10 text-cyan-400';
      case 'deployment': return 'bg-orange-500/10 text-orange-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterCategory !== 'all' && log.action_category !== filterCategory) return false;
    if (filterImpact !== 'all' && log.impact_level !== filterImpact) return false;
    if (searchTerm && !log.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#4FFFB0] animate-pulse">Loading work logs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#4FFFB0] to-[#00D9FF] bg-clip-text text-transparent">
            Work Logs
          </h1>
          <p className="text-gray-400">Track all development activities and their impact</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Actions</p>
                  <p className="text-3xl font-bold text-[#4FFFB0]">{stats.total_logs}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-[#4FFFB0]/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-[#00D9FF]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Files Modified</p>
                  <p className="text-3xl font-bold text-[#00D9FF]">{stats.total_files_affected}</p>
                </div>
                <FileText className="w-8 h-8 text-[#00D9FF]/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Lines Added</p>
                  <p className="text-3xl font-bold text-green-400">{stats.total_lines_added}</p>
                </div>
                <Code className="w-8 h-8 text-green-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-red-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Cost Saved</p>
                  <p className="text-3xl font-bold text-green-400">${stats.total_cost_saved.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Categories</option>
              <option value="code">Code</option>
              <option value="config">Config</option>
              <option value="docs">Docs</option>
              <option value="tests">Tests</option>
              <option value="deployment">Deployment</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterImpact}
              onChange={(e) => setFilterImpact(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Impact Levels</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="moderate">Moderate</option>
              <option value="minor">Minor</option>
            </select>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Work Logs List */}
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-8 text-center">
              <p className="text-gray-400">No work logs found</p>
            </Card>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6 hover:border-[#4FFFB0]/40 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-[#4FFFB0]/10 rounded-lg">
                      {getActionIcon(log.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getCategoryColor(log.action_category)}>
                          {log.action_category}
                        </Badge>
                        <Badge className={getImpactColor(log.impact_level)}>
                          {log.impact_level}
                        </Badge>
                        {log.breaking_change && (
                          <Badge className="bg-red-500/10 text-red-400">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Breaking
                          </Badge>
                        )}
                        {log.tests_added && (
                          <Badge className="bg-green-500/10 text-green-400">
                            Tests Added
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{log.description}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Files Affected</p>
                          <p className="text-white font-medium">{log.files_affected.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Lines Added</p>
                          <p className="text-green-400 font-medium">+{log.lines_added}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Lines Deleted</p>
                          <p className="text-red-400 font-medium">-{log.lines_deleted}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Cost Impact</p>
                          <p className="text-green-400 font-medium">
                            ${(log.cost_saved - log.cost_incurred).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {log.files_affected.length > 0 && (
                        <div className="mt-3">
                          <p className="text-gray-400 text-sm mb-1">Modified Files:</p>
                          <div className="flex flex-wrap gap-2">
                            {log.files_affected.slice(0, 5).map((file, idx) => (
                              <Badge key={idx} className="bg-gray-500/10 text-gray-300 text-xs">
                                {file}
                              </Badge>
                            ))}
                            {log.files_affected.length > 5 && (
                              <Badge className="bg-gray-500/10 text-gray-300 text-xs">
                                +{log.files_affected.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    {log.deploy_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#4FFFB0]/20 hover:bg-[#4FFFB0]/10"
                        onClick={() => window.open(log.deploy_url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Deploy
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
