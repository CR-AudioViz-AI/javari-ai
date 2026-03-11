'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Users, TrendingUp, AlertTriangle, Clock, Target, Zap, Download, Filter, RefreshCw, Award, MessageSquare } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';

/**
 * Agent performance metrics interface
 */
interface AgentMetrics {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  utilization: number;
  tasksCompleted: number;
  averageTaskTime: number;
  qualityScore: number;
  collaborationIndex: number;
  lastActivity: string;
  currentTasks: number;
  overdueItems: number;
}

/**
 * Team performance metrics interface
 */
interface TeamMetrics {
  totalAgents: number;
  activeAgents: number;
  averageUtilization: number;
  totalTasksCompleted: number;
  averageCompletionTime: number;
  teamProductivityScore: number;
  collaborationEfficiency: number;
  bottleneckCount: number;
  alertCount: number;
}

/**
 * Productivity trend data interface
 */
interface ProductivityTrend {
  timestamp: string;
  tasksCompleted: number;
  utilization: number;
  qualityScore: number;
  collaborationIndex: number;
}

/**
 * Bottleneck detection data interface
 */
interface Bottleneck {
  id: string;
  type: 'resource' | 'process' | 'skill' | 'communication';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgents: string[];
  impact: number;
  suggestion: string;
  timestamp: string;
}

/**
 * Collaboration pattern data interface
 */
interface CollaborationPattern {
  agentId: string;
  agentName: string;
  connections: Array<{
    targetId: string;
    targetName: string;
    strength: number;
    frequency: number;
    lastInteraction: string;
  }>;
}

/**
 * Performance alert interface
 */
interface PerformanceAlert {
  id: string;
  type: 'low_utilization' | 'high_workload' | 'quality_drop' | 'bottleneck' | 'deadline_risk';
  severity: 'info' | 'warning' | 'error';
  message: string;
  agentId?: string;
  timestamp: string;
  acknowledged: boolean;
}

/**
 * Filter configuration interface
 */
interface FilterConfig {
  timeRange: '1h' | '4h' | '24h' | '7d' | '30d';
  agentIds: string[];
  departments: string[];
  metrics: string[];
}

/**
 * Real-time metrics grid component
 */
