'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  GitCompare,
  Download,
  RefreshCw,
  Clock,
  Zap,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  version: string;
  color: string;
}

interface PerformanceMetric {
  timestamp: string;
  agentId: string;
  latency: number;
  throughput: number;
  successRate: number;
  errorRate: number;
  costPerRequest: number;
  accuracyScore: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface ABTestResult {
  metricName: string;
  controlValue: number;
  variantValue: number;
  improvement: number;
  confidenceLevel: number;
  pValue: number;
  sampleSize: number;
  isSignificant: boolean;
}

interface MetricCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  metrics: string[];
  unit: string;
  format: (value: number) => string;
}

interface AgentPerformanceComparisonProps {
  agentIds: string[];
  agents: Agent[];
  performanceData: PerformanceMetric[];
  abTestResults?: ABTestResult[];
  onTimeRangeChange?: (range: string) => void;
  onMetricToggle?: (metrics: string[]) => void;
  onExport?: (format: 'csv' | 'json', data: any) => void;
  className?: string;
}

const METRIC_CATEGORIES: MetricCategory[] = [
  {
    id: 'performance',
    name: 'Performance',
    icon: Zap,
    metrics: ['latency', 'throughput'],
    unit: 'ms / req/s',
    format: (value) => `${value.toFixed(2)}`
  },
  {
    id: 'accuracy',
    name: 'Accuracy',
    icon: Target,
    metrics: ['successRate', 'errorRate', 'accuracyScore'],
    unit: '%',
    format: (value) => `${(value * 100).toFixed(1)}%`
  },
  {
    id: 'cost',
    name: 'Cost',
    icon: DollarSign,
    metrics: ['costPerRequest'],
    unit: '$',
    format: (value) => `$${value.toFixed(4)}`
  },
  {
    id: 'resources',
    name: 'Resources',
    icon: BarChart3,
    metrics: ['memoryUsage', 'cpuUsage'],
    unit: '%',
    format: (value) => `${value.toFixed(1)}%`
  }
];

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' }
];

