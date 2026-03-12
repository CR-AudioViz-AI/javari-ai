```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Activity, 
  Server,
  Settings,
  Bell,
  BellOff,
  Zap,
  BarChart3,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { supabase } from '@/lib/supabase/client';

interface ScalingMetric {
  id: string;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  requests_per_second: number;
  response_time: number;
  active_instances: number;
  cost_per_hour: number;
  scaling_event?: 'scale_up' | 'scale_down' | null;
  efficiency_score: number;
}

interface AlertThreshold {
  metric: string;
  min_value?: number;
  max_value?: number;
  enabled: boolean;
}

interface ScalingMetricsWidgetProps {
  className?: string;
  refreshInterval?: number;
  showCostAnalysis?: boolean;
  showAlertConfig?: boolean;
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

interface PerformanceIndicatorProps {
  label: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  threshold?: { min?: number; max?: number };
  format?: 'number' | 'currency' | 'percentage';
}

interface ResourceGaugeProps {
  label: string;
  value: number;
  max: number;
  color: string;
  threshold?: number;
}

interface ScalingEventProps {
  event: {
    id: string;
    timestamp: string;
    type: 'scale_up' | 'scale_down';
    instances_before: number;
    instances_after: number;
    trigger: string;
  };
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  label,
  value,
  unit,
  trend,
  threshold,
  format = 'number'
}) => {
  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return `$${val.toFixed(2)}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val.toFixed(2);
    }
  };

  const isThresholdExceeded = useMemo(() => {
    if (!threshold) return false;
    if (threshold.min && value < threshold.min) return true;
    if (threshold.max && value > threshold.max) return true;
    return false;
  }, [value, threshold]);

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border",
      isThresholdExceeded ? "border-red-200 bg-red-50" : "border-gray-200"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {getTrendIcon()}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "text-2xl font-bold",
          isThresholdExceeded ? "text-red-600" : "text-gray-900"
        )}>
          {formatValue(value)}
        </span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      {isThresholdExceeded && (
        <div className="flex items-center gap-1 mt-2">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span className="text-xs text-red-600">Threshold exceeded</span>
        </div>
      )}
    </div>
  );
};

const ResourceUtilizationGauge: React.FC<ResourceGaugeProps> = ({
  label,
  value,
  max,
  color,
  threshold
}) => {
  const percentage = (value / max) * 100;
  const isOverThreshold = threshold && percentage > threshold;

  const data = [{
    name: label,
    value: percentage,
    fill: isOverThreshold ? '#ef4444' : color
  }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={data}>
            <RadialBar dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-600 mt-1">{label}</span>
      <span className="text-xs text-gray-500">{value.toFixed(1)}/{max}</span>
    </div>
  );
};

