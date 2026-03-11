'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Server, Database, 
  Cpu, HardDrive, Network, AlertTriangle, CheckCircle,
  DollarSign, Zap, Activity, Target, Settings,
  Calendar, Clock, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';

interface CapacityMetric {
  id: string;
  name: string;
  current: number;
  predicted: number;
  threshold: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  cost: number;
}

interface UtilizationData {
  timestamp: string;
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  cost: number;
}

interface ScalingPrediction {
  resource: string;
  currentCapacity: number;
  predictedDemand: number;
  recommendedCapacity: number;
  timeframe: string;
  confidence: number;
  costImpact: number;
}

interface OptimizationRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'reallocate' | 'optimize';
  resource: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  savings: number;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

const mockUtilizationData: UtilizationData[] = [
  { timestamp: '2024-01-01', cpu: 65, memory: 72, storage: 45, network: 38, cost: 12500 },
  { timestamp: '2024-01-02', cpu: 68, memory: 75, storage: 48, network: 42, cost: 12800 },
  { timestamp: '2024-01-03', cpu: 72, memory: 78, storage: 52, network: 45, cost: 13200 },
  { timestamp: '2024-01-04', cpu: 75, memory: 81, storage: 55, network: 48, cost: 13500 },
  { timestamp: '2024-01-05', cpu: 78, memory: 84, storage: 58, network: 52, cost: 13800 },
  { timestamp: '2024-01-06', cpu: 82, memory: 87, storage: 62, network: 55, cost: 14200 },
  { timestamp: '2024-01-07', cpu: 85, memory: 90, storage: 65, network: 58, cost: 14500 }
];

const mockCapacityMetrics: CapacityMetric[] = [
  { id: '1', name: 'CPU Usage', current: 78, predicted: 85, threshold: 80, unit: '%', trend: 'up', cost: 8500 },
  { id: '2', name: 'Memory Usage', current: 72, predicted: 82, threshold: 85, unit: '%', trend: 'up', cost: 6200 },
  { id: '3', name: 'Storage Usage', current: 65, predicted: 75, threshold: 90, unit: '%', trend: 'up', cost: 4800 },
  { id: '4', name: 'Network I/O', current: 45, predicted: 58, threshold: 70, unit: '%', trend: 'stable', cost: 3200 }
];

const mockScalingPredictions: ScalingPrediction[] = [
  { 
    resource: 'CPU', 
    currentCapacity: 100, 
    predictedDemand: 125, 
    recommendedCapacity: 140, 
    timeframe: '30 days', 
    confidence: 87, 
    costImpact: 2400 
  },
  { 
    resource: 'Memory', 
    currentCapacity: 256, 
    predictedDemand: 320, 
    recommendedCapacity: 384, 
    timeframe: '45 days', 
    confidence: 92, 
    costImpact: 1800 
  },
  { 
    resource: 'Storage', 
    currentCapacity: 1000, 
    predictedDemand: 1200, 
    recommendedCapacity: 1400, 
    timeframe: '60 days', 
    confidence: 78, 
    costImpact: 800 
  }
];

const mockOptimizationRecommendations: OptimizationRecommendation[] = [
  {
    id: '1',
    type: 'reallocate',
    resource: 'Database Instances',
    description: 'Consolidate underutilized database instances to reduce costs while maintaining performance',
    impact: 'high',
    savings: 3200,
    effort: 'medium',
    timeline: '2 weeks'
  },
  {
    id: '2',
    type: 'scale_down',
    resource: 'Development Environments',
    description: 'Scale down non-production environments during off-hours',
    impact: 'medium',
    savings: 1800,
    effort: 'low',
    timeline: '1 week'
  },
  {
    id: '3',
    type: 'optimize',
    resource: 'Storage Systems',
    description: 'Implement tiered storage strategy for older data',
    impact: 'medium',
    savings: 2400,
    effort: 'high',
    timeline: '6 weeks'
  }
];

