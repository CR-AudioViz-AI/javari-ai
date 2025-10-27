'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FileText,
  FilePlus,
  FileEdit,
  FileX,
  Code,
  TestTube,
  Bug,
  Sparkles,
  RefreshCw,
  Upload,
  Settings as SettingsIcon,
  Download,
  Calendar,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

interface WorkLog {
  id: string;
  numeric_id: number;
  conversation_id?: string;
  project_id?: string;
  subproject_id?: string;
  action_type: string;
  category: string;
  description: string;
  details: {
    file_path?: string;
    lines_added?: number;
    lines_deleted?: number;
    files_affected?: string[];
    api_endpoint?: string;
    test_name?: string;
    bug_id?: string;
    [key: string]: any;
  };
  impact_level: 'minor' | 'moderate' | 'major' | 'critical';
  success: boolean;
  error_message?: string;
  execution_time_ms?: number;
  created_at: string;
}

interface WorkLogStats {
  total_logs: number;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  apis_created: number;
  tests_written: number;
  bugs_fixed: number;
  total_lines_added: number;
  total_lines_deleted: number;
  success_rate: number;
  avg_execution_time: number;
}

export default function WorkLogViewer() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [stats, setStats] = useState<WorkLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedImpact, setSelectedImpact] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'calendar'>('list');

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [selectedActionType, selectedCategory, selectedImpact, selectedProject, dateFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(selectedActionType !== 'all' && { action_type: selectedActionType }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedImpact !== 'all' && { impact_level: selectedImpact }),
        ...(selectedProject !== 'all' && { project_id: selectedProject }),
        ...(dateFilter !== 'all' && { date_filter: dateFilter }),
        limit: '100',
      });

      const response = await fetch(`/api/work/log?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data || []);
      } else {
        setError(data.error || 'Failed to load work logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams({
        ...(selectedProject !== 'all' && { project_id: selectedProject }),
        ...(dateFilter !== 'all' && { date_filter: dateFilter }),
      });

      const response = await fetch(`/api/work/log/stats?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const exportLogs = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        ...(selectedActionType !== 'all' && { action_type: selectedActionType }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        format,
      });

      const response = await fetch(`/api/work/log/export?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-logs-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export logs');
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'file_created': return <FilePlus className="w-4 h-4 text-green-500" />;
      case 'file_modified': return <FileEdit className="w-4 h-4 text-blue-500" />;
      case 'file_deleted': return <FileX className="w-4 h-4 text-red-500" />;
      case 'api_created': return <Code className="w-4 h-4 text-purple-500" />;
      case 'test_written': return <TestTube className="w-4 h-4 text-cyan-500" />;
      case 'bug_fixed': return <Bug className="w-4 h-4 text-orange-500" />;
      case 'feature_added': return <Sparkles className="w-4 h-4 text-yellow-500" />;
      case 'refactoring': return <RefreshCw className="w-4 h-4 text-indigo-500" />;
      case 'deployment': return <Upload className="w-4 h-4 text-green-600" />;
      case 'configuration': return <SettingsIcon className="w-4 h-4 text-gray-500" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-500 text-white';
      case 'major': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-white';
      case 'minor': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.description.toLowerCase().includes(query) ||
        log.action_type.toLowerCase().includes(query) ||
        log.details.file_path?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const groupLogsByDate = (logs: WorkLog[]) => {
    const grouped: { [key: string]: WorkLog[] } = {};
    logs.forEach(log => {
      const date = new Date(log.created_at).toLocaleDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    });
    return grouped;
  };

  if (loading && logs.length === 0) {
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
      {/* Header with Stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold">Work Log & Audit Trail</h2>
            <p className="text-muted-foreground">
              Complete history of all actions performed by Javari AI
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportLogs('csv')}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportLogs('json')}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Logs</span>
                </div>
                <p className="text-2xl font-bold">{stats.total_logs}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FilePlus className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Created</span>
                </div>
                <p className="text-2xl font-bold">{stats.files_created}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileEdit className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Modified</span>
                </div>
                <p className="text-2xl font-bold">{stats.files_modified}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Code className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">APIs</span>
                </div>
                <p className="text-2xl font-bold">{stats.apis_created}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Success Rate</span>
                </div>
                <p className="text-2xl font-bold">{stats.success_rate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Lines Added</span>
                </div>
                <p className="text-2xl font-bold">{stats.total_lines_added.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Action Type Filter */}
            <Select value={selectedActionType} onValueChange={setSelectedActionType}>
              <SelectTrigger>
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="file_created">File Created</SelectItem>
                <SelectItem value="file_modified">File Modified</SelectItem>
                <SelectItem value="file_deleted">File Deleted</SelectItem>
                <SelectItem value="api_created">API Created</SelectItem>
                <SelectItem value="test_written">Test Written</SelectItem>
                <SelectItem value="bug_fixed">Bug Fixed</SelectItem>
                <SelectItem value="feature_added">Feature Added</SelectItem>
                <SelectItem value="refactoring">Refactoring</SelectItem>
                <SelectItem value="deployment">Deployment</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="ui">UI/UX</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="deployment">Deployment</SelectItem>
                <SelectItem value="configuration">Configuration</SelectItem>
              </SelectContent>
            </Select>

            {/* Impact Filter */}
            <Select value={selectedImpact} onValueChange={setSelectedImpact}>
              <SelectTrigger>
                <SelectValue placeholder="Impact Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24hours">Last 24 Hours</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="list">
            <FileText className="w-4 h-4 mr-2" />
            List View
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="w-4 h-4 mr-2" />
            Timeline View
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-2 mt-4">
          {filteredLogs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No work logs found matching your filters.
              </CardContent>
            </Card>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="hover:bg-accent/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getActionIcon(log.action_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">
                            LOG-{log.numeric_id}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {log.action_type.replace('_', ' ')}
                          </Badge>
                          <Badge className={getImpactColor(log.impact_level)}>
                            {log.impact_level}
                          </Badge>
                          {log.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {log.description}
                        </p>
                        {log.details.file_path && (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.details.file_path}
                          </code>
                        )}
                        {log.details.lines_added !== undefined && (
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-green-600">
                              +{log.details.lines_added} lines
                            </span>
                            {log.details.lines_deleted !== undefined && (
                              <span className="text-red-600">
                                -{log.details.lines_deleted} lines
                              </span>
                            )}
                          </div>
                        )}
                        {log.error_message && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {log.error_message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{new Date(log.created_at).toLocaleString()}</div>
                      {log.execution_time_ms && (
                        <div className="mt-1">{log.execution_time_ms}ms</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-8">
            {Object.entries(groupLogsByDate(filteredLogs)).map(([date, dateLogs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">{date}</h3>
                  <Badge variant="outline">{dateLogs.length} actions</Badge>
                </div>
                <div className="space-y-2 pl-8 border-l-2 border-primary/20">
                  {dateLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 pb-4">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 -ml-[17px]"></div>
                      <Card className="flex-1">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {getActionIcon(log.action_type)}
                            <span className="font-medium text-sm">{log.action_type.replace('_', ' ')}</span>
                            <Badge className={getImpactColor(log.impact_level)}>
                              {log.impact_level}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{log.description}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Calendar View - Placeholder */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Calendar View</h3>
              <p className="text-sm text-muted-foreground">
                Coming soon: Interactive calendar view with daily activity heatmap
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
