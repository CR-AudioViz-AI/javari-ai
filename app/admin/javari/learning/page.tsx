// ============================================================
// JAVARI LEARNING DASHBOARD - Admin Component
// ============================================================
// Real-time monitoring of Javari's learning progress
// Created: November 11, 2025 - 3:15 PM EST
// Location: /app/admin/javari/learning/page.tsx
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  RefreshCw,
  Play,
  BarChart3
} from 'lucide-react';

interface LearningStats {
  total_docs: number;
  docs_learned: number;
  docs_pending: number;
  ai_learning_docs: number;
  owner_docs: number;
  technical_docs: number;
  business_docs: number;
  avg_confidence_score: number;
  total_usage_count: number;
  last_doc_used: string;
  queue_pending: number;
  queue_processing: number;
  queue_failed: number;
  learned_last_24h: number;
  learned_last_7d: number;
  stats_generated_at: string;
}

export default function JavariLearningDashboard() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learningResult, setLearningResult] = useState<any>(null);

  // Fetch learning statistics
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/javari/learn-from-docs', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_JAVARI_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger learning manually
  const triggerLearning = async (mode: 'immediate' | 'batch', category?: string) => {
    try {
      setIsLearning(true);
      setError(null);
      setLearningResult(null);

      const response = await fetch('/api/javari/learn-from-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_JAVARI_API_KEY}`,
        },
        body: JSON.stringify({
          mode,
          category,
          max_docs: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      setLearningResult(result);
      
      // Refresh stats after learning
      await fetchStats();
    } catch (err: any) {
      console.error('Error triggering learning:', err);
      setError(err.message);
    } finally {
      setIsLearning(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading Javari learning statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchStats} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completionPercentage = stats
    ? Math.round((stats.docs_learned / stats.total_docs) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-purple-600" />
            Javari Learning Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of Javari's knowledge acquisition
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Learning Progress</CardTitle>
          <CardDescription>
            {stats?.docs_learned} of {stats?.total_docs} documents learned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Completion</span>
                <span className="text-sm font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-1">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Learned</span>
                </div>
                <p className="text-2xl font-bold text-green-900">{stats?.docs_learned}</p>
                <p className="text-sm text-green-600">Avg confidence: {(stats?.avg_confidence_score ?? 0).toFixed(2)}</p>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 mb-1">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Pending</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">{stats?.docs_pending}</p>
                <p className="text-sm text-yellow-600">Waiting to be learned</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-medium">Usage</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{stats?.total_usage_count}</p>
                <p className="text-sm text-blue-600">Times docs were used</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Learning by Category</CardTitle>
            <CardDescription>Documents learned per category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">AI Learning</Badge>
                </div>
                <span className="font-bold">{stats?.ai_learning_docs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Owner</Badge>
                </div>
                <span className="font-bold">{stats?.owner_docs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Technical</Badge>
                </div>
                <span className="font-bold">{stats?.technical_docs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Business</Badge>
                </div>
                <span className="font-bold">{stats?.business_docs}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Queue</CardTitle>
            <CardDescription>Documents waiting to be processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="font-medium text-yellow-900">Pending</span>
                <span className="text-2xl font-bold text-yellow-900">{stats?.queue_pending}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-900">Processing</span>
                <span className="text-2xl font-bold text-blue-900">{stats?.queue_processing}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="font-medium text-red-900">Failed</span>
                <span className="text-2xl font-bold text-red-900">{stats?.queue_failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Learning Activity</CardTitle>
          <CardDescription>Documents learned in recent time periods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium">Last 24 Hours</span>
              </div>
              <p className="text-3xl font-bold text-purple-900">{stats?.learned_last_24h}</p>
              <p className="text-sm text-purple-600">documents learned</p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium">Last 7 Days</span>
              </div>
              <p className="text-3xl font-bold text-blue-900">{stats?.learned_last_7d}</p>
              <p className="text-sm text-blue-600">documents learned</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Learning Triggers */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Learning Controls</CardTitle>
          <CardDescription>Trigger learning processes manually</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => triggerLearning('immediate')}
              disabled={isLearning}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              Process Queue
            </Button>

            <Button
              onClick={() => triggerLearning('batch', 'ai-learning')}
              disabled={isLearning}
              variant="outline"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Learn AI Docs
            </Button>

            <Button
              onClick={() => triggerLearning('batch', 'owner')}
              disabled={isLearning}
              variant="outline"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Learn Owner Docs
            </Button>
          </div>

          {learningResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Last Learning Result:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>✅ Processed: {learningResult.docs_processed}</div>
                <div>❌ Failed: {learningResult.docs_failed}</div>
                <div>⏳ Queue Pending: {learningResult.queue_status.pending}</div>
                <div>🔄 Queue Processing: {learningResult.queue_status.processing}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-500">
        <p>Last updated: {stats ? new Date(stats.stats_generated_at).toLocaleString() : 'Never'}</p>
        <p className="mt-1">Statistics refresh automatically every 30 seconds</p>
      </div>
    </div>
  );
}