const ScalingEventItem: React.FC<ScalingEventProps> = ({ event }) => {
  const isScaleUp = event.type === 'scale_up';
  const instanceChange = event.instances_after - event.instances_before;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-full",
          isScaleUp ? "bg-green-100" : "bg-orange-100"
        )}>
          {isScaleUp ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-orange-600" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium">
            {isScaleUp ? 'Scaled Up' : 'Scaled Down'}
          </div>
          <div className="text-xs text-gray-500">
            {event.instances_before} → {event.instances_after} instances
          </div>
        </div>
      </div>
      <div className="text-right">
        <Badge variant={isScaleUp ? "default" : "secondary"}>
          {instanceChange > 0 ? '+' : ''}{instanceChange}
        </Badge>
        <div className="text-xs text-gray-500 mt-1">
          {new Date(event.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

const ScalingMetricsWidget: React.FC<ScalingMetricsWidgetProps> = ({
  className,
  refreshInterval = 30000,
  showCostAnalysis = true,
  showAlertConfig = true,
  timeRange = '24h'
}) => {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState<Record<string, AlertThreshold>>({
    cpu: { metric: 'cpu_usage', max_value: 80, enabled: true },
    memory: { metric: 'memory_usage', max_value: 85, enabled: true },
    response_time: { metric: 'response_time', max_value: 200, enabled: true },
    cost: { metric: 'cost_per_hour', max_value: 100, enabled: true }
  });

  // Fetch scaling metrics
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['scaling-metrics', timeRange],
    queryFn: async () => {
      const hoursBack = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('scaling_metrics')
        .select('*')
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data as ScalingMetric[];
    },
    refetchInterval: refreshInterval
  });

  // Real-time subscription for new metrics
  useRealtimeSubscription({
    table: 'scaling_metrics',
    callback: () => {
      // Trigger refetch when new data arrives
    }
  });

  // Fetch scaling events
  const { data: scalingEvents = [] } = useQuery({
    queryKey: ['scaling-events', timeRange],
    queryFn: async () => {
      const hoursBack = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('scaling_events')
        .select('*')
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }
  });

  const latestMetrics = useMemo(() => {
    if (!metrics.length) return null;
    return metrics[metrics.length - 1];
  }, [metrics]);

  const costAnalysis = useMemo(() => {
    if (!metrics.length) return null;

    const totalCost = metrics.reduce((sum, metric) => sum + metric.cost_per_hour, 0);
    const avgCostPerHour = totalCost / metrics.length;
    const projectedDailyCost = avgCostPerHour * 24;
    const projectedMonthlyCost = projectedDailyCost * 30;

    return {
      current: latestMetrics?.cost_per_hour || 0,
      average: avgCostPerHour,
      dailyProjection: projectedDailyCost,
      monthlyProjection: projectedMonthlyCost
    };
  }, [metrics, latestMetrics]);

  const performanceMetrics = useMemo(() => {
    if (!latestMetrics) return null;

    return {
      cpu: latestMetrics.cpu_usage,
      memory: latestMetrics.memory_usage,
      responseTime: latestMetrics.response_time,
      requestsPerSecond: latestMetrics.requests_per_second,
      activeInstances: latestMetrics.active_instances,
      efficiencyScore: latestMetrics.efficiency_score
    };
  }, [latestMetrics]);

  const chartData = useMemo(() => {
    return metrics.map(metric => ({
      timestamp: new Date(metric.timestamp).toLocaleTimeString(),
      cpu: metric.cpu_usage,
      memory: metric.memory_usage,
      responseTime: metric.response_time,
      instances: metric.active_instances,
      cost: metric.cost_per_hour,
      rps: metric.requests_per_second
    }));
  }, [metrics]);

  const handleThresholdChange = (metric: string, field: 'min_value' | 'max_value', value: number) => {
    setThresholds(prev => ({
      ...prev,
      [metric]: {
        ...prev[metric],
        [field]: value
      }
    }));
  };

  const handleThresholdToggle = (metric: string, enabled: boolean) => {
    setThresholds(prev => ({
      ...prev,
      [metric]: {
        ...prev[metric],
        enabled
      }
    }));
  };

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scaling Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scaling Performance Metrics
            {latestMetrics && (
              <Badge variant="outline" className="ml-2">
                {latestMetrics.active_instances} instances
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {showAlertConfig && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className="flex items-center gap-1"
              >
                {alertsEnabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
                Alerts
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Performance Indicators */}
        {performanceMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PerformanceIndicator
              label="CPU Usage"
              value={performanceMetrics.cpu}
              unit="%"
              format="percentage"
              threshold={thresholds.cpu.enabled ? { max: thresholds.cpu.max_value } : undefined}
            />
            <PerformanceIndicator
              label="Memory Usage"
              value={performanceMetrics.memory}
              unit="%"
              format="percentage"
              threshold={thresholds.memory.enabled ? { max: thresholds.memory.max_value } : undefined}
            />
            <PerformanceIndicator
              label="Response Time"
              value={performanceMetrics.responseTime}
              unit="ms"
              threshold={thresholds.response_time.enabled ? { max: thresholds.response_time.max_value } : undefined}
            />
            <PerformanceIndicator
              label="Requests/sec"
              value={performanceMetrics.requestsPerSecond}
              unit="req/s"
            />
          </div>
        )}

        {/* Resource Utilization Gauges */}
        {performanceMetrics && (
          <div className="flex justify-around items-center py-4">
            <ResourceUtilizationGauge
              label="CPU"
              value={performanceMetrics.cpu}
              max={100}
              color="#3b82f6"
              threshold={thresholds.cpu.max_value}
            />
            <ResourceUtilizationGauge
              label="Memory"
              value={performanceMetrics.memory}
              max={100}
              color="#10b981"
              threshold={thresholds.memory.max_value}
            />
            <ResourceUtilizationGauge
              label="Efficiency"
              value={performanceMetrics.efficiencyScore}
              max={100}
              color="#f59e0b"
            />
          </div>
        )}

        <Separator />

        {/* Performance Chart */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance Trends
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
                <Line type="monotone" dataKey="memory" stroke="#10b981" name="Memory %" />
                <Line type="monotone" dataKey="responseTime" stroke="#f59e0b" name="Response Time (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Analysis */}
        {showCostAnalysis && costAnalysis && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Analysis
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PerformanceIndicator
                  label="Current Cost"
                  value={costAnalysis.current}
                  unit="/hour"
                  format="currency"
                  threshold={thresholds.cost.enabled ? { max: thresholds.cost.max_value } : undefined}
                />
                <PerformanceIndicator
                  label="Daily Projection"
                  value={costAnalysis.dailyProjection}
                  unit="/day"
                  format="currency"
                />
                <PerformanceIndicator
                  label="Monthly Projection"
                  value={costAnalysis.monthlyProjection}
                  unit="/month"
                  format="currency"
                />
                <PerformanceIndicator
                  label="Efficiency Score"
                  value={performanceMetrics?.efficiencyScore || 0}
                  unit="/100"
                />
              </div>
            </div>
          </>
        )}

        {/* Scaling Events */}
        {scalingEvents.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Scaling Events
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scalingEvents.map((event) => (
                  <ScalingEventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Threshold Configuration */}
        {showSettings && showAlertConfig && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Alert Thresholds</h4>
              <div className="space-y-4">
                {Object.entries(thresholds).map(([key, threshold]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium capitalize">
                        {threshold.metric.replace('_', ' ')}
                      </label>
                      <Switch
                        checked={threshold.enabled}
                        onCheckedChange={(enabled) => handleThresholdToggle(key, enabled)}
                      />
                    </div>
                    {threshold.enabled && threshold.max_value !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Max Threshold</span>
                          <span>{threshold.max_value}</span>
                        </div>
                        <Slider
                          value={[threshold.max_value]}
                          onValueChange={([value]) => handleThresholdChange(key, 'max_value', value)}
                          max={key === 'cost' ? 1000 : 100}
                          min={0}
                          step={key === 'cost' ? 10 : 1}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ScalingMetricsWidget;
```