```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Network,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  BarChart3,
  Zap,
  Shield,
  DollarSign,
  Cloud,
  Monitor,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Target
} from 'lucide-react';

// Types
interface MetricData {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
  target: number;
  lastUpdated: Date;
}

interface ScalingRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
  minInstances: number;
  maxInstances: number;
}

interface ResourceMetrics {
  cpu: MetricData;
  memory: MetricData;
  disk: MetricData;
  network: MetricData;
}

interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface CapacityPrediction {
  resource: string;
  currentUsage: number;
  predictedUsage: number;
  timeframe: string;
  confidence: number;
  recommendation: string;
}

// Mock data generators
const generateMetricData = (name: string, baseValue: number): MetricData => ({
  id: name.toLowerCase().replace(' ', '_'),
  name,
  value: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * 20)),
  unit: '%',
  trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'down' : 'stable',
  status: Math.random() > 0.8 ? 'critical' : Math.random() > 0.6 ? 'warning' : 'healthy',
  target: 80,
  lastUpdated: new Date()
});

const generateResourceMetrics = (): ResourceMetrics => ({
  cpu: generateMetricData('CPU Usage', 65),
  memory: generateMetricData('Memory Usage', 72),
  disk: generateMetricData('Disk Usage', 45),
  network: generateMetricData('Network Usage', 38)
});

const generateScalingRules = (): ScalingRule[] => [
  {
    id: '1',
    name: 'CPU Scale Up',
    enabled: true,
    metric: 'cpu_usage',
    threshold: 80,
    action: 'scale_up',
    cooldown: 300,
    minInstances: 2,
    maxInstances: 10
  },
  {
    id: '2',
    name: 'Memory Scale Up',
    enabled: true,
    metric: 'memory_usage',
    threshold: 85,
    action: 'scale_up',
    cooldown: 300,
    minInstances: 2,
    maxInstances: 10
  },
  {
    id: '3',
    name: 'CPU Scale Down',
    enabled: false,
    metric: 'cpu_usage',
    threshold: 30,
    action: 'scale_down',
    cooldown: 600,
    minInstances: 2,
    maxInstances: 10
  }
];

const generateAlerts = (): AlertItem[] => [
  {
    id: '1',
    severity: 'warning',
    message: 'High CPU usage detected on production cluster',
    timestamp: new Date(Date.now() - 300000),
    resolved: false
  },
  {
    id: '2',
    severity: 'info',
    message: 'Auto-scaling triggered: Added 2 instances',
    timestamp: new Date(Date.now() - 600000),
    resolved: true
  },
  {
    id: '3',
    severity: 'error',
    message: 'Database connection pool exhausted',
    timestamp: new Date(Date.now() - 900000),
    resolved: false
  }
];

const generateCapacityPredictions = (): CapacityPrediction[] => [
  {
    resource: 'CPU',
    currentUsage: 65,
    predictedUsage: 82,
    timeframe: '24h',
    confidence: 87,
    recommendation: 'Consider scaling up 2-3 instances'
  },
  {
    resource: 'Memory',
    currentUsage: 72,
    predictedUsage: 69,
    timeframe: '24h',
    confidence: 92,
    recommendation: 'Current capacity sufficient'
  },
  {
    resource: 'Storage',
    currentUsage: 45,
    predictedUsage: 58,
    timeframe: '7d',
    confidence: 94,
    recommendation: 'Monitor growth, scaling may be needed'
  }
];

// Components
const MetricsGrid: React.FC<{ metrics: ResourceMetrics }> = ({ metrics }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.values(metrics).map((metric) => (
        <Card key={metric.id} className="relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              {getTrendIcon(metric.trend)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                  {metric.value.toFixed(1)}{metric.unit}
                </span>
                <Badge
                  variant={
                    metric.status === 'critical' ? 'destructive' :
                    metric.status === 'warning' ? 'secondary' : 'default'
                  }
                >
                  {metric.status}
                </Badge>
              </div>
              <Progress
                value={metric.value}
                className={`h-2 ${
                  metric.status === 'critical' ? '[&>div]:bg-red-500' :
                  metric.status === 'warning' ? '[&>div]:bg-yellow-500' :
                  '[&>div]:bg-green-500'
                }`}
              />
              <div className="text-xs text-muted-foreground">
                Target: {metric.target}{metric.unit}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const ScalingControls: React.FC<{
  rules: ScalingRule[];
  onToggleRule: (ruleId: string) => void;
  onUpdateRule: (rule: ScalingRule) => void;
}> = ({ rules, onToggleRule, onUpdateRule }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Auto-Scaling Rules
        </CardTitle>
        <CardDescription>
          Configure automatic scaling policies and thresholds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{rule.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {rule.action === 'scale_up' ? 'Scale up' : 'Scale down'} when {rule.metric} {rule.action === 'scale_up' ? '>' : '<'} {rule.threshold}%
                </p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={() => onToggleRule(rule.id)}
                aria-label={`Toggle ${rule.name}`}
              />
            </div>
            
            {rule.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                <div>
                  <Label htmlFor={`threshold-${rule.id}`}>Threshold (%)</Label>
                  <Input
                    id={`threshold-${rule.id}`}
                    type="number"
                    value={rule.threshold}
                    onChange={(e) => onUpdateRule({
                      ...rule,
                      threshold: parseInt(e.target.value) || 0
                    })}
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor={`min-${rule.id}`}>Min Instances</Label>
                  <Input
                    id={`min-${rule.id}`}
                    type="number"
                    value={rule.minInstances}
                    onChange={(e) => onUpdateRule({
                      ...rule,
                      minInstances: parseInt(e.target.value) || 1
                    })}
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor={`max-${rule.id}`}>Max Instances</Label>
                  <Input
                    id={`max-${rule.id}`}
                    type="number"
                    value={rule.maxInstances}
                    onChange={(e) => onUpdateRule({
                      ...rule,
                      maxInstances: parseInt(e.target.value) || 1
                    })}
                    min="1"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const AlertsPanel: React.FC<{ alerts: AlertItem[] }> = ({ alerts }) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Alerts & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              className={`${
                alert.severity === 'error' ? 'border-red-200 bg-red-50' :
                alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <AlertDescription className="font-medium">
                    {alert.message}
                  </AlertDescription>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {alert.timestamp.toLocaleTimeString()}
                    </span>
                    {alert.resolved && (
                      <Badge variant="outline" className="text-xs">
                        Resolved
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CapacityPlanner: React.FC<{ predictions: CapacityPrediction[] }> = ({ predictions }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Capacity Planning
        </CardTitle>
        <CardDescription>
          AI-powered capacity predictions and recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {predictions.map((prediction, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{prediction.resource}</h4>
                <Badge variant="outline">
                  {prediction.confidence}% confidence
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Current Usage</Label>
                  <div className="text-lg font-semibold">{prediction.currentUsage}%</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Predicted ({prediction.timeframe})
                  </Label>
                  <div className={`text-lg font-semibold ${
                    prediction.predictedUsage > prediction.currentUsage ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {prediction.predictedUsage}%
                  </div>
                </div>
              </div>
              
              <Progress
                value={prediction.predictedUsage}
                className={`h-2 mb-2 ${
                  prediction.predictedUsage > 80 ? '[&>div]:bg-red-500' :
                  prediction.predictedUsage > 60 ? '[&>div]:bg-yellow-500' :
                  '[&>div]:bg-green-500'
                }`}
              />
              
              <p className="text-sm text-muted-foreground">
                <Target className="h-3 w-3 inline mr-1" />
                {prediction.recommendation}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const PerformanceCharts: React.FC = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [refreshRate, setRefreshRate] = useState(30);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Real-time system performance visualization</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="6h">6h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
                <SelectItem value="7d">7d</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/10">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Performance charts would be rendered here</p>
            <p className="text-sm text-muted-foreground">Time range: {timeRange} | Refresh: {refreshRate}s</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadBalancerStatus: React.FC = () => {
  const [instances] = useState([
    { id: '1', name: 'web-server-01', status: 'healthy', load: 65, connections: 245 },
    { id: '2', name: 'web-server-02', status: 'healthy', load: 72, connections: 289 },
    { id: '3', name: 'web-server-03', status: 'warning', load: 88, connections: 156 },
    { id: '4', name: 'web-server-04', status: 'healthy', load: 45, connections: 178 }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Load Balancer Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instances.map((instance) => (
            <div key={instance.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  instance.status === 'healthy' ? 'bg-green-500' :
                  instance.status === 'warning' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <div>
                  <p className="font-medium">{instance.name}</p>
                  <p className={`text-sm capitalize ${getStatusColor(instance.status)}`}>
                    {instance.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Load: {instance.load}%</p>
                <p className="text-sm text-muted-foreground">Connections: {instance.connections}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Main component
const PlatformScalingDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ResourceMetrics>(generateResourceMetrics());
  const [scalingRules, setScalingRules] = useState<ScalingRule[]>(generateScalingRules());
  const [alerts] = useState<AlertItem[]>(generateAlerts());
  const [predictions] = useState<CapacityPrediction[]>(generateCapacityPredictions());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const updateMetrics = useCallback(() => {
    setMetrics(generateResourceMetrics());
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      updateMetrics();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, updateMetrics]);

  const handleToggleRule = (ruleId: string) => {
    setScalingRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const handleUpdateRule = (updatedRule: ScalingRule) => {
    setScalingRules(prev => prev.map(rule => 
      rule.id === updatedRule.id ? updatedRule : rule
    ));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Scaling Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and control your platform's auto-scaling and capacity management
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto-refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <Select
            value={refreshInterval.toString()}
            onValueChange={(value) =>