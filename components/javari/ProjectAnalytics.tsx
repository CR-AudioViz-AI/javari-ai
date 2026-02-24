'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Code,
  FileText,
  GitBranch,
  Zap,
  DollarSign,
  Clock,
  Target,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  LineChart,
} from 'lucide-react';

interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  
  // Code Metrics
  total_files: number;
  total_lines_of_code: number;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  lines_added: number;
  lines_deleted: number;
  
  // API Metrics
  total_apis: number;
  apis_created: number;
  api_endpoints: string[];
  
  // Testing Metrics
  total_tests: number;
  tests_written: number;
  test_coverage: number;
  
  // Build Metrics
  total_builds: number;
  successful_builds: number;
  failed_builds: number;
  build_success_rate: number;
  avg_build_time: number;
  
  // Cost Metrics
  total_cost_usd: number;
  openai_cost: number;
  anthropic_cost: number;
  vercel_cost: number;
  cost_saved: number;
  
  // Time Metrics
  total_time_spent_hours: number;
  avg_session_duration: number;
  
  // Issue Metrics
  issues_identified: number;
  issues_resolved: number;
  bugs_fixed: number;
  
  // Performance Metrics
  deployment_frequency: number;
  lead_time_hours: number;
  change_failure_rate: number;
  
  // Trends (last 7 days)
  activity_trend: { date: string; files: number; lines: number }[];
  cost_trend: { date: string; cost: number }[];
  build_trend: { date: string; success: number; failed: number }[];
}

interface ProjectAnalyticsProps {
  projects?: Array<{ id: string; name: string }>;
}

