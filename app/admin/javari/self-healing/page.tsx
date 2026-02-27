/**
 * Javari AI - Self-Healing Dashboard
 * Monitor self-healing operations, success rates, and history
 * 
 * Created: November 4, 2025 - 7:30 PM EST
 * Part of Phase 3: Admin Dashboard Integration
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  GitCommit,
  Rocket,
  TrendingUp,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface HealingEvent {
  id: string;
  errorType: string;
  errorMessage: string;
  diagnosis: {
    confidence: number;
    rootCause: string;
    fixStrategy: string;
  };
  fixApplied: boolean;
  fixResult?: {
    success: boolean;
    filesModified: string[];
    commitSha?: string;
    deploymentId?: string;
  };
  autoFixed: boolean;
  escalated: boolean;
  createdAt: string;
}

interface HealingStats {
  total: number;
  attempted: number;
  successful: number;
  failed: number;
  escalated: number;
  successRate: number;
}

export default function SelfHealingDashboard() {
  const [history, setHistory] = useState<HealingEvent[]>([]);
  const [stats, setStats] = useState<HealingStats>({
    total: 0,
    attempted: 0,
    successful: 0,
    failed: 0,
    escalated: 0,
    successRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      // Load healing history from database
      const response = await fetch('/api/admin/javari/self-healing/history');
      const data = await response.json();
      
      setHistory(data.history || []);
      setStats(data.stats || stats);
      setLastUpdate(new Date());
    } catch (error: unknown) {
      console.error('Failed to load healing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualCheck() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/javari/self-healing/trigger', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        await loadData();
      }
    } catch (error: unknown) {
      console.error('Failed to trigger healing check:', error);
    } finally {
      setLoading(false);
    }
  }

  const COLORS = {
    success: '#10b981',
    failed: '#ef4444',
    escalated: '#f59e0b'
  };

  const pieData = [
    { name: 'Successful', value: stats.successful, color: COLORS.success },
    { name: 'Failed', value: stats.failed, color: COLORS.failed },
    { name: 'Escalated', value: stats.escalated, color: COLORS.escalated }
  ];

  // Generate trend data from history
  const trendData = history
    .slice(-24)
    .map((event, idx) => ({
      time: new Date(event.createdAt).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      confidence: event.diagnosis.confidence,
      success: event.fixResult?.success ? 1 : 0
    }));

  if (loading && history.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading self-healing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600" />
              Javari Self-Healing Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor autonomous error detection, diagnosis, and fixes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</p>
            </div>
            <Button onClick={triggerManualCheck} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Check Now
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">All healing attempts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.successful}</div>
              <p className="text-xs text-gray-500 mt-1">Auto-fixed successfully</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-gray-500 mt-1">Fix attempts failed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Escalated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.escalated}</div>
              <p className="text-xs text-gray-500 mt-1">Needed human review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {stats.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Of attempted fixes</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Success Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Outcome Distribution</CardTitle>
              <CardDescription>Breakdown of healing attempt results</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Confidence Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence Trend</CardTitle>
              <CardDescription>AI diagnosis confidence over last 24 events</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Confidence %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Healing Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Healing Events</CardTitle>
            <CardDescription>Latest error detection and fix attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">No Healing Events Yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Javari will automatically detect and fix errors as they occur
                  </p>
                </div>
              ) : (
                history.slice(0, 10).map((event) => (
                  <div
                    key={event.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {event.fixResult?.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : event.escalated ? (
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <Badge variant={event.fixResult?.success ? 'default' : 'destructive'}>
                          {event.errorType}
                        </Badge>
                        <Badge variant="outline">
                          {event.diagnosis.confidence}% confidence
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Error:</p>
                        <p className="text-sm text-gray-600">{event.errorMessage}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-700">Root Cause:</p>
                        <p className="text-sm text-gray-600">{event.diagnosis.rootCause}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-700">Fix Strategy:</p>
                        <p className="text-sm text-gray-600">{event.diagnosis.fixStrategy}</p>
                      </div>

                      {event.fixResult && (
                        <>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Files Modified:</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {event.fixResult.filesModified.map((file, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {event.fixResult.commitSha && (
                            <div className="flex items-center gap-4 pt-2">
                              <a
                                href={`https://github.com/CR-AudioViz-AI/crav-javari/commit/${event.fixResult.commitSha}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                              >
                                <GitCommit className="w-4 h-4" />
                                View Commit
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              {event.fixResult.deploymentId && (
                                <a
                                  href={`https://vercel.com/roy-hendersons-projects-1d3d5e94/crav-javari/${event.fixResult.deploymentId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                >
                                  <Rocket className="w-4 h-4" />
                                  View Deployment
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
