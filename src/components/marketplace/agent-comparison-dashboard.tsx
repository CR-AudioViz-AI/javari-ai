```tsx
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MetricChart } from '@/components/ui/metric-chart';
import { useAgentComparison } from '@/hooks/use-agent-comparison';
import { formatMetrics } from '@/utils/format-metrics';
import type { Agent, AgentMetrics, PricingTier, AgentCapability } from '@/types/marketplace';
import {
  Download,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  DollarSign,
  Settings,
  Filter,
  Plus,
  X,
} from 'lucide-react';

interface AgentComparisonDashboardProps {
  agentIds: string[];
  onAgentAdd?: (agentId: string) => void;
  onAgentRemove?: (agentId: string) => void;
  className?: string;
  maxComparisons?: number;
  enableExport?: boolean;
  availableAgents?: Agent[];
}

interface ComparisonMetric {
  label: string;
  key: keyof AgentMetrics;
  format: 'percentage' | 'number' | 'currency' | 'duration';
  description?: string;
}

interface CapabilityStatus {
  supported: boolean;
  level: 'basic' | 'advanced' | 'premium';
  description?: string;
}

const defaultMetrics: ComparisonMetric[] = [
  { label: 'Success Rate', key: 'successRate', format: 'percentage', description: 'Task completion success rate' },
  { label: 'Avg Response Time', key: 'averageResponseTime', format: 'duration', description: 'Average response time in milliseconds' },
  { label: 'Accuracy Score', key: 'accuracyScore', format: 'percentage', description: 'Overall accuracy percentage' },
  { label: 'Uptime', key: 'uptime', format: 'percentage', description: 'Service availability percentage' },
  { label: 'Cost Per Request', key: 'costPerRequest', format: 'currency', description: 'Average cost per API request' },
  { label: 'Daily Requests', key: 'dailyRequests', format: 'number', description: 'Average daily request volume' },
];

export default function AgentComparisonDashboard({
  agentIds,
  onAgentAdd,
  onAgentRemove,
  className = '',
  maxComparisons = 4,
  enableExport = true,
  availableAgents = [],
}: AgentComparisonDashboardProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    defaultMetrics.slice(0, 6).map(m => m.key)
  );
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | '90d'>('30d');
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [comparisonView, setComparisonView] = useState<'table' | 'chart'>('table');

  const {
    agents,
    metrics,
    pricingTiers,
    capabilities,
    loading,
    error,
    refreshData,
    exportComparison,
  } = useAgentComparison(agentIds, { timeRange });

  const filteredAgents = useMemo(() => {
    return availableAgents.filter(agent => !agentIds.includes(agent.id));
  }, [availableAgents, agentIds]);

  const comparisonData = useMemo(() => {
    if (!agents || !metrics) return [];

    return agents.map(agent => ({
      agent,
      metrics: metrics[agent.id] || {},
      pricing: pricingTiers[agent.id] || [],
      capabilities: capabilities[agent.id] || {},
    }));
  }, [agents, metrics, pricingTiers, capabilities]);

  const handleMetricToggle = (metricKey: string, checked: boolean) => {
    setSelectedMetrics(prev =>
      checked
        ? [...prev, metricKey]
        : prev.filter(key => key !== metricKey)
    );
  };

  const handleAddAgent = (agentId: string) => {
    if (agentIds.length < maxComparisons && onAgentAdd) {
      onAgentAdd(agentId);
    }
  };

  const handleRemoveAgent = (agentId: string) => {
    if (onAgentRemove) {
      onAgentRemove(agentId);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!enableExport || !exportComparison) return;
    
    try {
      await exportComparison(format, {
        agents: comparisonData,
        metrics: selectedMetrics,
        timeRange,
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getMetricTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
    const threshold = 0.05; // 5% threshold
    const change = (current - previous) / previous;
    
    if (Math.abs(change) < threshold) return 'neutral';
    return change > 0 ? 'up' : 'down';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCapabilityIcon = (status: CapabilityStatus) => {
    if (!status.supported) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    switch (status.level) {
      case 'premium':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'advanced':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading comparison data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-red-600 mb-2">Failed to load comparison data</p>
            <Button onClick={refreshData} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Agent Comparison</h2>
            <p className="text-muted-foreground">
              Compare {agentIds.length} of {maxComparisons} agents
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Add Agent */}
            {filteredAgents.length > 0 && agentIds.length < maxComparisons && (
              <Select onValueChange={handleAddAgent}>
                <SelectTrigger className="w-[180px]">
                  <Plus className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Add agent" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAgents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Time Range */}
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Options */}
            {enableExport && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport('csv')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export as CSV</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Agent Cards Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparisonData.map(({ agent, metrics: agentMetrics }) => (
            <Card key={agent.id} className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-6 w-6 p-0"
                onClick={() => handleRemoveAgent(agent.id)}
              >
                <X className="h-3 w-3" />
              </Button>
              
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {agent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-sm">{agent.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-muted-foreground">
                        {agent.rating?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">{agent.category}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Success Rate</span>
                  <span className="text-xs font-medium">
                    {formatMetrics(agentMetrics.successRate || 0, 'percentage')}
                  </span>
                </div>
                <Progress 
                  value={agentMetrics.successRate || 0} 
                  className="h-1"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Tabs */}
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="capabilities" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Capabilities
            </TabsTrigger>
          </TabsList>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Metrics Filter</span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="advanced-metrics"
                    checked={showAdvancedMetrics}
                    onCheckedChange={setShowAdvancedMetrics}
                  />
                  <label htmlFor="advanced-metrics" className="text-xs text-muted-foreground">
                    Show Advanced
                  </label>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={comparisonView === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setComparisonView('table')}
                >
                  Table
                </Button>
                <Button
                  variant={comparisonView === 'chart' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setComparisonView('chart')}
                >
                  Chart
                </Button>
              </div>
            </div>

            {comparisonView === 'table' ? (
              <Card>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Metric</TableHead>
                        {comparisonData.map(({ agent }) => (
                          <TableHead key={agent.id} className="text-center">
                            {agent.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defaultMetrics
                        .filter(metric => 
                          selectedMetrics.includes(metric.key) &&
                          (showAdvancedMetrics || !metric.description?.includes('Advanced'))
                        )
                        .map(metric => (
                          <TableRow key={metric.key}>
                            <TableCell className="font-medium">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    {metric.label}
                                    {metric.description && (
                                      <AlertCircle className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                {metric.description && (
                                  <TooltipContent>
                                    <p>{metric.description}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TableCell>
                            {comparisonData.map(({ agent, metrics: agentMetrics }) => (
                              <TableCell key={agent.id} className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span>
                                    {formatMetrics(
                                      agentMetrics[metric.key] || 0,
                                      metric.format
                                    )}
                                  </span>
                                  {getTrendIcon(
                                    getMetricTrend(
                                      agentMetrics[metric.key] || 0,
                                      agentMetrics[`${metric.key}Previous`] || 0
                                    )
                                  )}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <MetricChart
                    data={comparisonData}
                    metrics={selectedMetrics}
                    timeRange={timeRange}
                    height={400}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <div className="grid gap-6">
              {comparisonData.map(({ agent, pricing }) => (
                <Card key={agent.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {agent.name}
                      <Badge variant="outline">{agent.category}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {pricing.map((tier: PricingTier) => (
                        <Card key={tier.id} className="border-2">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{tier.name}</CardTitle>
                            <CardDescription>
                              <span className="text-2xl font-bold">
                                ${tier.price}
                              </span>
                              <span className="text-muted-foreground">
                                /{tier.billing_period}
                              </span>
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              {tier.features.map((feature: string, index: number) => (
                                <li key={index} className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                            {tier.limits && (
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-xs text-muted-foreground">
                                  Usage Limits
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                  {Object.entries(tier.limits).map(([key, value]) => (
                                    <div key={key}>
                                      <span className="capitalize">{key}:</span>
                                      <span className="font-medium ml-1">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Capabilities Tab */}
          <TabsContent value="capabilities" className="space-y-4">
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Capability</TableHead>
                      {comparisonData.map(({ agent }) => (
                        <TableHead key={agent.id} className="text-center">
                          {agent.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(capabilities).length > 0 &&
                      Object.keys(capabilities[Object.keys(capabilities)[0]] || {}).map(capability => (
                        <TableRow key={capability}>
                          <TableCell className="font-medium capitalize">
                            {capability.replace(/([A-Z])/g, ' $1').trim()}
                          </TableCell>
                          {comparisonData.map(({ agent, capabilities: agentCapabilities }) => {
                            const status = agentCapabilities[capability as keyof AgentCapability];
                            return (
                              <TableCell key={agent.id} className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-2">
                                      {getCapabilityIcon(status)}
                                      {status?.supported && (
                                        <Badge
                                          variant={
                                            status.level === 'premium'
                                              ? 'default'
                                              : status.level === 'advanced'
                                              ? 'secondary'
                                              : 'outline'
                                          }
                                          className="text-xs"
                                        >
                                          {status.level}
                                        </Badge>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {status?.supported
                                        ? `${status.level} support`
                                        : 'Not supported'}
                                    </p>
                                    {status?.description && (
                                      <p className="text-xs mt-1">{status.description}</p>
                                    )}
                                  </To