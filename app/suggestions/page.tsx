'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  Zap,
  Shield,
  FileCode,
  BookOpen,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  Search,
  ThumbsUp,
  Eye
} from 'lucide-react';

interface SmartSuggestion {
  id: string;
  type: 'optimization' | 'refactor' | 'security' | 'feature' | 'documentation';
  title: string;
  description: string;
  rationale?: string;
  code_example?: string;
  files_to_modify: string[];
  estimated_effort_hours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence_score: number;
  expected_impact: string;
  potential_risks?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'implemented';
  created_at: string;
}

interface SuggestionStats {
  total_suggestions: number;
  pending_suggestions: number;
  accepted_suggestions: number;
  implemented_suggestions: number;
  avg_confidence: number;
  total_estimated_hours: number;
  high_priority_count: number;
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [stats, setStats] = useState<SuggestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSuggestions();
    fetchStats();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/suggestions');
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error: unknown) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/suggestions/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error: unknown) {
      console.error('Error fetching stats:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'security':
        return <Shield className="w-5 h-5 text-red-400" />;
      case 'refactor':
        return <FileCode className="w-5 h-5 text-blue-400" />;
      case 'feature':
        return <Lightbulb className="w-5 h-5 text-purple-400" />;
      case 'documentation':
        return <BookOpen className="w-5 h-5 text-green-400" />;
      default:
        return <Lightbulb className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'optimization':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'security':
        return 'bg-red-500/10 text-red-400';
      case 'refactor':
        return 'bg-blue-500/10 text-blue-400';
      case 'feature':
        return 'bg-purple-500/10 text-purple-400';
      case 'documentation':
        return 'bg-green-500/10 text-green-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'accepted':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-400';
      case 'high':
        return 'bg-orange-500/10 text-orange-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'low':
        return 'bg-blue-500/10 text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filterType !== 'all' && suggestion.type !== filterType) return false;
    if (filterStatus !== 'all' && suggestion.status !== filterStatus) return false;
    if (filterPriority !== 'all' && suggestion.priority !== filterPriority) return false;
    if (searchTerm && !suggestion.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#4FFFB0] animate-pulse">Loading smart suggestions...</div>
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
                Smart Suggestions
              </h1>
              <p className="text-gray-400">AI-powered recommendations for improvements</p>
            </div>
            <Button
              onClick={() => { fetchSuggestions(); fetchStats(); }}
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
                  <p className="text-gray-400 text-sm">Total Suggestions</p>
                  <p className="text-3xl font-bold text-[#4FFFB0]">{stats.total_suggestions}</p>
                </div>
                <Lightbulb className="w-8 h-8 text-[#4FFFB0]/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-yellow-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.pending_suggestions}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Implemented</p>
                  <p className="text-3xl font-bold text-green-400">{stats.implemented_suggestions}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-[#00D9FF]/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Confidence</p>
                  <p className="text-3xl font-bold text-[#00D9FF]">
                    {(stats.avg_confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-[#00D9FF]/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Types</option>
              <option value="optimization">Optimization</option>
              <option value="refactor">Refactor</option>
              <option value="security">Security</option>
              <option value="feature">Feature</option>
              <option value="documentation">Documentation</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="implemented">Implemented</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search suggestions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Suggestions List */}
        <div className="space-y-4">
          {filteredSuggestions.length === 0 ? (
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-8 text-center">
              <p className="text-gray-400">No suggestions found</p>
            </Card>
          ) : (
            filteredSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6 hover:border-[#4FFFB0]/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-[#4FFFB0]/10 rounded-lg">
                      {getTypeIcon(suggestion.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-white">{suggestion.title}</h3>
                        <Badge className={getTypeColor(suggestion.type)}>
                          {suggestion.type}
                        </Badge>
                        <Badge className={getStatusColor(suggestion.status)}>
                          {suggestion.status}
                        </Badge>
                        <Badge className={getPriorityColor(suggestion.priority)}>
                          {suggestion.priority}
                        </Badge>
                        <Badge className="bg-[#00D9FF]/10 text-[#00D9FF]">
                          {(suggestion.confidence_score * 100).toFixed(0)}% confident
                        </Badge>
                      </div>

                      <p className="text-gray-300 mb-4">{suggestion.description}</p>

                      {suggestion.rationale && (
                        <div className="bg-[#00D9FF]/10 border border-[#00D9FF]/20 rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-[#00D9FF]">Rationale</span>
                          </div>
                          <p className="text-sm text-gray-300">{suggestion.rationale}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-400">Estimated Effort</p>
                          <p className="text-white font-medium">{suggestion.estimated_effort_hours}h</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Files to Modify</p>
                          <p className="text-white font-medium">{suggestion.files_to_modify.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Expected Impact</p>
                          <p className="text-green-400 font-medium text-xs">{suggestion.expected_impact}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Created</p>
                          <p className="text-white font-medium">
                            {new Date(suggestion.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {suggestion.files_to_modify.length > 0 && (
                        <div className="mb-3">
                          <p className="text-gray-400 text-sm mb-1">Files to Modify:</p>
                          <div className="flex flex-wrap gap-2">
                            {suggestion.files_to_modify.slice(0, 5).map((file, idx) => (
                              <Badge key={idx} className="bg-gray-500/10 text-gray-300 text-xs">
                                {file}
                              </Badge>
                            ))}
                            {suggestion.files_to_modify.length > 5 && (
                              <Badge className="bg-gray-500/10 text-gray-300 text-xs">
                                +{suggestion.files_to_modify.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {suggestion.code_example && (
                        <div className="bg-black/30 border border-[#4FFFB0]/20 rounded-lg p-3 mb-3">
                          <p className="text-gray-400 text-xs mb-2">Code Example:</p>
                          <pre className="text-xs text-[#4FFFB0] overflow-x-auto">
                            {suggestion.code_example.substring(0, 200)}
                            {suggestion.code_example.length > 200 && '...'}
                          </pre>
                        </div>
                      )}

                      {suggestion.potential_risks && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <p className="text-red-400 text-sm font-semibold mb-1">Potential Risks:</p>
                          <p className="text-sm text-gray-300">{suggestion.potential_risks}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {suggestion.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30"
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/20 hover:bg-red-500/10 text-red-400"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#4FFFB0]/20 hover:bg-[#4FFFB0]/10"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View Details
                    </Button>
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
