```typescript
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Award, 
  Target, 
  Clock, 
  Star, 
  ThumbsUp,
  MessageCircle,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

/**
 * User reputation score and metrics interface
 */
interface UserReputation {
  userId: string;
  username: string;
  avatar?: string;
  totalScore: number;
  level: number;
  badges: ReputationBadge[];
  contributions: ContributionMetrics;
  validationScore: number;
  communityRank: number;
  scoreHistory: ScoreHistoryPoint[];
  lastUpdated: Date;
}

/**
 * Reputation badge interface
 */
interface ReputationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
  category: 'contribution' | 'validation' | 'community' | 'achievement';
}

/**
 * User contribution metrics interface
 */
interface ContributionMetrics {
  postsCreated: number;
  commentsPosted: number;
  upvotesReceived: number;
  downvotesReceived: number;
  helpfulMarks: number;
  questionsAnswered: number;
  solutionsProvided: number;
  communityEvents: number;
}

/**
 * Score history point interface
 */
interface ScoreHistoryPoint {
  timestamp: Date;
  score: number;
  change: number;
  reason: string;
  category: 'contribution' | 'validation' | 'penalty' | 'bonus';
}

/**
 * Peer validation request interface
 */
interface ValidationRequest {
  id: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'answer';
  requesterId: string;
  validatorId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  votes: ValidationVote[];
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Validation vote interface
 */
interface ValidationVote {
  userId: string;
  vote: 'approve' | 'reject';
  reason?: string;
  timestamp: Date;
}

/**
 * Reputation trends data interface
 */
interface ReputationTrends {
  period: 'day' | 'week' | 'month' | 'year';
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  topContributors: UserReputation[];
  trendingBadges: ReputationBadge[];
  communityGrowth: number;
}

/**
 * Component props interfaces
 */
interface ReputationScoringModuleProps {
  userId?: string;
  showLeaderboard?: boolean;
  showTrends?: boolean;
  className?: string;
}

interface ReputationDashboardProps {
  reputation: UserReputation;
  onRefresh: () => void;
  isLoading: boolean;
}

interface ReputationScoreCardProps {
  reputation: UserReputation;
  showDetails?: boolean;
  onClick?: () => void;
}

interface ContributionAnalyzerProps {
  metrics: ContributionMetrics;
  period: 'week' | 'month' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
}

interface PeerValidationPanelProps {
  requests: ValidationRequest[];
  onValidate: (requestId: string, vote: 'approve' | 'reject', reason?: string) => void;
  canValidate: boolean;
}

interface ReputationBadgesProps {
  badges: ReputationBadge[];
  showUnlocked?: boolean;
  showProgress?: boolean;
}

interface ScoreHistoryChartProps {
  history: ScoreHistoryPoint[];
  period: 'week' | 'month' | 'year';
  height?: number;
}

interface ReputationLeaderboardProps {
  users: UserReputation[];
  currentUserId?: string;
  period: 'week' | 'month' | 'all';
  onPeriodChange: (period: 'week' | 'month' | 'all') => void;
}

interface ValidationRequestsProps {
  requests: ValidationRequest[];
  onCreateRequest: (contentId: string, contentType: string) => void;
  onCancelRequest: (requestId: string) => void;
}

interface ReputationTrendsProps {
  trends: ReputationTrends;
  onPeriodChange: (period: 'day' | 'week' | 'month' | 'year') => void;
}

interface ContributionMetricsProps {
  metrics: ContributionMetrics;
  comparison?: ContributionMetrics;
  showComparison?: boolean;
}

/**
 * Custom hook for reputation data management
 */
const useReputationData = (userId?: string) => {
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [validationRequests, setValidationRequests] = useState<ValidationRequest[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserReputation[]>([]);
  const [trends, setTrends] = useState<ReputationTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  /**
   * Load user reputation data
   */
  const loadReputationData = useCallback(async (targetUserId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const userIdToLoad = targetUserId || userId;
      if (!userIdToLoad) {
        throw new Error('User ID is required');
      }

      // Load reputation data
      const { data: reputationData, error: reputationError } = await supabase
        .from('user_reputation')
        .select('*')
        .eq('user_id', userIdToLoad)
        .single();

      if (reputationError) throw reputationError;

      // Load badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('user_badges')
        .select('*, badges(*)')
        .eq('user_id', userIdToLoad);

      if (badgesError) throw badgesError;

      // Load contribution metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('contribution_metrics')
        .select('*')
        .eq('user_id', userIdToLoad)
        .single();

      if (metricsError) throw metricsError;

      // Load score history
      const { data: historyData, error: historyError } = await supabase
        .from('reputation_history')
        .select('*')
        .eq('user_id', userIdToLoad)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (historyError) throw historyError;

      // Construct reputation object
      const reputationObj: UserReputation = {
        userId: reputationData.user_id,
        username: reputationData.username,
        avatar: reputationData.avatar,
        totalScore: reputationData.total_score,
        level: Math.floor(reputationData.total_score / 1000) + 1,
        badges: badgesData.map(badge => ({
          id: badge.badges.id,
          name: badge.badges.name,
          description: badge.badges.description,
          icon: badge.badges.icon,
          rarity: badge.badges.rarity,
          unlockedAt: new Date(badge.unlocked_at),
          category: badge.badges.category
        })),
        contributions: metricsData,
        validationScore: reputationData.validation_score,
        communityRank: reputationData.community_rank,
        scoreHistory: historyData.map(point => ({
          timestamp: new Date(point.timestamp),
          score: point.score,
          change: point.change,
          reason: point.reason,
          category: point.category
        })),
        lastUpdated: new Date(reputationData.updated_at)
      };

      setReputation(reputationObj);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reputation data');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  /**
   * Load validation requests
   */
  const loadValidationRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('validation_requests')
        .select('*, validation_votes(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requests: ValidationRequest[] = data.map(request => ({
        id: request.id,
        contentId: request.content_id,
        contentType: request.content_type,
        requesterId: request.requester_id,
        validatorId: request.validator_id,
        status: request.status,
        votes: request.validation_votes.map((vote: any) => ({
          userId: vote.user_id,
          vote: vote.vote,
          reason: vote.reason,
          timestamp: new Date(vote.created_at)
        })),
        createdAt: new Date(request.created_at),
        expiresAt: new Date(request.expires_at)
      }));

      setValidationRequests(requests);
    } catch (err) {
      console.error('Failed to load validation requests:', err);
    }
  }, [supabase]);

  /**
   * Load leaderboard data
   */
  const loadLeaderboard = useCallback(async (period: 'week' | 'month' | 'all' = 'month') => {
    try {
      let query = supabase
        .from('user_reputation')
        .select('*')
        .order('total_score', { ascending: false })
        .limit(50);

      if (period !== 'all') {
        const startDate = new Date();
        if (period === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        }
        query = query.gte('updated_at', startDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const leaderboardUsers: UserReputation[] = data.map((user, index) => ({
        userId: user.user_id,
        username: user.username,
        avatar: user.avatar,
        totalScore: user.total_score,
        level: Math.floor(user.total_score / 1000) + 1,
        badges: [],
        contributions: {} as ContributionMetrics,
        validationScore: user.validation_score,
        communityRank: index + 1,
        scoreHistory: [],
        lastUpdated: new Date(user.updated_at)
      }));

      setLeaderboard(leaderboardUsers);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  }, [supabase]);

  /**
   * Load trends data
   */
  const loadTrends = useCallback(async (period: 'day' | 'week' | 'month' | 'year' = 'month') => {
    try {
      const { data, error } = await supabase
        .from('reputation_trends')
        .select('*')
        .eq('period', period)
        .single();

      if (error) throw error;

      const trendsData: ReputationTrends = {
        period,
        averageScore: data.average_score,
        scoreDistribution: data.score_distribution,
        topContributors: [],
        trendingBadges: [],
        communityGrowth: data.community_growth
      };

      setTrends(trendsData);
    } catch (err) {
      console.error('Failed to load trends:', err);
    }
  }, [supabase]);

  /**
   * Setup realtime subscriptions
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('reputation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_reputation',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadReputationData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'validation_requests'
        },
        () => {
          loadValidationRequests();
        }
      )
      .subscribe();

    setRealtimeChannel(channel);

    return () => {
      channel.unsubscribe();
    };
  }, [userId, supabase, loadReputationData, loadValidationRequests]);

  /**
   * Initialize data loading
   */
  useEffect(() => {
    if (userId) {
      loadReputationData();
      loadValidationRequests();
      loadLeaderboard();
      loadTrends();
    }
  }, [userId, loadReputationData, loadValidationRequests, loadLeaderboard, loadTrends]);

  /**
   * Submit validation vote
   */
  const submitValidationVote = useCallback(async (
    requestId: string, 
    vote: 'approve' | 'reject', 
    reason?: string
  ) => {
    try {
      const { error } = await supabase
        .from('validation_votes')
        .insert({
          request_id: requestId,
          user_id: userId,
          vote,
          reason
        });

      if (error) throw error;
      await loadValidationRequests();
    } catch (err) {
      console.error('Failed to submit validation vote:', err);
      throw err;
    }
  }, [userId, supabase, loadValidationRequests]);

  /**
   * Create validation request
   */
  const createValidationRequest = useCallback(async (
    contentId: string, 
    contentType: 'post' | 'comment' | 'answer'
  ) => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('validation_requests')
        .insert({
          content_id: contentId,
          content_type: contentType,
          requester_id: userId,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;
      await loadValidationRequests();
    } catch (err) {
      console.error('Failed to create validation request:', err);
      throw err;
    }
  }, [userId, supabase, loadValidationRequests]);

  return {
    reputation,
    validationRequests,
    leaderboard,
    trends,
    loading,
    error,
    loadReputationData,
    loadLeaderboard,
    loadTrends,
    submitValidationVote,
    createValidationRequest
  };
};

/**
 * Reputation Dashboard Component
 */
const ReputationDashboard: React.FC<ReputationDashboardProps> = ({
  reputation,
  onRefresh,
  isLoading
}) => {
  if (!reputation) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Reputation Dashboard</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Trophy className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Score</p>
              <p className="text-2xl font-bold text-gray-900">{reputation.totalScore.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Level</p>
              <p className="text-2xl font-bold text-gray-900">{reputation.level}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Community Rank</p>
              <p className="text-2xl font-bold text-gray-900">#{reputation.communityRank}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
        <span>Last updated: {reputation.lastUpdated.toLocaleString()}</span>
        <span>{reputation.badges.length} badges earned</span>
      </div>
    </div>
  );
};

/**
 * Reputation Score Card Component
 */
const ReputationScoreCard: React.FC<ReputationScoreCardProps> = ({
  reputation,
  showDetails = true,
  onClick
}) => {
  const progressToNextLevel = (reputation.totalScore % 1000) / 1000 * 100;

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {reputation.avatar && (
          <img
            src={reputation.avatar}
            alt={reputation.username}
            className="w-12 h-12 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{reputation.username}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-bold text-blue-600">{reputation.totalScore.toLocaleString()}</span>
            <span className="text-sm text-gray-500">Level {reputation.level}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-yellow-600">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">{reputation.validationScore}</span>
          </div>
          <p className="text-xs text-gray-500">Rank #{reputation.communityRank}</p>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress to Level {reputation.level + 1}</span>
            <span>{Math.round(progressToNextLevel)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressToNextLevel}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Contribution Analyzer Component
 */
const ContributionAnalyzer: React.FC<ContributionAnalyzerProps> = ({
  metrics,
  period,
  onPeriodChange
}) => {
  const contributionData = [
    { label: 'Posts Created', value: metrics.postsCreated, icon: MessageCircle, color: 'text-blue-600' },
    { label: 'Comments Posted', value: metrics.commentsPosted, icon: MessageCircle, color: 'text-green-600' },
    { label: 'Upvotes Received', value: metrics.upvotesReceived, icon: ThumbsUp, color: 'text-indigo-600' },
    { label: 'Helpful Marks', value: metrics.helpfulMarks, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Questions Answered', value: metrics.questionsAnswered, icon: Target, color: 'text-purple-600' },
    { label: 'Solutions Provided', value: metrics.solutionsProvided, icon: Award, color: 'text-orange-600' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Contribution Analysis</h3>