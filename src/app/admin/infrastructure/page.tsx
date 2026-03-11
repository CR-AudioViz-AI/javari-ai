```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  Zap,
  Clock,
  Users,
  BarChart3,
  Shield
} from 'lucide-react';

interface MetricData {
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  requests: number;
  users: number;
}

interface ScalingPolicy {
  id: string;
  name: string;
  resource: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  enabled: boolean;
  cooldown: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface CostData {
  service: string;
  cost: number;
  percentage: number;
  trend: number;
}

interface CapacityPrediction {
  resource: string;
  current: number;
  predicted: number;
  recommendation: string;
  confidence: number;
}

const InfrastructurePage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricData | null>(null);
  const [scalingPolicies, setScalingPolicies] = useState<ScalingPolicy[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [costData, setCostData] = useState<CostData[]>([]);
  const [capacityPredictions, setCapacityPredictions] = useState<CapacityPrediction[]>([]);
  const [isAutoScalingEnabled, setIsAutoScalingEnabled] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data generation
  const generateMockData = useCallback(() => {
    const now = new Date();
    const mockMetrics: MetricData[] = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(now.getTime() - (23 - i) * 60000).toISOString(),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      network: Math.random() * 1000,
      storage: Math.random() * 100,
      requests: Math.floor(Math.random() * 10000),
      users: Math.floor(Math.random() * 1000)
    }));

    const mockPolicies: ScalingPolicy[] = [
      {
        id: '1',
        name: 'CPU Auto Scale',
        resource: 'CPU',
        threshold: 75,
        action: 'scale_up',
        enabled: true,
        cooldown: 300
      },
      {
        id: '2',
        name: 'Memory Auto Scale',
        resource: 'Memory',
        threshold: 80,
        action: 'scale_up',
        enabled: true,
        cooldown: 300
      },
      {
        id: '3',
        name: 'CPU Scale Down',
        resource: 'CPU',
        threshold: 25,
        action: 'scale_down',
        enabled: false,
        cooldown: 600
      }
    ];

    const mockAlerts: Alert[] = [
      {
        id: '1',
        type: 'warning',
        title: 'High CPU Usage',
        description: 'CPU usage has exceeded 85% for the past 10 minutes',
        timestamp: new Date().toISOString(),
        resolved: false
      },
      {
        id: '2',
        type: 'info',
        title: 'Auto Scaling Event',
        description: 'Successfully scaled up 2 instances due to high load',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: true
      }
    ];

    const mockCostData: CostData[] = [
      { service: 'Compute', cost: 1250.50, percentage: 45, trend: 12 },
      { service: 'Storage', cost: 420.30, percentage: 15, trend: -5 },
      { service: 'Network', cost: 380.25, percentage: 14, trend: 8 },
      { service: 'Database', cost: 650.75, percentage: 23, trend: 15 },
      { service: 'Other', cost: 98.20, percentage: 3, trend: -2 }
    ];

    const mockCapacityPredictions: CapacityPrediction[] = [
      {
        resource: 'CPU',
        current: 65,
        predicted: 78,
        recommendation: 'Consider adding 2 more instances',
        confidence: 85
      },
      {
        resource: 'Memory',
        current: 72,
        predicted: 85,
        recommendation: 'Upgrade to higher memory instances',
        confidence: 92
      },
      {
        resource: 'Storage',
        current: 58,
        predicted: 45,
        recommendation: 'Current capacity is sufficient',
        confidence: 78
      }
    ];

    setMetrics(mockMetrics);
    setCurrentMetrics(mockMetrics[mockMetrics.length - 1]);
    setScalingPolicies(mockPolicies);
    setAlerts(mockAlerts);
    setCostData(mockCostData);
    setCapacityPredictions(mockCapacityPredictions);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    generateMockData();

    // Simulate real-time updates
    const interval = setInterval(() => {
      const newMetric: MetricData = {
        timestamp: new Date().toISOString(),
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 1000,
        storage: Math.random() * 100,
        requests: Math.floor(Math.random() * 10000),
        users: Math.floor(Math.random() * 1000)
      };

      setCurrentMetrics(newMetric);
      setMetrics(prev => [...prev.slice(1), newMetric]);
    }, 30000);

    return () => clearInterval(interval);
  }, [generateMockData]);

  const handleScalingAction = async (action: 'scale_up' | 'scale_down', instances: number) => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newAlert: Alert = {
        id: Date.now().toString(),
        type: 'info',
        title: `Manual Scaling ${action === 'scale_up' ? 'Up' : 'Down'}`,
        description: `Successfully ${action === 'scale_up' ? 'added' : 'removed'} ${instances} instance(s)`,
        timestamp: new Date().toISOString(),
        resolved: true
      };

      setAlerts(prev => [newAlert, ...prev]);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to execute scaling action');
      setIsLoading(false);
    }
  };

  const toggleScalingPolicy = (policyId: string) => {
    setScalingPolicies(prev =>
      prev.map(policy =>
        policy.id === policyId
          ? { ...policy, enabled: !policy.enabled }
          : policy
      )
    );
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-500';
    if (value >= thresholds.warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusBadge = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return <Badge variant="destructive">Critical</Badge>;
    if (value >= thresholds.warning) return <Badge variant="secondary">Warning</Badge>;
    return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
  };

  const pieChartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  if (isLoading && !currentMetrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading infrastructure data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Infrastructure Control Panel</h1>
            <p className="text-gray-600 mt-1">Monitor, scale, and optimize your platform infrastructure</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-scaling">Auto Scaling</Label>
              <Switch
                id="auto-scaling"
                checked={isAutoScalingEnabled}
                onCheckedChange={setIsAutoScalingEnabled}
              />
            </div>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last Day</SelectItem>
                <SelectItem value="7d">Last Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMetrics?.cpu.toFixed(1)}%
              </div>
              <div className="flex items-center justify-between mt-2">
                <Progress value={currentMetrics?.cpu || 0} className="flex-1" />
                <div className="ml-2">
                  {getStatusBadge(currentMetrics?.cpu || 0, { warning: 70, critical: 85 })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMetrics?.memory.toFixed(1)}%
              </div>
              <div className="flex items-center justify-between mt-2">
                <Progress value={currentMetrics?.memory || 0} className="flex-1" />
                <div className="ml-2">
                  {getStatusBadge(currentMetrics?.memory || 0, { warning: 75, critical: 90 })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMetrics?.users.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.floor(Math.random() * 50)} new in last hour
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests/Min</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMetrics?.requests.toLocaleString()}
              </div>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-500">+12% from last hour</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scaling">Scaling</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Charts */}
              <Card>
                <CardHeader>
                  <CardTitle>Resource Utilization</CardTitle>
                  <CardDescription>Real-time system metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)}${name === 'network' ? ' MB/s' : '%'}`,
                          name.toUpperCase()
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke="#8884d8"
                        strokeWidth={2}
                        name="cpu"
                      />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        name="memory"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Network Traffic */}
              <Card>
                <CardHeader>
                  <CardTitle>Network Traffic</CardTitle>
                  <CardDescription>Bandwidth utilization over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: number) => [`${value.toFixed(1)} MB/s`, 'Network']}
                      />
                      <Area
                        type="monotone"
                        dataKey="network"
                        stroke="#ffc658"
                        fill="#ffc658"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scaling" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Manual Scaling Controls */}
              <Card>
                <CardHeader>
                  <CardTitle>Manual Scaling</CardTitle>
                  <CardDescription>Manually adjust instance capacity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="instance-count">Instance Count</Label>
                      <Input
                        id="instance-count"
                        type="number"
                        defaultValue="5"
                        min="1"
                        max="20"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2 pt-6">
                      <Button
                        onClick={() => handleScalingAction('scale_up', 1)}
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Scale Up
                      </Button>
                      <Button
                        onClick={() => handleScalingAction('scale_down', 1)}
                        disabled={isLoading}
                        variant="outline"
                      >
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Scale Down
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Auto Scaling Policies */}
              <Card>
                <CardHeader>
                  <CardTitle>Auto Scaling Policies</CardTitle>
                  <CardDescription>Configure automatic scaling rules</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-72">
                    <div className="space-y-4">
                      {scalingPolicies.map((policy) => (
                        <div key={policy.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{policy.name}</h4>
                            <Switch
                              checked={policy.enabled}
                              onCheckedChange={() => toggleScalingPolicy(policy.id)}
                            />
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>Resource: {policy.resource}</p>
                            <p>Threshold: {policy.threshold}%</p>
                            <p>Action: {policy.action.replace('_', ' ')}</p>
                            <p>Cooldown: {policy.cooldown}s</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Breakdown</CardTitle>
                  <CardDescription>Monthly infrastructure spending</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={costData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="cost"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        {costData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={pieChartColors[index % pieChartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cost Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Service Costs</CardTitle>