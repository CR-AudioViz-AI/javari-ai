// app/admin/learning/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - LEARNING DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 27, 2025
// Shows what Javari learns over time across all categories
// Categories: Real Estate, Law, AI, Avatar, Development, Business, Creative, etc.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { useState, useEffect } from 'react';

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
}

interface KnowledgeItem {
  id: string;
  category: string;
  topic: string;
  content: string;
  source: string;
  learned_at: string;
  confidence: number;
}

const CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '📊', color: 'purple' },
  { id: 'real_estate', name: 'Real Estate', icon: '🏠', color: 'green' },
  { id: 'law', name: 'Law & Legal', icon: '⚖️', color: 'blue' },
  { id: 'ai', name: 'AI & Technology', icon: '🤖', color: 'cyan' },
  { id: 'avatar', name: 'Avatar & Virtual', icon: '👤', color: 'pink' },
  { id: 'development', name: 'Development', icon: '💻', color: 'orange' },
  { id: 'business', name: 'Business', icon: '📈', color: 'yellow' },
  { id: 'creative', name: 'Creative', icon: '🎨', color: 'red' },
  { id: 'finance', name: 'Finance', icon: '💰', color: 'emerald' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: 'rose' },
];

export default function LearningDashboard() {
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchData();
  }, [selectedCategory, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch patterns
      const patternsRes = await fetch(`/api/learning?action=patterns&category=${selectedCategory}&range=${timeRange}`);
      const patternsData = await patternsRes.json();
      setPatterns(patternsData.patterns || []);

      // Fetch summary
      const summaryRes = await fetch(`/api/learning?action=summary&range=${timeRange}`);
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Fetch knowledge base
      const knowledgeRes = await fetch(`/api/knowledge?action=status`);
      const knowledgeData = await knowledgeRes.json();
      // Transform to knowledge items if needed
    } catch (error) {
      console.error('Failed to fetch learning data:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-purple-700/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            <div>
              <h1 className="text-2xl font-bold text-yellow-400">Javari Learning Dashboard</h1>
              <p className="text-purple-300 text-sm">What Javari learns over time</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-purple-800/50 border border-purple-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={fetchData}
              className="bg-yellow-400 text-purple-900 px-4 py-2 rounded-lg font-bold hover:bg-yellow-300 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
              <div className="text-purple-300 text-sm mb-1">Total Interactions</div>
              <div className="text-3xl font-bold text-yellow-400">{summary.total_interactions.toLocaleString()}</div>
            </div>
            <div className="bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
              <div className="text-purple-300 text-sm mb-1">Avg Satisfaction</div>
              <div className="text-3xl font-bold text-green-400">{(summary.avg_satisfaction * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
              <div className="text-purple-300 text-sm mb-1">Patterns Learned</div>
              <div className="text-3xl font-bold text-cyan-400">{patterns.length}</div>
            </div>
            <div className="bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
              <div className="text-purple-300 text-sm mb-1">Avg Response Time</div>
              <div className="text-3xl font-bold text-orange-400">{(summary.avg_response_time / 1000).toFixed(1)}s</div>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">📚 Knowledge Categories</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-yellow-400 text-purple-900 font-bold'
                    : 'bg-purple-800/50 hover:bg-purple-700/50 text-white'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Stats */}
        {summary?.top_categories && (
          <div className="mb-8 bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">📈 Category Distribution</h2>
            <div className="space-y-3">
              {summary.top_categories.map((cat, idx) => {
                const maxCount = Math.max(...summary.top_categories.map(c => c.count));
                const percentage = (cat.count / maxCount) * 100;
                const catInfo = CATEGORIES.find(c => c.id === cat.category) || { icon: '📁', name: cat.category };
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-32 flex items-center gap-2">
                      <span>{catInfo.icon}</span>
                      <span className="text-sm truncate">{catInfo.name}</span>
                    </div>
                    <div className="flex-1 bg-purple-900/50 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-end px-2 transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-purple-900 text-xs font-bold">{cat.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Learned Patterns */}
        <div className="bg-purple-800/30 rounded-xl p-6 backdrop-blur-sm border border-purple-700/30">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">🧠 Learned Patterns</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin text-4xl mb-4">🔄</div>
              <p className="text-purple-300">Loading learning data...</p>
            </div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-purple-300">No patterns learned yet in this category.</p>
              <p className="text-purple-400 text-sm mt-2">Javari learns from every interaction!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="bg-purple-900/30 rounded-lg p-4 border border-purple-700/30 hover:border-yellow-400/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-700 px-2 py-1 rounded text-xs">{pattern.pattern_type}</span>
                      <span className="text-purple-300 text-sm">{pattern.category}</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getConfidenceColor(pattern.confidence_score)}`}>
                        {(pattern.confidence_score * 100).toFixed(0)}% confidence
                      </div>
                      <div className="text-purple-400 text-xs">Seen {pattern.frequency}x</div>
                    </div>
                  </div>
                  
                  {pattern.pattern_data.query && (
                    <div className="mb-2">
                      <span className="text-purple-400 text-sm">Query: </span>
                      <span className="text-white">{pattern.pattern_data.query}</span>
                    </div>
                  )}
                  
                  {pattern.pattern_data.intent && (
                    <div className="mb-2">
                      <span className="text-purple-400 text-sm">Intent: </span>
                      <span className="text-cyan-400">{pattern.pattern_data.intent}</span>
                    </div>
                  )}
                  
                  {pattern.pattern_data.entities && pattern.pattern_data.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {pattern.pattern_data.entities.map((entity, idx) => (
                        <span key={idx} className="bg-purple-700/50 px-2 py-0.5 rounded text-xs text-purple-200">
                          {entity}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs text-purple-400 mt-3 pt-2 border-t border-purple-700/30">
                    <span>First seen: {formatDate(pattern.first_seen_at)}</span>
                    <span>Last seen: {formatDate(pattern.last_seen_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-purple-400 mt-8 py-4">
          <p>© 2025 CR AudioViz AI, LLC - Javari Learning System</p>
          <p className="text-sm mt-1">Your Story. Our Design. Her Knowledge.</p>
        </div>
      </main>
    </div>
  );
}