export default function AgentPerformanceComparison({
  agentIds,
  agents,
  performanceData,
  abTestResults = [],
  onTimeRangeChange,
  onMetricToggle,
  onExport,
  className
}: AgentPerformanceComparisonProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedMetrics, setSelectedMetrics] = useState(['latency', 'successRate']);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => agentIds.includes(agent.id));
  }, [agents, agentIds]);

  const processedData = useMemo(() => {
    if (!performanceData.length) return [];

    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    }[selectedTimeRange];

    const cutoffTime = new Date(Date.now() - timeRangeMs);

    return performanceData
      .filter(d => new Date(d.timestamp) >= cutoffTime && agentIds.includes(d.agentId))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [performanceData, selectedTimeRange, agentIds]);

  const chartData = useMemo(() => {
    const dataByTime = new Map();

    processedData.forEach(metric => {
      const timeKey = new Date(metric.timestamp).toISOString().slice(0, 16); // Group by minute
      if (!dataByTime.has(timeKey)) {
        dataByTime.set(timeKey, { time: timeKey });
      }
      const entry = dataByTime.get(timeKey);
      const agent = agents.find(a => a.id === metric.agentId);
      if (agent) {
        entry[`${agent.name}_latency`] = metric.latency;
        entry[`${agent.name}_successRate`] = metric.successRate * 100;
        entry[`${agent.name}_throughput`] = metric.throughput;
        entry[`${agent.name}_costPerRequest`] = metric.costPerRequest;
      }
    });

    return Array.from(dataByTime.values());
  }, [processedData, agents]);

  const radarData = useMemo(() => {
    if (!processedData.length) return [];

    const agentAverages = new Map();

    filteredAgents.forEach(agent => {
      const agentMetrics = processedData.filter(d => d.agentId === agent.id);
      if (agentMetrics.length > 0) {
        const avg = {
          agent: agent.name,
          Performance: 100 - (agentMetrics.reduce((sum, m) => sum + m.latency, 0) / agentMetrics.length),
          Accuracy: (agentMetrics.reduce((sum, m) => sum + m.successRate, 0) / agentMetrics.length) * 100,
          Efficiency: 100 - (agentMetrics.reduce((sum, m) => sum + m.costPerRequest, 0) / agentMetrics.length) * 1000,
          Reliability: 100 - (agentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / agentMetrics.length) * 100,
          Throughput: (agentMetrics.reduce((sum, m) => sum + m.throughput, 0) / agentMetrics.length) / 10
        };
        agentAverages.set(agent.id, avg);
      }
    });

    return Array.from(agentAverages.values());
  }, [processedData, filteredAgents]);

  const summaryStats = useMemo(() => {
    if (!processedData.length) return {};

    const stats = {};
    filteredAgents.forEach(agent => {
      const agentData = processedData.filter(d => d.agentId === agent.id);
      if (agentData.length > 0) {
        stats[agent.id] = {
          avgLatency: agentData.reduce((sum, d) => sum + d.latency, 0) / agentData.length,
          avgSuccessRate: agentData.reduce((sum, d) => sum + d.successRate, 0) / agentData.length,
          avgThroughput: agentData.reduce((sum, d) => sum + d.throughput, 0) / agentData.length,
          avgCostPerRequest: agentData.reduce((sum, d) => sum + d.costPerRequest, 0) / agentData.length,
          totalRequests: agentData.reduce((sum, d) => sum + d.throughput, 0)
        };
      }
    });

    return stats;
  }, [processedData, filteredAgents]);

  const handleTimeRangeChange = (range: string) => {
    setSelectedTimeRange(range);
    onTimeRangeChange?.(range);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleExport = (format: 'csv' | 'json') => {
    const exportData = {
      agents: filteredAgents,
      metrics: processedData,
      summary: summaryStats,
      abTestResults,
      timeRange: selectedTimeRange,
      exportedAt: new Date().toISOString()
    };
    onExport?.(format, exportData);
  };

  const ComparisonCard = ({ agent, stats }: { agent: Agent; stats: any }) => (
    <Card className="relative overflow-hidden">
      <div
        className="absolute left-0 top-0 w-1 h-full"
        style={{ backgroundColor: agent.color }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{agent.name}</CardTitle>
          <Badge variant="outline">{agent.version}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Latency</p>
            <p className="text-2xl font-bold">{stats?.avgLatency?.toFixed(1) || 0}ms</p>
            <div className="flex items-center text-sm">
              {stats?.avgLatency < 100 ? (
                <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-yellow-500 mr-1" />
              )}
              <span className={stats?.avgLatency < 100 ? 'text-green-600' : 'text-yellow-600'}>
                {stats?.avgLatency < 100 ? 'Excellent' : 'Good'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-2xl font-bold">{((stats?.avgSuccessRate || 0) * 100).toFixed(1)}%</p>
            <Progress 
              value={(stats?.avgSuccessRate || 0) * 100} 
              className="h-2"
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Throughput</p>
            <p className="text-2xl font-bold">{stats?.avgThroughput?.toFixed(0) || 0}</p>
            <p className="text-xs text-muted-foreground">requests/sec</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Cost/Request</p>
            <p className="text-2xl font-bold">${(stats?.avgCostPerRequest || 0).toFixed(4)}</p>
            <div className="flex items-center text-sm">
              <DollarSign className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-600">Cost efficient</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MetricsChart = ({ data, metric, title }: { data: any[]; metric: string; title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tickFormatter={(time) => new Date(time).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(time) => new Date(time).toLocaleString()}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toFixed(2) : value,
                name.replace(/_.*/, '')
              ]}
            />
            <Legend />
            {filteredAgents.map(agent => (
              <Line
                key={agent.id}
                type="monotone"
                dataKey={`${agent.name}_${metric}`}
                stroke={agent.color}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={agent.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const ABTestResults = ({ results }: { results: ABTestResult[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          A/B Test Results
        </CardTitle>
        <CardDescription>
          Statistical significance analysis of agent performance differences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{result.metricName}</h4>
                <Badge 
                  variant={result.isSignificant ? "default" : "secondary"}
                  className={result.isSignificant ? "bg-green-500" : ""}
                >
                  {result.isSignificant ? 'Significant' : 'Not Significant'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Improvement</p>
                  <p className={`font-bold ${result.improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {result.improvement > 0 ? '+' : ''}{result.improvement.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-bold">{result.confidenceLevel.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">P-Value</p>
                  <p className="font-bold">{result.pValue.toFixed(4)}</p>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Control: {result.controlValue.toFixed(3)}</span>
                  <span>Variant: {result.variantValue.toFixed(3)}</span>
                </div>
                <Progress 
                  value={Math.abs(result.improvement) > 0 ? 50 + (result.improvement * 0.5) : 50}
                  className="h-2"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <GitCompare className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Agent Performance Comparison</h2>
          <Badge variant="outline">{filteredAgents.length} agents</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          
          <Select onValueChange={(format) => handleExport(format as 'csv' | 'json')}>
            <SelectTrigger className="w-32">
              <Download className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export CSV</SelectItem>
              <SelectItem value="json">Export JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="comparison">Radar View</TabsTrigger>
          <TabsTrigger value="abtesting">A/B Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Agent Comparison Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map(agent => (
              <ComparisonCard
                key={agent.id}
                agent={agent}
                stats={summaryStats[agent.id]}
              />
            ))}
          </div>

          {/* Quick Metrics Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>
                Real-time comparison across key performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3">Response Time Comparison</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(summaryStats).map(([id, stats]) => ({
                      name: filteredAgents.find(a => a.id === id)?.name || id,
                      latency: stats.avgLatency,
                      color: filteredAgents.find(a => a.id === id)?.color
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value.toFixed(2)}ms`, 'Avg Latency']} />
                      <Bar dataKey="latency" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Success Rate Comparison</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(summaryStats).map(([id, stats]) => ({
                      name: filteredAgents.find(a => a.id === id)?.name || id,
                      successRate: stats.avgSuccessRate * 100,
                      color: filteredAgents.find(a => a.id === id)?.color
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Success Rate']} />
                      <Bar dataKey="successRate" fill="#82ca9d" />
                      <ReferenceLine y={95} stroke="red" strokeDasharray="3 3" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6">
            <MetricsChart 
              data={chartData} 
              metric="latency" 
              title="Response Time Over Time"
            />
            <MetricsChart