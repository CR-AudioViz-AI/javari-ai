'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  X,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface KnowledgeEntry {
  id: string;
  topic: string;
  subtopic: string;
  skill_level: string;
  concept: string;
  explanation: string;
  examples: string[];
  best_practices: string[];
  common_mistakes: string[];
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  tags: string[];
  keywords: string[];
  confidence_score: number;
  times_referenced: number;
  created_at: string;
}

interface TopicStats {
  name: string;
  total: number;
  verified: number;
  unverified: number;
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [topics, setTopics] = useState<TopicStats[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, unverified: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchKnowledge();
  }, [filter, selectedTopic]);

  const fetchKnowledge = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (selectedTopic) params.set('topic', selectedTopic);
      params.set('limit', '100');

      const response = await fetch(`/api/javari/knowledge?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setTopics(data.topics || []);
        setStats(data.stats || { total: 0, verified: 0, unverified: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch knowledge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEntry = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch('/api/javari/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify' }),
      });
      if (response.ok) {
        fetchKnowledge();
      }
    } catch (error) {
      console.error('Failed to verify:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectEntry = async (id: string) => {
    if (!confirm('Are you sure you want to reject and delete this entry?')) return;
    setActionLoading(id);
    try {
      const response = await fetch('/api/javari/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      if (response.ok) {
        fetchKnowledge();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.concept.toLowerCase().includes(query) ||
      entry.explanation.toLowerCase().includes(query) ||
      entry.topic.toLowerCase().includes(query) ||
      entry.tags.some(t => t.toLowerCase().includes(query))
    );
  });

  const skillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-purple-100 text-purple-800';
      case 'expert': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage Javari's learned knowledge
          </p>
        </div>
        <Button onClick={fetchKnowledge} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.unverified}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Topics</p>
                <p className="text-2xl font-bold">{topics.length}</p>
              </div>
              <Sparkles className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'verified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('verified')}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Verified
          </Button>
          <Button
            variant={filter === 'unverified' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unverified')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Pending
          </Button>
        </div>
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Topics</option>
          {topics.map(t => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.total})
            </option>
          ))}
        </select>
      </div>

      {/* Knowledge Entries */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading knowledge...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">No knowledge entries found</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <Card key={entry.id} className={`${!entry.verified ? 'border-yellow-300 bg-yellow-50/50' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.verified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <Badge variant="outline">{entry.topic}</Badge>
                      {entry.subtopic && (
                        <Badge variant="secondary">{entry.subtopic}</Badge>
                      )}
                      <Badge className={skillLevelColor(entry.skill_level)}>
                        {entry.skill_level}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{entry.concept}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {!entry.verified && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50"
                          onClick={() => verifyEntry(entry.id)}
                          disabled={actionLoading === entry.id}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => rejectEntry(entry.id)}
                          disabled={actionLoading === entry.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      {expandedId === entry.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {entry.explanation}
                </p>
                {expandedId === entry.id && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Full Explanation</h4>
                      <p className="text-sm whitespace-pre-wrap">{entry.explanation}</p>
                    </div>
                    {entry.examples.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Examples</h4>
                        {entry.examples.map((ex, i) => (
                          <pre key={i} className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            {ex}
                          </pre>
                        ))}
                      </div>
                    )}
                    {entry.best_practices.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Best Practices</h4>
                        <ul className="text-sm list-disc list-inside">
                          {entry.best_practices.map((bp, i) => (
                            <li key={i}>{bp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <span>Referenced {entry.times_referenced} times</span>
                      <span className="mx-2">•</span>
                      <span>Confidence: {(entry.confidence_score * 100).toFixed(0)}%</span>
                      <span className="mx-2">•</span>
                      <span>Created: {new Date(entry.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