const RealTimeMetricsGrid: React.FC<{ metrics: TeamMetrics; loading: boolean }> = ({ metrics, loading }) => {
  const metricsData = [
    {
      title: 'Active Agents',
      value: `${metrics.activeAgents}/${metrics.totalAgents}`,
      icon: Users,
      trend: '+2.5%',
      color: 'text-green-600'
    },
    {
      title: 'Avg Utilization',
      value: `${metrics.averageUtilization.toFixed(1)}%`,
      icon: Activity,
      trend: '+5.2%',
      color: 'text-blue-600'
    },
    {
      title: 'Tasks Completed',
      value: metrics.totalTasksCompleted.toString(),
      icon: Target,
      trend: '+8.1%',
      color: 'text-purple-600'
    },
    {
      title: 'Productivity Score',
      value: `${metrics.teamProductivityScore.toFixed(1)}/10`,
      icon: TrendingUp,
      trend: '+3.7%',
      color: 'text-orange-600'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricsData.map((metric, index) => {
        const IconComponent = metric.icon;
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className={`text-xs ${metric.color}`}>{metric.trend}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gray-50`}>
                  <IconComponent className={`h-6 w-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

/**
 * Agent utilization chart component
 */
const AgentUtilizationChart: React.FC<{ agents: AgentMetrics[]; loading: boolean }> = ({ agents, loading }) => {
  const chartData = useMemo(() => 
    agents.map(agent => ({
      name: agent.name.split(' ')[0],
      utilization: agent.utilization,
      tasks: agent.tasksCompleted,
      quality: agent.qualityScore
    }))
  , [agents]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-200 animate-pulse rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Utilization</CardTitle>
        <CardDescription>Real-time workload distribution across team members</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="utilization" fill="#3B82F6" name="Utilization %" />
            <Bar dataKey="quality" fill="#10B981" name="Quality Score" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Productivity trend analysis component
 */
const ProductivityTrendAnalysis: React.FC<{ trends: ProductivityTrend[]; loading: boolean }> = ({ trends, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productivity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-200 animate-pulse rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Trends</CardTitle>
        <CardDescription>Performance metrics over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="tasksCompleted" stroke="#8884d8" name="Tasks Completed" />
            <Line type="monotone" dataKey="utilization" stroke="#82ca9d" name="Utilization %" />
            <Line type="monotone" dataKey="qualityScore" stroke="#ffc658" name="Quality Score" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/**
 * Bottleneck detector component
 */
const BottleneckDetector: React.FC<{ bottlenecks: Bottleneck[]; loading: boolean }> = ({ bottlenecks, loading }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bottleneck Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-20 bg-gray-200 animate-pulse rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Bottleneck Detection
        </CardTitle>
        <CardDescription>Identified performance bottlenecks and optimization opportunities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bottlenecks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No bottlenecks detected</p>
          ) : (
            bottlenecks.map((bottleneck) => (
              <div key={bottleneck.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(bottleneck.severity)}>
                      {bottleneck.severity.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{bottleneck.type.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Impact: {bottleneck.impact}%
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{bottleneck.description}</p>
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-blue-900">Suggestion:</p>
                  <p className="text-sm text-blue-800">{bottleneck.suggestion}</p>
                </div>
                {bottleneck.affectedAgents.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600">
                      Affected agents: {bottleneck.affectedAgents.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Collaboration pattern map component
 */
const CollaborationPatternMap: React.FC<{ patterns: CollaborationPattern[]; loading: boolean }> = ({ patterns, loading }) => {
  const collaborationData = useMemo(() => {
    const connections: { [key: string]: number } = {};
    patterns.forEach(pattern => {
      pattern.connections.forEach(conn => {
        const key = `${pattern.agentName}-${conn.targetName}`;
        connections[key] = conn.strength;
      });
    });
    return Object.entries(connections).map(([key, strength]) => ({
      connection: key,
      strength
    }));
  }, [patterns]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collaboration Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-200 animate-pulse rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Collaboration Patterns
        </CardTitle>
        <CardDescription>Team interaction strength and frequency analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <div key={pattern.agentId} className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">{pattern.agentName}</h4>
              <div className="space-y-2">
                {pattern.connections.map((connection, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{connection.targetName}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={connection.strength} className="w-20" />
                      <span className="text-xs text-gray-500">
                        {connection.frequency}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Team optimization suggestions component
 */
const TeamOptimizationSuggestions: React.FC<{ suggestions: string[]; loading: boolean }> = ({ suggestions, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Optimization Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-12 bg-gray-200 animate-pulse rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Optimization Suggestions
        </CardTitle>
        <CardDescription>AI-powered recommendations for team performance improvement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No suggestions available</p>
          ) : (
            suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <Zap className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-800">{suggestion}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Performance alert system component
 */
const PerformanceAlertSystem: React.FC<{ alerts: PerformanceAlert[]; onAcknowledge: (alertId: string) => void }> = ({ alerts, onAcknowledge }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low_utilization': return Clock;
      case 'high_workload': return TrendingUp;
      case 'quality_drop': return AlertTriangle;
      case 'bottleneck': return Activity;
      default: return AlertTriangle;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);

  if (unacknowledgedAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {unacknowledgedAlerts.map((alert) => {
        const IconComponent = getAlertIcon(alert.type);
        return (
          <Alert key={alert.id} className={getAlertColor(alert.severity)}>
            <IconComponent className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>{alert.type.replace('_', ' ').toUpperCase()}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAcknowledge(alert.id)}
                className="h-auto p-1"
              >
                Acknowledge
              </Button>
            </AlertTitle>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
};

/**
 * Metrics filter panel component
 */
const MetricsFilterPanel: React.FC<{ 
  filter: FilterConfig;
  onFilterChange: (filter: FilterConfig) => void;
  agents: AgentMetrics[];
}> = ({ filter, onFilterChange, agents }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Time Range</label>
          <Select value={filter.timeRange} onValueChange={(value) => 
            onFilterChange({ ...filter, timeRange: value as FilterConfig['timeRange'] })
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="4h">Last 4 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Agents</label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={agent.id}
                  checked={filter.agentIds.includes(agent.id)}
                  onChange={(e) => {
                    const newAgentIds = e.target.checked
                      ? [...filter.agentIds, agent.id]
                      : filter.agentIds.filter(id => id !== agent.id);
                    onFilterChange({ ...filter, agentIds: newAgentIds });
                  }}
                />
                <label htmlFor={agent.id} className="text-sm">{agent.name}</label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Export report dialog component
 */
const ExportReportDialog: React.FC<{ 
  onExport: (format: 'pdf' | 'csv' | 'excel') => void;
  loading: boolean;
}> = ({ onExport, loading }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Performance Report</DialogTitle>
          <DialogDescription>
            Choose the format for your team performance report
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button 
            onClick={() => { onExport('pdf'); setIsOpen(false); }} 
            disabled={loading}
            className="w-full"
          >
            Export as PDF
          </Button>
          <Button 
            onClick={() => { onExport('csv'); setIsOpen(false); }} 
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            Export as CSV
          </Button>
          <Button 
            onClick={() => { onExport('excel'); setIsOpen(false); }} 
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            Export as Excel
          </Button>
        </div>
      </DialogContent>