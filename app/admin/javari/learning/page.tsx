/**
 * Javari AI - Learning Dashboard
 * Monitor learning progress, sources, and knowledge base growth
 * 
 * Created: November 4, 2025 - 7:35 PM EST
 * Part of Phase 3: Admin Dashboard Integration
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Brain, 
  BookOpen, 
  TrendingUp, 
  MessageSquare,
  Code,
  Globe,
  Search,
  Plus,
  CheckCircle2,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Learning {
  id: string;
  questionPattern: string;
  answer: string;
  confidenceScore: number;
  usageCount: number;
  successRate: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface LearningStats {
  total: number;
  bySource: Record<string, number>;
  avgConfidence: number;
  avgSuccessRate: number;
  topLearnings: Learning[];
}

const SOURCE_LABELS = {
  admin_dashboard: 'Admin Dashboard',
  conversation: 'Conversations',
  code_generation: 'Code Generation',
  web_crawl: 'Web Crawls'
};

const SOURCE_ICONS = {
  admin_dashboard: BookOpen,
  conversation: MessageSquare,
  code_generation: Code,
  web_crawl: Globe
};

const SOURCE_COLORS = {
  admin_dashboard: '#8b5cf6',
  conversation: '#3b82f6',
  code_generation: '#10b981',
  web_crawl: '#f59e0b'
};

export default function LearningDashboard() {
  const [stats, setStats] = useState<LearningStats>({
    total: 0,
    bySource: {},
    avgConfidence: 0,
    avgSuccessRate: 0,
    topLearnings: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeedForm, setShowFeedForm] = useState(false);
  const [feedForm, setFeedForm] = useState({
    topic: '',
    content: '',
    importance: 'medium' as 'low' | 'medium' | 'high'
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const response = await fetch('/api/admin/javari/feed');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load learning stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/javari/learning/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedKnowledge() {
    if (!feedForm.topic.trim() || !feedForm.content.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/admin/javari/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedForm)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFeedForm({ topic: '', content: '', importance: 'medium' });
        setShowFeedForm(false);
        await loadStats();
      }
    } catch (error) {
      console.error('Failed to feed knowledge:', error);
    } finally {
      setLoading(false);
    }
  }

  // Prepare data for charts
  const sourceData = Object.entries(stats.bySource).map(([source, count]) => ({
    source: SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source,
    count,
    color: SOURCE_COLORS[source as keyof typeof SOURCE_COLORS]
  }));

  const growthData = [
    // Mock data - in real app, fetch historical data
    { date: 'Week 1', count: stats.total * 0.2 },
    { date: 'Week 2', count: stats.total * 0.4 },
    { date: 'Week 3', count: stats.total * 0.7 },
    { date: 'Week 4', count: stats.total }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              Javari Learning Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor continuous learning and knowledge base growth
            </p>
          </div>
          <Button onClick={() => setShowFeedForm(!showFeedForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Feed Knowledge
          </Button>
        </div>

        {/* Feed Knowledge Form */}
        {showFeedForm && (
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle>Feed Knowledge to Javari</CardTitle>
              <CardDescription>
                Manually add strategic knowledge, decisions, or insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Roy's coding preferences"
                  value={feedForm.topic}
                  onChange={(e) => setFeedForm({ ...feedForm, topic: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="content">Knowledge Content</Label>
                <Textarea
                  id="content"
                  placeholder="e.g., Roy prefers TypeScript over JavaScript for all new projects. Always use strict mode."
                  rows={4}
                  value={feedForm.content}
                  onChange={(e) => setFeedForm({ ...feedForm, content: e.target.value })}
                />
              </div>

              <div>
                <Label>Importance Level</Label>
                <div className="flex gap-2 mt-2">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <Button
                      key={level}
                      variant={feedForm.importance === level ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFeedForm({ ...feedForm, importance: level })}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleFeedKnowledge} disabled={loading}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Knowledge
                </Button>
                <Button variant="outline" onClick={() => setShowFeedForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Learnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">Knowledge base entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {(stats.avgConfidence * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Knowledge reliability</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {(stats.avgSuccessRate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">When applied</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {Object.keys(stats.bySource).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active sources</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Learning Sources Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Sources</CardTitle>
              <CardDescription>Breakdown by data source</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6">
                    {sourceData.map((entry, index) => (
                      <cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Knowledge Growth */}
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Growth</CardTitle>
              <CardDescription>Total learnings over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Learnings"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Knowledge Base</CardTitle>
            <CardDescription>
              Semantic search using AI embeddings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Ask Javari a question..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 font-medium">
                  Found {searchResults.length} relevant learnings:
                </p>
                {searchResults.map((result) => {
                  const SourceIcon = SOURCE_ICONS[result.source as keyof typeof SOURCE_ICONS];
                  return (
                    <div key={result.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {SourceIcon && <SourceIcon className="w-4 h-4" />}
                        <Badge variant="outline">
                          {SOURCE_LABELS[result.source as keyof typeof SOURCE_LABELS]}
                        </Badge>
                        <Badge variant="outline">
                          {(result.confidenceScore * 100).toFixed(0)}% confidence
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Used {result.usageCount} times
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {result.questionPattern}
                      </p>
                      <p className="text-sm text-gray-600">
                        {result.answer}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Learnings */}
        <Card>
          <CardHeader>
            <CardTitle>Most Used Knowledge</CardTitle>
            <CardDescription>Top 10 most frequently accessed learnings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topLearnings.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">No Learnings Yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Start feeding knowledge or let Javari learn from conversations
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topLearnings.map((learning, idx) => {
                  const SourceIcon = SOURCE_ICONS[learning.source as keyof typeof SOURCE_ICONS];
                  return (
                    <div key={learning.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                          {SourceIcon && <SourceIcon className="w-4 h-4" />}
                          <Badge variant="outline">
                            {SOURCE_LABELS[learning.source as keyof typeof SOURCE_LABELS]}
                          </Badge>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>{learning.usageCount} uses</div>
                          <div>{(learning.successRate * 100).toFixed(0)}% success</div>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {learning.questionPattern}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {learning.answer}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