export default function CapacityPlanningDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [resourceType, setResourceType] = useState('all');
  const [selectedScenario, setSelectedScenario] = useState('current');
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>(mockUtilizationData);
  const [capacityMetrics, setCapacityMetrics] = useState<CapacityMetric[]>(mockCapacityMetrics);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setCapacityMetrics(prev => 
        prev.map(metric => ({
          ...metric,
          current: Math.max(0, Math.min(100, metric.current + (Math.random() - 0.5) * 5))
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getMetricIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'cpu usage': return <Cpu className="h-5 w-5" />;
      case 'memory usage': return <Server className="h-5 w-5" />;
      case 'storage usage': return <HardDrive className="h-5 w-5" />;
      case 'network i/o': return <Network className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'scale_up': return <TrendingUp className="h-4 w-4" />;
      case 'scale_down': return <TrendingDown className="h-4 w-4" />;
      case 'reallocate': return <Settings className="h-4 w-4" />;
      case 'optimize': return <Target className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const totalMonthlyCost = capacityMetrics.reduce((sum, metric) => sum + metric.cost, 0);
  const criticalAlerts = capacityMetrics.filter(metric => metric.current > metric.threshold).length;
  const potentialSavings = mockOptimizationRecommendations.reduce((sum, rec) => sum + rec.savings, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Capacity Planning</h1>
          <p className="text-muted-foreground mt-2">
            Monitor platform capacity, predict scaling needs, and optimize resource allocation
          </p>
        </div>
        
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 Day</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={resourceType} onValueChange={setResourceType}>
            <SelectTrigger className="w-40">
              <Server className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="compute">Compute</SelectItem>
              <SelectItem value="storage">Storage</SelectItem>
              <SelectItem value="network">Network</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Cost</p>
                <p className="text-2xl font-bold">${totalMonthlyCost.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-600">{criticalAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">${potentialSavings.toLocaleString()}</p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Efficiency Score</p>
                <p className="text-2xl font-bold">87%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Current Capacity Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {capacityMetrics.map((metric) => (
              <Card key={metric.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getMetricIcon(metric.name)}
                      <h3 className="font-semibold">{metric.name}</h3>
                    </div>
                    {getTrendIcon(metric.trend)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Current</span>
                      <span>{metric.current}{metric.unit}</span>
                    </div>
                    <Progress 
                      value={metric.current} 
                      className="h-2"
                      aria-label={`${metric.name} usage: ${metric.current}%`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Predicted: {metric.predicted}{metric.unit}</span>
                      <span>Threshold: {metric.threshold}{metric.unit}</span>
                    </div>
                    <div className="text-sm font-medium">
                      Cost: ${metric.cost}/month
                    </div>
                  </div>

                  {metric.current > metric.threshold && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Above threshold - scaling recommended
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Utilization Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Utilization Trends
              </CardTitle>
              <CardDescription>
                Resource utilization over time with cost correlation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={utilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Area yAxisId="left" type="monotone" dataKey="cpu" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area yAxisId="left" type="monotone" dataKey="memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  <Area yAxisId="left" type="monotone" dataKey="storage" stackId="1" stroke="#ffc658" fill="#ffc658" fillOpacity={0.3} />
                  <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ff7300" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          {/* Scaling Predictions */}
          <Card>
            <CardHeader>
              <CardTitle>Scaling Predictions</CardTitle>
              <CardDescription>
                AI-powered predictions for resource scaling requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {mockScalingPredictions.map((prediction, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{prediction.resource}</h3>
                      <Badge variant={prediction.confidence > 85 ? "default" : "secondary"}>
                        {prediction.confidence}% confidence
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-medium">{prediction.currentCapacity} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Predicted</p>
                        <p className="font-medium">{prediction.predictedDemand} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Recommended</p>
                        <p className="font-medium">{prediction.recommendedCapacity} units</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost Impact</p>
                        <p className="font-medium text-orange-600">+${prediction.costImpact}/mo</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Scaling needed within {prediction.timeframe}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resource Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Resource Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={capacityMetrics}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="cost"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {capacityMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Predicted vs Current Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={capacityMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="current" fill="#8884d8" name="Current" />
                    <Bar dataKey="predicted" fill="#82ca9d" name="Predicted" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          {/* Optimization Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>
                AI-generated recommendations to optimize resource allocation and reduce costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockOptimizationRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getRecommendationIcon(recommendation.type)}
                        <div>
                          <h3 className="font-semibold">{recommendation.resource}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {recommendation.description}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={recommendation.impact === 'high' ? 'default' : 
                                recommendation.impact === 'medium' ? 'secondary' : 'outline'}
                      >
                        {recommendation.impact} impact
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Savings</p>
                        <p className="font-medium text-green-600">
                          ${recommendation.