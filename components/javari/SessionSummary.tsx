'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  TrendingUp,
  CheckCircle,
  FileText,
  Code,
  GitBranch,
  Zap,
  Target,
  AlertCircle,
  Star,
  Calendar,
  BarChart3,
  Activity,
  Brain,
  Sparkles,
  Download,
  RefreshCw,
} from 'lucide-react';

interface SessionData {
  session_id: string;
  conversation_id?: string;
  project_id?: string;
  project_name?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  is_active: boolean;
  
  // Accomplishments
  files_created: number;
  files_modified: number;
  files_deleted: number;
  lines_added: number;
  lines_deleted: number;
  apis_created: number;
  tests_written: number;
  bugs_fixed: number;
  features_added: number;
  
  // Quality Metrics
  success_rate: number;
  issues_encountered: number;
  issues_resolved: number;
  
  // AI Metrics
  messages_sent: number;
  tokens_used: number;
  cost_usd: number;
  model_used: string;
  
  // AI-Generated Insights
  ai_summary?: string;
  key_accomplishments?: string[];
  next_steps?: string[];
  blockers?: string[];
  recommendations?: string[];
}

interface SessionSummaryProps {
  conversationId?: string;
  projectId?: string;
  onClose?: () => void;
}

export default function SessionSummary({ conversationId, projectId, onClose }: SessionSummaryProps) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('today');

  useEffect(() => {
    loadSessions();
  }, [conversationId, projectId, timeRange]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(conversationId && { conversation_id: conversationId }),
        ...(projectId && { project_id: projectId }),
        time_range: timeRange,
      });

      const response = await fetch(`/api/sessions/summary?${params}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.data || []);
        if (data.data && data.data.length > 0) {
          setSelectedSession(data.data[0]); // Select most recent
        }
      } else {
        setError(data.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const generateAISummary = async (sessionId: string) => {
    try {
      setGenerating(true);
      const response = await fetch(`/api/sessions/${sessionId}/generate-summary`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        // Refresh sessions to get updated AI summary
        await loadSessions();
      } else {
        setError(data.error || 'Failed to generate summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const MetricCard = ({ title, value, icon: Icon, color = 'text-primary', suffix = '', trend }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {trend !== undefined && (
          <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}% vs last session
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedSession && sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
            <p className="text-muted-foreground">
              Start a conversation to track your progress and generate session summaries.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const session = selectedSession || sessions[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Session Summary</h2>
          <p className="text-muted-foreground">
            AI-powered insights and progress tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSessions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Session Selector */}
      <div className="flex items-center gap-4">
        <select
          className="px-4 py-2 border rounded-lg bg-background"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>

        {sessions.length > 1 && (
          <select
            className="flex-1 px-4 py-2 border rounded-lg bg-background"
            value={session.session_id}
            onChange={(e) => {
              const s = sessions.find(s => s.session_id === e.target.value);
              if (s) setSelectedSession(s);
            }}
          >
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {formatDate(s.started_at)} - {formatDuration(s.duration_minutes)}
                {s.is_active && ' (Active)'}
              </option>
            ))}
          </select>
        )}

        <Badge variant={session.is_active ? 'default' : 'secondary'} className="ml-auto">
          {session.is_active ? (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
              Active
            </>
          ) : (
            'Completed'
          )}
        </Badge>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="accomplishments">
            <CheckCircle className="w-4 h-4 mr-2" />
            Accomplishments
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Calendar className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Time & Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="text-2xl font-bold">{formatDuration(session.duration_minutes)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Started: {formatDate(session.started_at)}
                  {session.ended_at && <><br/>Ended: {formatDate(session.ended_at)}</>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Target className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                    <div className="text-2xl font-bold">{session.success_rate}%</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {session.issues_resolved}/{session.issues_encountered} issues resolved
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Productivity</div>
                    <div className="text-2xl font-bold">{Math.round(session.lines_added / session.duration_minutes)}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Lines per minute
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Files Created"
              value={session.files_created}
              icon={FileText}
              color="text-blue-500"
            />
            <MetricCard
              title="Files Modified"
              value={session.files_modified}
              icon={FileText}
              color="text-yellow-500"
            />
            <MetricCard
              title="Lines Added"
              value={session.lines_added}
              icon={Code}
              color="text-green-500"
            />
            <MetricCard
              title="APIs Created"
              value={session.apis_created}
              icon={GitBranch}
              color="text-purple-500"
            />
            <MetricCard
              title="Tests Written"
              value={session.tests_written}
              icon={CheckCircle}
              color="text-cyan-500"
            />
            <MetricCard
              title="Bugs Fixed"
              value={session.bugs_fixed}
              icon={AlertCircle}
              color="text-red-500"
            />
            <MetricCard
              title="Features Added"
              value={session.features_added}
              icon={Sparkles}
              color="text-pink-500"
            />
            <MetricCard
              title="Messages"
              value={session.messages_sent}
              icon={Activity}
              color="text-indigo-500"
            />
          </div>

          {/* AI Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>AI Usage</CardTitle>
              <CardDescription>Model performance and cost tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Model</div>
                  <Badge variant="outline">{session.model_used}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Tokens Used</div>
                  <div className="text-lg font-semibold">{session.tokens_used.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Cost</div>
                  <div className="text-lg font-semibold">${session.cost_usd.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Avg Cost/Message</div>
                  <div className="text-lg font-semibold">
                    ${(session.cost_usd / session.messages_sent).toFixed(4)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accomplishments Tab */}
        <TabsContent value="accomplishments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Accomplishments</CardTitle>
              <CardDescription>What you achieved in this session</CardDescription>
            </CardHeader>
            <CardContent>
              {session.key_accomplishments && session.key_accomplishments.length > 0 ? (
                <ul className="space-y-3">
                  {session.key_accomplishments.map((accomplishment, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{accomplishment}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No accomplishments tracked yet.
                  </p>
                  <Button onClick={() => generateAISummary(session.session_id)} disabled={generating}>
                    <Brain className="w-4 h-4 mr-2" />
                    {generating ? 'Generating...' : 'Generate AI Summary'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Code Changes Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Code Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files Created</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    +{session.files_created}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files Modified</span>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                    ~{session.files_modified}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Files Deleted</span>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600">
                    -{session.files_deleted}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-sm font-medium">Net Change</span>
                  <span className="font-bold">
                    {session.files_created + session.files_modified - session.files_deleted} files
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Line Changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Lines Added</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    +{session.lines_added}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Lines Deleted</span>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600">
                    -{session.lines_deleted}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-sm font-medium">Net Change</span>
                  <span className="font-bold">
                    {session.lines_added - session.lines_deleted > 0 ? '+' : ''}
                    {session.lines_added - session.lines_deleted} lines
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          {session.ai_summary ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>AI-Generated Summary</CardTitle>
                      <CardDescription>Intelligent analysis of your session</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generateAISummary(session.session_id)}
                      disabled={generating}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {session.ai_summary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {session.next_steps && session.next_steps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      Recommended Next Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3 list-decimal list-inside">
                      {session.next_steps.map((step, index) => (
                        <li key={index} className="text-muted-foreground">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {session.blockers && session.blockers.length > 0 && (
                <Card className="border-orange-200 dark:border-orange-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertCircle className="w-5 h-5" />
                      Blockers & Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {session.blockers.map((blocker, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{blocker}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {session.recommendations && session.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {session.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <Sparkles className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Generate AI Insights</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Let Javari AI analyze your session and provide intelligent insights,
                    recommendations, and next steps.
                  </p>
                  <Button 
                    onClick={() => generateAISummary(session.session_id)}
                    disabled={generating}
                    size="lg"
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    {generating ? 'Generating AI Summary...' : 'Generate AI Summary'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session Timeline</CardTitle>
              <CardDescription>Detailed activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                Timeline view coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
