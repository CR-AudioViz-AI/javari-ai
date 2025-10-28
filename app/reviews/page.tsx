'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Filter,
  Search,
  Shield,
  Zap,
  TrendingUp
} from 'lucide-react';

interface CodeReview {
  id: string;
  file_path: string;
  change_type: 'created' | 'modified' | 'deleted';
  code_diff?: string;
  complexity_score: number;
  potential_issues: string[];
  security_concerns: string[];
  performance_concerns: string[];
  suggestions: string[];
  status: 'pending' | 'in_progress' | 'approved' | 'needs_changes';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  reviewed_at?: string;
}

interface ReviewStats {
  total_reviews: number;
  pending_reviews: number;
  approved_reviews: number;
  needs_changes: number;
  avg_complexity: number;
  total_security_concerns: number;
  total_performance_concerns: number;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<CodeReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, []);

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/review');
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/review/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'needs_changes':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'pending':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
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

  const getComplexityColor = (score: number) => {
    if (score >= 75) return 'text-red-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  const filteredReviews = reviews.filter(review => {
    if (filterStatus !== 'all' && review.status !== filterStatus) return false;
    if (filterPriority !== 'all' && review.priority !== filterPriority) return false;
    if (searchTerm && !review.file_path.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#4FFFB0] animate-pulse">Loading code reviews...</div>
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
                Code Review Queue
              </h1>
              <p className="text-gray-400">AI-powered code analysis and review suggestions</p>
            </div>
            <Button
              onClick={() => { fetchReviews(); fetchStats(); }}
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
                  <p className="text-gray-400 text-sm">Total Reviews</p>
                  <p className="text-3xl font-bold text-[#4FFFB0]">{stats.total_reviews}</p>
                </div>
                <Eye className="w-8 h-8 text-[#4FFFB0]/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-yellow-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.pending_reviews}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-red-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Security Issues</p>
                  <p className="text-3xl font-bold text-red-400">{stats.total_security_concerns}</p>
                </div>
                <Shield className="w-8 h-8 text-red-400/30" />
              </div>
            </Card>

            <Card className="bg-[#1A1A2E]/50 border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Approved</p>
                  <p className="text-3xl font-bold text-green-400">{stats.approved_reviews}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/30" />
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg px-4 py-2 text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="needs_changes">Needs Changes</option>
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
                placeholder="Search file paths..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A1A2E] border border-[#4FFFB0]/20 rounded-lg pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <Card className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-8 text-center">
              <p className="text-gray-400">No code reviews found</p>
            </Card>
          ) : (
            filteredReviews.map((review) => (
              <Card key={review.id} className="bg-[#1A1A2E]/50 border-[#4FFFB0]/20 p-6 hover:border-[#4FFFB0]/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-[#4FFFB0]/10 rounded-lg">
                      <FileCode className="w-5 h-5 text-[#4FFFB0]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-white font-mono">{review.file_path}</h3>
                        <Badge className={getStatusColor(review.status)}>
                          {review.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(review.priority)}>
                          {review.priority}
                        </Badge>
                        <Badge className="bg-gray-500/10 text-gray-300">
                          {review.change_type}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-400">Complexity</p>
                          <p className={`text-xl font-bold ${getComplexityColor(review.complexity_score)}`}>
                            {review.complexity_score}/100
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Potential Issues</p>
                          <p className="text-white font-medium">{review.potential_issues.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Security Concerns</p>
                          <p className="text-red-400 font-medium">{review.security_concerns.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Performance</p>
                          <p className="text-yellow-400 font-medium">{review.performance_concerns.length}</p>
                        </div>
                      </div>

                      {review.security_concerns.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-semibold text-red-400">Security Concerns</span>
                          </div>
                          <ul className="space-y-1">
                            {review.security_concerns.map((concern, idx) => (
                              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-red-400 mt-1">•</span>
                                <span>{concern}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {review.potential_issues.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm font-semibold text-yellow-400">Potential Issues</span>
                          </div>
                          <ul className="space-y-1">
                            {review.potential_issues.slice(0, 3).map((issue, idx) => (
                              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-yellow-400 mt-1">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                            {review.potential_issues.length > 3 && (
                              <li className="text-sm text-gray-400">
                                +{review.potential_issues.length - 3} more issues
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {review.suggestions.length > 0 && (
                        <div className="bg-[#00D9FF]/10 border border-[#00D9FF]/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-[#00D9FF]" />
                            <span className="text-sm font-semibold text-[#00D9FF]">Suggestions</span>
                          </div>
                          <ul className="space-y-1">
                            {review.suggestions.slice(0, 3).map((suggestion, idx) => (
                              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-[#00D9FF] mt-1">•</span>
                                <span>{suggestion}</span>
                              </li>
                            ))}
                            {review.suggestions.length > 3 && (
                              <li className="text-sm text-gray-400">
                                +{review.suggestions.length - 3} more suggestions
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {review.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30"
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/20 hover:bg-red-500/10 text-red-400"
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" />
                          Request Changes
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
