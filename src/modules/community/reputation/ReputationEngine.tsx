```typescript
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Trophy, 
  TrendingUp, 
  Award, 
  Target, 
  Star, 
  Users, 
  Activity, 
  Zap,
  ChevronUp,
  ChevronDown,
  Calendar,
  Filter,
  BarChart3,
  Medal,
  Crown,
  Flame
} from 'lucide-react';

/**
 * Reputation profile interface
 */
interface ReputationProfile {
  id: string;
  user_id: string;
  total_reputation: number;
  level: number;
  experience_points: number;
  expertise_scores: Record<string, number>;
  contribution_stats: {
    posts: number;
    comments: number;
    likes_received: number;
    shares_received: number;
    helpful_votes: number;
  };
  achievements: Achievement[];
  streak_days: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

/**
 * Achievement interface
 */
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'contribution' | 'expertise' | 'social' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  criteria: Record<string, any>;
  unlocked_at?: string;
  progress?: number;
  max_progress?: number;
}

/**
 * Reputation event interface
 */
interface ReputationEvent {
  id: string;
  user_id: string;
  event_type: string;
  points_change: number;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Expertise domain interface
 */
interface ExpertiseDomain {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Leaderboard entry interface
 */
interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_reputation: number;
  level: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Reputation engine props
 */
interface ReputationEngineProps {
  userId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  className?: string;
  onReputationChange?: (reputation: number) => void;
}

/**
 * Supabase client initialization
 */
const createSupabaseClient = (url: string, key: string) => {
  return createClient(url, key);
};

/**
 * Reputation calculation utilities
 */
class ReputationCalculator {
  /**
   * Calculate reputation level from experience points
   */
  static calculateLevel(experiencePoints: number): number {
    return Math.floor(Math.sqrt(experiencePoints / 100)) + 1;
  }

  /**
   * Calculate experience points needed for next level
   */
  static experienceForNextLevel(currentLevel: number): number {
    return Math.pow(currentLevel, 2) * 100;
  }

  /**
   * Calculate expertise score for a domain
   */
  static calculateExpertiseScore(contributions: any[]): number {
    const baseScore = contributions.reduce((sum, contrib) => {
      return sum + (contrib.quality_score * contrib.impact_factor);
    }, 0);
    
    return Math.min(100, Math.max(0, baseScore));
  }

  /**
   * Calculate contribution impact score
   */
  static calculateImpactScore(contribution: any): number {
    const weights = {
      likes: 1,
      shares: 3,
      comments: 2,
      helpful_votes: 5,
      expert_endorsements: 10
    };

    return Object.entries(weights).reduce((score, [key, weight]) => {
      return score + ((contribution[key] || 0) * weight);
    }, 0);
  }
}

/**
 * Achievement system component
 */
const AchievementSystem = memo(({ 
  achievements, 
  onAchievementUnlock 
}: { 
  achievements: Achievement[];
  onAchievementUnlock?: (achievement: Achievement) => void;
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnlocked, setShowUnlocked] = useState(true);

  const filteredAchievements = useMemo(() => {
    return achievements.filter(achievement => {
      const categoryMatch = selectedCategory === 'all' || achievement.category === selectedCategory;
      const unlockedMatch = showUnlocked ? true : !achievement.unlocked_at;
      return categoryMatch && unlockedMatch;
    });
  }, [achievements, selectedCategory, showUnlocked]);

  const getRarityColor = (rarity: Achievement['rarity']) => {
    const colors = {
      common: 'text-gray-400 border-gray-400',
      rare: 'text-blue-400 border-blue-400',
      epic: 'text-purple-400 border-purple-400',
      legendary: 'text-yellow-400 border-yellow-400'
    };
    return colors[rarity];
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Achievements
        </h3>
        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm"
          >
            <option value="all">All Categories</option>
            <option value="contribution">Contribution</option>
            <option value="expertise">Expertise</option>
            <option value="social">Social</option>
            <option value="milestone">Milestone</option>
            <option value="special">Special</option>
          </select>
          <button
            onClick={() => setShowUnlocked(!showUnlocked)}
            className={`px-3 py-1 rounded-lg text-sm ${
              showUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {showUnlocked ? 'All' : 'Locked'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`
              relative p-4 border-2 rounded-lg transition-all hover:shadow-md
              ${achievement.unlocked_at ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50 opacity-60'}
              ${getRarityColor(achievement.rarity)}
            `}
          >
            {achievement.unlocked_at && (
              <div className="absolute top-2 right-2">
                <Medal className="w-5 h-5 text-yellow-500" />
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">{achievement.icon}</div>
              <div>
                <h4 className="font-semibold text-gray-800">{achievement.name}</h4>
                <p className="text-xs text-gray-600 capitalize">{achievement.rarity} • {achievement.points} pts</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
            
            {achievement.progress !== undefined && (
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{achievement.progress}/{achievement.max_progress}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, (achievement.progress / (achievement.max_progress || 1)) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            )}
            
            {achievement.unlocked_at && (
              <p className="text-xs text-green-600">
                Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Expertise tracker component
 */
const ExpertiseTracker = memo(({ 
  expertiseScores,
  domains
}: {
  expertiseScores: Record<string, number>;
  domains: ExpertiseDomain[];
}) => {
  const getExpertiseLevel = (score: number): string => {
    if (score >= 90) return 'Master';
    if (score >= 70) return 'Expert';
    if (score >= 50) return 'Advanced';
    if (score >= 30) return 'Intermediate';
    if (score >= 10) return 'Beginner';
    return 'Novice';
  };

  const getLevelColor = (score: number): string => {
    if (score >= 90) return 'text-purple-600 bg-purple-100';
    if (score >= 70) return 'text-blue-600 bg-blue-100';
    if (score >= 50) return 'text-green-600 bg-green-100';
    if (score >= 30) return 'text-yellow-600 bg-yellow-100';
    if (score >= 10) return 'text-orange-600 bg-orange-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold flex items-center gap-2 mb-6">
        <Target className="w-6 h-6 text-blue-500" />
        Expertise Domains
      </h3>

      <div className="space-y-4">
        {domains.map((domain) => {
          const score = expertiseScores[domain.id] || 0;
          const level = getExpertiseLevel(score);
          const levelColor = getLevelColor(score);

          return (
            <div key={domain.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${domain.color}20`, color: domain.color }}
                  >
                    {domain.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{domain.name}</h4>
                    <p className="text-sm text-gray-600">{domain.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${levelColor}`}>
                    {level}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">{score}/100</p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{ 
                    width: `${score}%`,
                    backgroundColor: domain.color 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/**
 * Reputation dashboard component
 */
const ReputationDashboard = memo(({ 
  profile,
  recentEvents
}: {
  profile: ReputationProfile;
  recentEvents: ReputationEvent[];
}) => {
  const currentLevelXP = ReputationCalculator.experienceForNextLevel(profile.level - 1);
  const nextLevelXP = ReputationCalculator.experienceForNextLevel(profile.level);
  const progressToNext = ((profile.experience_points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

  const stats = [
    {
      label: 'Total Reputation',
      value: profile.total_reputation.toLocaleString(),
      icon: Star,
      color: 'text-yellow-600 bg-yellow-100'
    },
    {
      label: 'Current Level',
      value: profile.level.toString(),
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      label: 'Achievements',
      value: profile.achievements.filter(a => a.unlocked_at).length.toString(),
      icon: Award,
      color: 'text-purple-600 bg-purple-100'
    },
    {
      label: 'Streak Days',
      value: profile.streak_days.toString(),
      icon: Flame,
      color: 'text-red-600 bg-red-100'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <Crown className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Reputation Dashboard</h2>
          <p className="text-gray-600">Level {profile.level} • {profile.experience_points.toLocaleString()} XP</p>
        </div>
      </div>

      {/* Progress to next level */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress to Level {profile.level + 1}</span>
          <span>{Math.round(progressToNext)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressToNext))}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {(nextLevelXP - profile.experience_points).toLocaleString()} XP to next level
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="text-center p-4 border rounded-lg">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${stat.color} mb-2`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentEvents.slice(0, 10).map((event) => (
            <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-800">{event.description}</p>
                <p className="text-xs text-gray-500">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
              <div className={`flex items-center gap-1 ${
                event.points_change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {event.points_change > 0 ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {Math.abs(event.points_change)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * Leaderboard component
 */
const LeaderboardView = memo(({ 
  entries,
  currentUserId,
  timeframe,
  onTimeframeChange
}: {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time';
  onTimeframeChange: (timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time') => void;
}) => {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-500" />;
    return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
  };

  const getTrendIcon = (trend: LeaderboardEntry['trend']) => {
    if (trend === 'up') return <ChevronUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <ChevronDown className="w-4 h-4 text-red-500" />;
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-green-500" />
          Leaderboard
        </h3>
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange(e.target.value as any)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="all-time">All Time</option>
        </select>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.user_id}
            className={`
              flex items-center gap-4 p-4 rounded-lg border-2 transition-all
              ${entry.user_id === currentUserId 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center justify-center w-12">
              {getRankIcon(entry.rank)}
            </div>

            <div className="flex items-center gap-3 flex-1">
              {entry.avatar_url && (
                <img
                  src={entry.avatar_url}
                  alt={entry.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <h4 className="font-semibold text-gray-800">{entry.username}</h4>
                <p className="text-sm text-gray-600">Level {entry.level}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-lg font-bold text-gray-800">
                {entry.total_reputation.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                {getTrendIcon(entry.trend)}
                <span className="text-sm text-gray-600">pts</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Main reputation engine component
 */
const ReputationEngine: React.FC<ReputationEngineProps> = ({
  userId,
  supabaseUrl,
  supabaseAnonKey,
  className = '',
  onReputationChange
}) => {
  const [supabase] = useState(() => createSupabaseClient(supabaseUrl, supabaseAnonKey));
  const [profile, setProfile] = useState<ReputationProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentEvents, setRecentEvents] = useState<ReputationEvent[]>([]);
  const [domains, setDomains] = useState<ExpertiseDomain[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'all-time'>('all-time');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'achievements' | 'expertise' | 'leaderboard'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load user reputation profile
   */
  const loadProfile = useCallback(async () => {
    if (!userId) return;