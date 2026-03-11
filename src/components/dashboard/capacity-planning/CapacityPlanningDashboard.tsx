```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Target,
  Calendar,
  Settings,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// Types
interface CapacityMetric {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  storage_usage: number;
  network_io: number;
  predicted_cpu?: number;
  predicted_memory?: number;
  predicted_storage?: number;
}

interface ResourceAllocation {
  resource: string;
  current: number;
  recommended: number;
  utilization: number;
  cost_current: number;
  cost_recommended: number;
  savings: number;
  priority: 'high' | 'medium' | 'low';
}

interface ScalingRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'optimize';
  resource: string;
  current_value: number;
  recommended_value: number;
  confidence: number;
  estimated_savings: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  description: string;
}

interface CapacityAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  resource: string;
  threshold: number;
  current_value: number;
  predicted_breach: string;
  description: string;
}

interface ForecastConfig {
  time_horizon: number;
  confidence_interval: number;
  seasonality: boolean;
  trend_adjustment: number;
}

interface CapacityPlanningDashboardProps {
  organizationId?: string;
  refreshInterval?: number;
  className?: string;
}

// Mock hooks (replace with actual implementations)
const useCapacityMetrics = (orgId?: string) => {
  const [metrics, setMetrics] = useState<CapacityMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    const generateMockData = () => {
      const now = new Date();
      const data: CapacityMetric[] = [];
      
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - i * 3600000).toISOString();
        data.unshift({
          timestamp,
          cpu_usage: 40 + Math.random() * 40 + Math.sin(i / 4) * 15,
          memory_usage: 60 + Math.random() * 30 + Math.cos(i / 6) * 10,
          storage_usage: 70 + Math.random() * 20 + i * 0.5,
          network_io: 30 + Math.random() * 50,
          predicted_cpu: 45 + Math.random() * 35 + Math.sin((i + 4) / 4) * 15,
          predicted_memory: 65 + Math.random() * 25 + Math.cos((i + 4) / 6) * 10,
          predicted_storage: 75 + Math.random() * 15 + (i + 4) * 0.5,
        });
      }
      
      setMetrics(data);
      setIsLoading(false);
    };

    generateMockData();
    const interval = setInterval(generateMockData, 30000);
    return () => clearInterval(interval);
  }, [orgId]);

  return { metrics, isLoading };
};

const usePredictiveAnalytics = (metrics: CapacityMetric[]) => {
  return useMemo(() => {
    const recommendations: ScalingRecommendation[] = [
      {
        id: '1',
        type: 'scale_up',
        resource: 'CPU',
        current_value: 4,
        recommended_value: 6,
        confidence: 0.85,
        estimated_savings: -250,
        impact: 'high',
        timeframe: '2 hours',
        description: 'CPU utilization will exceed 80% threshold',
      },
      {
        id: '2',
        type: 'optimize',
        resource: 'Memory',
        current_value: 16,
        recommended_value: 12,
        confidence: 0.72,
        estimated_savings: 150,
        impact: 'medium',
        timeframe: '6 hours',
        description: 'Memory usage pattern suggests over-provisioning',
      },
    ];

    const alerts: CapacityAlert[] = [
      {
        id: '1',
        type: 'warning',
        resource: 'Storage',
        threshold: 85,
        current_value: 78,
        predicted_breach: '4 hours',
        description: 'Storage capacity approaching threshold',
      },
      {
        id: '2',
        type: 'critical',
        resource: 'CPU',
        threshold: 90,
        current_value: 82,
        predicted_breach: '2 hours',
        description: 'CPU utilization critical threshold imminent',
      },
    ];

    return { recommendations, alerts };
  }, [metrics]);
};

const useCostOptimization = () => {
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);

  useEffect(() => {
    setAllocations([
      {
        resource: 'CPU Cores',
        current: 8,
        recommended: 6,
        utilization: 65,
        cost_current: 480,
        cost_recommended: 360,
        savings: 120,
        priority: 'medium',
      },
      {
        resource: 'Memory (GB)',
        current: 32,
        recommended: 24,
        utilization: 58,
        cost_current: 320,
        cost_recommended: 240,
        savings: 80,
        priority: 'high',
      },
      {
        resource: 'Storage (GB)',
        current: 1000,
        recommended: 1200,
        utilization: 85,
        cost_current: 150,
        cost_recommended: 180,
        savings: -30,
        priority: 'high',
      },
    ]);
  }, []);

  return { allocations };
};

const CapacityOverviewCards: React.FC<{ metrics: CapacityMetric[] }> = ({ metrics }) => {
  const latestMetric = metrics[metrics.length - 1];
  
  if (!latestMetric) {
    return <div>No data available</div>;
  }

  const cards = [
    {
      title: 'CPU Utilization',
      value: `${latestMetric.cpu_usage.toFixed(1)}%`,
      change: '+5.2%',
      trend: 'up' as const,
      icon: Cpu,
      color: latestMetric.cpu_usage > 80 ? 'text-red-500' : 'text-green-500',
    },
    {
      title: 'Memory Usage',
      value: `${latestMetric.memory_usage.toFixed(1)}%`,
      change: '-2.1%',
      trend: 'down' as const,
      icon: Server,
      color: latestMetric.memory_usage > 85 ? 'text-red-500' : 'text-blue-500',
    },
    {
      title: 'Storage Usage',
      value: `${latestMetric.storage_usage.toFixed(1)}%`,
      change: '+1.8%',
      trend: 'up' as const,
      icon: HardDrive,
      color: latestMetric.storage_usage > 80 ? 'text-orange-500' : 'text-green-500',
    },
    {
      title: 'Network I/O',
      value: `${latestMetric.network_io.toFixed(1)} MB/s`,
      change: '+12.5%',
      trend: 'up' as const,
      icon: Zap,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {card.trend === 'up' ? (
                <ArrowUp className="h-3 w-3 mr-1 text-red-500" />
              ) : (
                <ArrowDown className="h-3 w-3 mr-1 text-green-500" />
              )}
              {card.change} from last hour
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const PredictiveScalingChart: React.FC<{ metrics: CapacityMetric[] }> = ({ metrics }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Predictive Resource Scaling</CardTitle>
        <CardDescription>
          Current usage and 24-hour predictions with confidence intervals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            />
            <YAxis domain={[0, 100]} />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleString()}
              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="cpu_usage" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="CPU Usage"
            />
            <Line 
              type="monotone" 
              dataKey="predicted_cpu" 
              stroke="#8884d8" 
              strokeDasharray="5 5"
              strokeWidth={2}
              name="CPU Prediction"
            />
            <Line 
              type="monotone" 
              dataKey="memory_usage" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Memory Usage"
            />
            <Line 
              type="monotone" 
              dataKey="predicted_memory" 
              stroke="#82ca9d" 
              strokeDasharray="5 5"
              strokeWidth={2}
              name="Memory Prediction"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

const ResourceUtilizationHeatmap: React.FC<{ metrics: CapacityMetric[] }> = ({ metrics }) => {
  const heatmapData = useMemo(() => {
    return metrics.slice(-12).map((metric, index) => ({
      time: new Date(metric.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      CPU: metric.cpu_usage,
      Memory: metric.memory_usage,
      Storage: metric.storage_usage,
      Network: metric.network_io,
    }));
  }, [metrics]);

  const getColor = (value: number) => {
    if (value > 80) return 'bg-red-500';
    if (value > 60) return 'bg-orange-500';
    if (value > 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Utilization Heatmap</CardTitle>
        <CardDescription>Last 12 hours resource usage patterns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-13 gap-1">
          <div></div>
          {heatmapData.map((data, index) => (
            <div key={index} className="text-xs text-center p-1 font-medium">
              {data.time}
            </div>
          ))}
          {['CPU', 'Memory', 'Storage', 'Network'].map((resource) => (
            <React.Fragment key={resource}>
              <div className="text-sm font-medium p-2">{resource}</div>
              {heatmapData.map((data, index) => (
                <div
                  key={`${resource}-${index}`}
                  className={`h-8 w-full rounded ${getColor(data[resource as keyof typeof data] as number)} opacity-80 flex items-center justify-center text-xs font-bold text-white`}
                  title={`${resource}: ${(data[resource as keyof typeof data] as number).toFixed(1)}%`}
                >
                  {(data[resource as keyof typeof data] as number).toFixed(0)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CostOptimizationPanel: React.FC<{ allocations: ResourceAllocation[] }> = ({ allocations }) => {
  const totalSavings = allocations.reduce((sum, alloc) => sum + alloc.savings, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Optimization
        </CardTitle>
        <CardDescription>
          Potential monthly savings: ${totalSavings > 0 ? '+' : ''}${totalSavings.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allocations.map((allocation, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{allocation.resource}</h4>
                <Badge variant={allocation.priority === 'high' ? 'destructive' : 
                              allocation.priority === 'medium' ? 'default' : 'secondary'}>
                  {allocation.priority} priority
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-medium">{allocation.current}</p>
                  <p className="text-muted-foreground">${allocation.cost_current}/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recommended</p>
                  <p className="font-medium">{allocation.recommended}</p>
                  <p className="text-muted-foreground">${allocation.cost_recommended}/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Savings</p>
                  <p className={`font-medium ${allocation.savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${allocation.savings > 0 ? '+' : ''}${allocation.savings}
                  </p>
                  <p className="text-muted-foreground">{allocation.utilization}% used</p>
                </div>
              </div>
              <Progress value={allocation.utilization} className="mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ScalingRecommendations: React.FC<{ recommendations: ScalingRecommendation[] }> = ({ recommendations }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Scaling Recommendations
        </CardTitle>
        <CardDescription>AI-powered suggestions for optimal resource allocation</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div key={rec.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    {rec.type === 'scale_up' ? (
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                    ) : rec.type === 'scale_down' ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : (
                      <Settings className="h-4 w-4 text-blue-500" />
                    )}
                    {rec.resource} {rec.type.replace('_', ' ')}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                </div>
                <Badge variant={rec.impact === 'high' ? 'destructive' : 
                              rec.impact === 'medium' ? 'default' : 'secondary'}>
                  {rec.impact} impact
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-medium">{rec.current_value}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recommended</p>
                  <p className="font-medium">{rec.recommended_value}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-medium">{(rec.confidence * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Est. Impact</p>
                  <p className={`font-medium ${rec.estimated_savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${rec.estimated_savings > 0 ? '+' : ''}${rec.estimated_savings}/mo
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">
                  Expected in {rec.timeframe}
                </span>
                <Button size="sm">Apply Recommendation</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CapacityAlertsPanel: React.FC<{ alerts: CapacityAlert[] }> = ({ alerts }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Capacity Alerts
        </CardTitle>
        <CardDescription>Threshold warnings and predictions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant={alert.type === 'critical' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{alert.resource} Capacity Alert</span>
                <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'}>
                  {alert.type}
                </Badge>
              </AlertTitle>
              <AlertDescription>
                <p>{alert.description}</p>
                <div className="mt-2 text-sm grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-muted-foreground">Current:</span> {alert.current_value}%
                  </div>
                  <div>
                    <span className="text-muted-foreground">Threshold:</span> {alert.threshold}%
                  </div>
                  <div>
                    <span className="text-muted-foreground">Breach in:</span> {alert.predicted_breach}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ForecastConfigPanel: React.FC<{ config: ForecastConfig; onConfigChange: (config: ForecastConfig) => void }> = ({ config, onConfigChange }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Forecast Configuration
        </CardTitle>
        <CardDescription>Adjust prediction parameters</CardDescription>
      </CardHeader>
      <CardContent className="space