export default function ProjectAnalytics({ projects = [] }: ProjectAnalyticsProps) {
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30days');

  useEffect(() => {
    if (selectedProject) {
      loadAnalytics();
    }
  }, [selectedProject, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(selectedProject !== 'all' && { project_id: selectedProject }),
        time_range: timeRange,
      });

      const response = await fetch(`/api/projects/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    change, 
    color = 'text-primary',
    suffix = '' 
  }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value.toLocaleString()}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {change >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(change)}% vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !analytics) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold">Project Analytics</h2>
            <p className="text-muted-foreground">
              Comprehensive metrics and insights for your projects
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analytics && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="code">
              <Code className="w-4 h-4 mr-2" />
              Code Metrics
            </TabsTrigger>
            <TabsTrigger value="builds">
              <Target className="w-4 h-4 mr-2" />
              Build Performance
            </TabsTrigger>
            <TabsTrigger value="costs">
              <DollarSign className="w-4 h-4 mr-2" />
              Cost Analysis
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Files"
                value={analytics.total_files}
                icon={FileText}
                color="text-blue-500"
              />
              <MetricCard
                title="Lines of Code"
                value={analytics.total_lines_of_code}
                icon={Code}
                color="text-purple-500"
              />
              <MetricCard
                title="API Endpoints"
                value={analytics.total_apis}
                icon={GitBranch}
                color="text-green-500"
              />
              <MetricCard
                title="Tests Written"
                value={analytics.total_tests}
                icon={CheckCircle}
                color="text-cyan-500"
              />
            </div>

            {/* Activity Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Build Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold">
                      {analytics.build_success_rate}%
                    </span>
                    {analytics.build_success_rate >= 90 ? (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-yellow-500" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {analytics.successful_builds} / {analytics.total_builds} builds successful
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold">
                      {analytics.test_coverage}%
                    </span>
                    {analytics.test_coverage >= 80 ? (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-orange-500" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {analytics.total_tests} tests written
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold">
                      ${analytics.total_cost_usd.toFixed(2)}
                    </span>
                    <DollarSign className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-sm text-green-600">
                    Saved: ${analytics.cost_saved.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 7 days of development activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.activity_trend.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                      <span className="text-sm font-medium">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-blue-500" />
                          {day.files} files
                        </span>
                        <span className="flex items-center gap-1">
                          <Code className="w-4 h-4 text-purple-500" />
                          {day.lines.toLocaleString()} lines
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Code Metrics Tab */}
          <TabsContent value="code" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Files Created"
                value={analytics.files_created}
                icon={FilePlus}
                color="text-green-500"
              />
              <MetricCard
                title="Files Modified"
                value={analytics.files_modified}
                icon={FileEdit}
                color="text-blue-500"
              />
              <MetricCard
                title="Files Deleted"
                value={analytics.files_deleted}
                icon={FileX}
                color="text-red-500"
              />
              <MetricCard
                title="Lines Added"
                value={analytics.lines_added}
                icon={TrendingUp}
                color="text-green-500"
              />
              <MetricCard
                title="Lines Deleted"
                value={analytics.lines_deleted}
                icon={TrendingDown}
                color="text-red-500"
              />
              <MetricCard
                title="Net Change"
                value={analytics.lines_added - analytics.lines_deleted}
                icon={Code}
                color="text-purple-500"
                suffix="lines"
              />
            </div>

            {/* API Endpoints List */}
            <Card>
              <CardHeader>
                <CardTitle>API Endpoints</CardTitle>
                <CardDescription>
                  {analytics.total_apis} endpoints created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.api_endpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded bg-accent/50">
                      <Code className="w-4 h-4 text-purple-500" />
                      <code className="text-sm">{endpoint}</code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Build Performance Tab */}
          <TabsContent value="builds" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Builds"
                value={analytics.total_builds}
                icon={Zap}
                color="text-blue-500"
              />
              <MetricCard
                title="Successful"
                value={analytics.successful_builds}
                icon={CheckCircle}
                color="text-green-500"
              />
              <MetricCard
                title="Failed"
                value={analytics.failed_builds}
                icon={XCircle}
                color="text-red-500"
              />
              <MetricCard
                title="Avg Build Time"
                value={analytics.avg_build_time}
                icon={Clock}
                color="text-purple-500"
                suffix="sec"
              />
            </div>

            {/* Build Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Build Trend</CardTitle>
                <CardDescription>Success vs failures over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.build_trend.map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <span className="text-sm w-24">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 flex gap-2">
                        <div 
                          className="bg-green-500 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                          style={{ width: `${(day.success / (day.success + day.failed)) * 100}%` }}
                        >
                          {day.success > 0 && day.success}
                        </div>
                        <div 
                          className="bg-red-500 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                          style={{ width: `${(day.failed / (day.success + day.failed)) * 100}%` }}
                        >
                          {day.failed > 0 && day.failed}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost Analysis Tab */}
          <TabsContent value="costs" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Cost"
                value={analytics.total_cost_usd}
                icon={DollarSign}
                color="text-blue-500"
                suffix="USD"
              />
              <MetricCard
                title="OpenAI"
                value={analytics.openai_cost}
                icon={DollarSign}
                color="text-green-500"
                suffix="USD"
              />
              <MetricCard
                title="Anthropic"
                value={analytics.anthropic_cost}
                icon={DollarSign}
                color="text-purple-500"
                suffix="USD"
              />
              <MetricCard
                title="Cost Saved"
                value={analytics.cost_saved}
                icon={TrendingDown}
                color="text-green-600"
                suffix="USD"
              />
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cost by Service</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">OpenAI</span>
                        <span className="text-sm font-medium">${analytics.openai_cost.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500"
                          style={{ width: `${(analytics.openai_cost / analytics.total_cost_usd) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Anthropic</span>
                        <span className="text-sm font-medium">${analytics.anthropic_cost.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500"
                          style={{ width: `${(analytics.anthropic_cost / analytics.total_cost_usd) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Vercel</span>
                        <span className="text-sm font-medium">${analytics.vercel_cost.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500"
                          style={{ width: `${(analytics.vercel_cost / analytics.total_cost_usd) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Trend</CardTitle>
                  <CardDescription>Daily spending over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.cost_trend.map((day, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-accent/50">
                        <span className="text-sm">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-sm font-medium">${day.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Import statements for missing icons
import { FilePlus, FileEdit, FileX } from 'lucide-react';
