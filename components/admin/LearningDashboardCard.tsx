// components/admin/LearningDashboardCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - EXPANDABLE LEARNING DASHBOARD CARD
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 27, 2025
// 
// Shows a compact card on the admin dashboard that expands into a full
// learning dashboard when clicked. Categories: Real Estate, Law, AI, Avatar, etc.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Brain, X, ChevronRight, TrendingUp, BookOpen, 
  Lightbulb, Target, Clock, BarChart3, RefreshCw,
  Home, Scale, Bot, User, Code, Briefcase, Palette,
  DollarSign, Heart, Search, Filter, Calendar,
  ArrowUpRight, ArrowDownRight, Minus, Maximize2, Minimize2
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LearningPattern {
  id: string;
  category: string;
  pattern_type: string;
  pattern_data: {
    query?: string;
    intent?: string;
    entities?: string[];
    successful_response?: string;
    feedback_score?: number;
    topic?: string;
  };
  frequency: number;
  confidence_score: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface LearningSummary {
  total_interactions: number;
  avg_satisfaction: number;
  top_categories: { category: string; count: number }[];
  avg_response_time: number;
  patterns_learned: number;
  knowledge_items: number;
}

interface CategoryData {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  recentPatterns: LearningPattern[];
  topTopics: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  real_estate: { 
    name: 'Real Estate', 
    icon: <Home className="w-5 h-5" />, 
    color: 'text-green-400',
    bgColor: 'bg-green-500/10'
  },
  law: { 
    name: 'Law & Legal', 
    icon: <Scale className="w-5 h-5" />, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  ai: { 
    name: 'AI & Technology', 
    icon: <Bot className="w-5 h-5" />, 
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10'
  },
  avatar: { 
    name: 'Avatar & Virtual', 
    icon: <User className="w-5 h-5" />, 
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10'
  },
  development: { 
    name: 'Development', 
    icon: <Code className="w-5 h-5" />, 
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  },
  business: { 
    name: 'Business', 
    icon: <Briefcase className="w-5 h-5" />, 
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10'
  },
  creative: { 
    name: 'Creative', 
    icon: <Palette className="w-5 h-5" />, 
    color: 'text-red-400',
    bgColor: 'bg-red-500/10'
  },
  finance: { 
    name: 'Finance', 
    icon: <DollarSign className="w-5 h-5" />, 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10'
  },
  healthcare: { 
    name: 'Healthcare', 
    icon: <Heart className="w-5 h-5" />, 
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10'
  },
  general: { 
    name: 'General', 
    icon: <BookOpen className="w-5 h-5" />, 
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10'
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface LearningDashboardCardProps {
  className?: string;
}

export default function LearningDashboardCard({ className = '' }: LearningDashboardCardProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [searchQuery, setSearchQuery] = useState('');

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Fetch summary
      const summaryRes = await fetch(`/api/learning?action=summary&range=${timeRange}`);
      const summaryData = await summaryRes.json();
      
      // Fetch patterns
      const patternsRes = await fetch(`/api/learning?action=patterns&range=${timeRange}`);
      const patternsData = await patternsRes.json();
      
      setSummary({
        total_interactions: summaryData.total_interactions || 0,
        avg_satisfaction: summaryData.avg_satisfaction || 0,
        top_categories: summaryData.top_categories || [],
        avg_response_time: summaryData.avg_response_time || 0,
        patterns_learned: patternsData.patterns?.length || 0,
        knowledge_items: summaryData.knowledge_items || 0,
      });
      
      setPatterns(patternsData.patterns || []);
      
      // Process categories
      const categoryMap: Record<string, CategoryData> = {};
      
      (summaryData.top_categories || []).forEach((cat: { category: string; count: number }) => {
        const config = CATEGORY_CONFIG[cat.category] || CATEGORY_CONFIG.general;
        categoryMap[cat.category] = {
          id: cat.category,
          name: config.name,
          icon: config.icon,
          color: config.color,
          bgColor: config.bgColor,
          count: cat.count,
          trend: 'stable',
          trendValue: 0,
          recentPatterns: [],
          topTopics: [],
        };
      });
      
      // Add patterns to categories
      (patternsData.patterns || []).forEach((pattern: LearningPattern) => {
        const catId = pattern.category || 'general';
        if (!categoryMap[catId]) {
          const config = CATEGORY_CONFIG[catId] || CATEGORY_CONFIG.general;
          categoryMap[catId] = {
            id: catId,
            name: config.name,
            icon: config.icon,
            color: config.color,
            bgColor: config.bgColor,
            count: 0,
            trend: 'stable',
            trendValue: 0,
            recentPatterns: [],
            topTopics: [],
          };
        }
        categoryMap[catId].recentPatterns.push(pattern);
        if (pattern.pattern_data.topic) {
          categoryMap[catId].topTopics.push(pattern.pattern_data.topic);
        }
      });
      
      setCategories(Object.values(categoryMap).sort((a, b) => b.count - a.count));
      
    } catch (error) {
      console.error('Failed to fetch learning data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400 bg-green-500/20';
    if (score >= 0.6) return 'text-yellow-400 bg-yellow-500/20';
    if (score >= 0.4) return 'text-orange-400 bg-orange-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <ArrowUpRight className="w-4 h-4 text-green-400" />;
      case 'down': return <ArrowDownRight className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredPatterns = patterns.filter(p => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.pattern_data.query?.toLowerCase().includes(query) ||
        p.pattern_data.intent?.toLowerCase().includes(query) ||
        p.pattern_data.topic?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT CARD VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        className={`p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 cursor-pointer 
                    hover:border-purple-400/50 hover:bg-purple-500/20 transition-all group ${className}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Learning Dashboard</h3>
              <p className="text-xs text-gray-400">What Javari learns over time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors" />
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-purple-400">
                  {formatNumber(summary?.total_interactions || 0)}
                </div>
                <div className="text-xs text-gray-400">Interactions</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-cyan-400">
                  {summary?.patterns_learned || 0}
                </div>
                <div className="text-xs text-gray-400">Patterns</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-400">
                  {categories.length}
                </div>
                <div className="text-xs text-gray-400">Categories</div>
              </div>
            </div>

            {/* Top Categories Preview */}
            <div className="flex flex-wrap gap-1">
              {categories.slice(0, 4).map((cat) => (
                <span 
                  key={cat.id}
                  className={`text-xs px-2 py-1 rounded-full ${cat.bgColor} ${cat.color}`}
                >
                  {cat.name}: {cat.count}
                </span>
              ))}
              {categories.length > 4 && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                  +{categories.length - 4} more
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED FULL DASHBOARD VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm overflow-auto">
      <div className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Brain className="w-8 h-8 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Javari Learning Dashboard</h1>
                  <p className="text-gray-400">Real-time insights into what Javari learns</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Time Range Selector */}
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
                
                {/* Refresh Button */}
                <button
                  onClick={() => fetchData()}
                  disabled={refreshing}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                
                {/* Close Button */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 bg-gray-800 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Target className="w-4 h-4" />
                <span className="text-xs">Total Interactions</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatNumber(summary?.total_interactions || 0)}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Lightbulb className="w-4 h-4" />
                <span className="text-xs">Patterns Learned</span>
              </div>
              <div className="text-2xl font-bold text-cyan-400">
                {summary?.patterns_learned || 0}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs">Knowledge Items</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {formatNumber(summary?.knowledge_items || 0)}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Satisfaction</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {((summary?.avg_satisfaction || 0) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Avg Response</span>
              </div>
              <div className="text-2xl font-bold text-orange-400">
                {((summary?.avg_response_time || 0) / 1000).toFixed(1)}s
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs">Categories</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {categories.length}
              </div>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-400" />
              Knowledge Categories
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  selectedCategory === null
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-white">All</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">{patterns.length}</div>
                <div className="text-xs text-gray-400">patterns</div>
              </button>
              
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    selectedCategory === cat.id
                      ? `border-current ${cat.color} ${cat.bgColor}`
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cat.color}>{cat.icon}</span>
                    <span className="font-medium text-white text-sm">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${cat.color}`}>{cat.count}</span>
                    {getTrendIcon(cat.trend)}
                  </div>
                  <div className="text-xs text-gray-400">{cat.recentPatterns.length} patterns</div>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patterns, topics, intents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Learned Patterns List */}
          <div className="bg-gray-800/30 rounded-xl border border-gray-700/50">
            <div className="p-4 border-b border-gray-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Learned Patterns
                <span className="text-sm font-normal text-gray-400">
                  ({filteredPatterns.length} {selectedCategory ? `in ${CATEGORY_CONFIG[selectedCategory]?.name || selectedCategory}` : 'total'})
                </span>
              </h2>
            </div>
            
            <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
              {filteredPatterns.length === 0 ? (
                <div className="p-12 text-center">
                  <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No patterns found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? 'Try a different search term' : 'Javari is still learning!'}
                  </p>
                </div>
              ) : (
                filteredPatterns.map((pattern) => {
                  const catConfig = CATEGORY_CONFIG[pattern.category] || CATEGORY_CONFIG.general;
                  return (
                    <div 
                      key={pattern.id}
                      className="p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${catConfig.bgColor} ${catConfig.color}`}>
                              {catConfig.icon}
                              {catConfig.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                              {pattern.pattern_type}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(pattern.confidence_score)}`}>
                              {(pattern.confidence_score * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          
                          {pattern.pattern_data.query && (
                            <p className="text-white mb-1">
                              <span className="text-gray-400 text-sm">Query: </span>
                              {pattern.pattern_data.query}
                            </p>
                          )}
                          
                          {pattern.pattern_data.intent && (
                            <p className="text-cyan-400 text-sm mb-1">
                              <span className="text-gray-400">Intent: </span>
                              {pattern.pattern_data.intent}
                            </p>
                          )}
                          
                          {pattern.pattern_data.entities && pattern.pattern_data.entities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {pattern.pattern_data.entities.map((entity, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                                  {entity}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium text-white">
                            {pattern.frequency}x
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(pattern.last_seen_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>© 2025 CR AudioViz AI, LLC - Javari Learning System</p>
            <p className="mt-1">Your Story. Our Design. Her Knowledge.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
