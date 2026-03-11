```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Cell,
  Legend
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  DollarSign,
  Settings,
  Bell,
  BarChart3,
  Target,
  Layers,
  Clock,
  Server,
  GitBranch,
  Shield,
  Users,
  Calendar,
  RefreshCw
} from 'lucide-react';

// Types
interface ResourceMetrics {
  id: string;
  timestamp: Date;
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  activeConnections: number;
  requestsPerSecond: number;
}

interface PerformanceData {
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

interface CapacityPrediction {
  resource: string;
  currentUsage: number;
  predictedUsage: number;
  timeToCapacity: number;
  confidence: number;
  recommendation: string;
}

interface ScalingEvent {
  id: string;
  timestamp: Date;
  type: 'scale-up' | 'scale-down';
  resource: string;
  fromInstances: number;
  toInstances: number;
  trigger: string;
  status: 'completed' | 'in-progress' | 'failed';
  duration?: number;
  cost?: number;
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'greater' | 'less' | 'equals';
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notifications: string[];
}

interface LoadBalancerData {
  instanceId: string;
  status: 'healthy' | 'unhealthy' | 'draining';
  connections: number;
  responseTime: number;
  cpuUsage: number;
  region: string;
}

interface AutoScalingRule {
  id: string;
  name: string;
  metric: string;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number;
  enabled: boolean;
}

interface CostData {
  period: string;
  compute: number;
  storage: number;
  network: number;
  total: number;
  optimization: number;
}

interface ScalingAnalyticsDashboardProps {
  className?: string;
  refreshInterval?: number;
  enableRealTime?: boolean;
  onAlert?: (alert: AlertRule) => void;
  onScalingEvent?: (event: ScalingEvent) => void;
}

const SEVERITY_COLORS = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

const STATUS_COLORS = {
  healthy: 'text-green-600',
  unhealthy: 'text-red-600',
  draining: 'text-yellow-600',
  completed: 'text-green-600',
  'in-progress': 'text-blue-600',
  failed: 'text-red-600'
};

const ScalingAnalyticsDashboard: React.FC<ScalingAnalyticsDashboardProps> = ({
  className = '',
  refreshInterval = 30000,
  enableRealTime = true,
  onAlert,
  onScalingEvent
}) => {
  // State
  const [currentMetrics, setCurrentMetrics] = useState<ResourceMetrics | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceData[]>([]);
  const [capacityPredictions, setCapacityPredictions] = useState<CapacityPrediction[]>([]);
  const [scalingEvents, setScalingEvents] = useState<ScalingEvent[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loadBalancerData, setLoadBalancerData] = useState<LoadBalancerData[]>([]);
  const [autoScalingRules, setAutoScalingRules] = useState<AutoScalingRule[]>([]);
  const [costData, setCostData] = useState<CostData[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [isLoading, setIsLoading] = useState(true);

  // Mock data generation
  useEffect(() => {
    const generateMockData = () => {
      // Current metrics
      setCurrentMetrics({
        id: '1',
        timestamp: new Date(),
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        storage: Math.random() * 100,
        network: Math.random() * 100,
        activeConnections: Math.floor(Math.random() * 10000),
        requestsPerSecond: Math.floor(Math.random() * 5000)
      });

      // Performance history
      const performance = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
        responseTime: 100 + Math.random() * 200,
        throughput: 1000 + Math.random() * 4000,
        errorRate: Math.random() * 5,
        availability: 95 + Math.random() * 5
      }));
      setPerformanceHistory(performance);

      // Capacity predictions
      setCapacityPredictions([
        {
          resource: 'CPU',
          currentUsage: 75,
          predictedUsage: 85,
          timeToCapacity: 48,
          confidence: 92,
          recommendation: 'Scale up by 2 instances in next 24 hours'
        },
        {
          resource: 'Memory',
          currentUsage: 68,
          predictedUsage: 72,
          timeToCapacity: 120,
          confidence: 87,
          recommendation: 'Monitor closely, scaling may be needed in 5 days'
        },
        {
          resource: 'Storage',
          currentUsage: 45,
          predictedUsage: 48,
          timeToCapacity: 240,
          confidence: 94,
          recommendation: 'Storage capacity is sufficient for next 10 days'
        }
      ]);

      // Scaling events
      setScalingEvents([
        {
          id: '1',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          type: 'scale-up',
          resource: 'Web Servers',
          fromInstances: 3,
          toInstances: 5,
          trigger: 'High CPU usage (>80%)',
          status: 'completed',
          duration: 180,
          cost: 45.50
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          type: 'scale-down',
          resource: 'Background Workers',
          fromInstances: 4,
          toInstances: 2,
          trigger: 'Low queue depth (<10)',
          status: 'completed',
          duration: 120,
          cost: -22.75
        }
      ]);

      // Alert rules
      setAlertRules([
        {
          id: '1',
          name: 'High CPU Usage',
          metric: 'cpu',
          operator: 'greater',
          threshold: 80,
          duration: 300,
          severity: 'high',
          enabled: true,
          notifications: ['email', 'slack']
        },
        {
          id: '2',
          name: 'Memory Exhaustion',
          metric: 'memory',
          operator: 'greater',
          threshold: 90,
          duration: 180,
          severity: 'critical',
          enabled: true,
          notifications: ['email', 'slack', 'webhook']
        }
      ]);

      // Load balancer data
      setLoadBalancerData([
        {
          instanceId: 'i-1a2b3c4d',
          status: 'healthy',
          connections: 245,
          responseTime: 120,
          cpuUsage: 65,
          region: 'us-east-1'
        },
        {
          instanceId: 'i-2b3c4d5e',
          status: 'healthy',
          connections: 198,
          responseTime: 110,
          cpuUsage: 58,
          region: 'us-east-1'
        },
        {
          instanceId: 'i-3c4d5e6f',
          status: 'draining',
          connections: 89,
          responseTime: 95,
          cpuUsage: 42,
          region: 'us-west-2'
        }
      ]);

      // Auto-scaling rules
      setAutoScalingRules([
        {
          id: '1',
          name: 'CPU Based Scaling',
          metric: 'CPU',
          scaleUpThreshold: 70,
          scaleDownThreshold: 30,
          minInstances: 2,
          maxInstances: 10,
          cooldownPeriod: 300,
          enabled: true
        },
        {
          id: '2',
          name: 'Request Rate Scaling',
          metric: 'RequestRate',
          scaleUpThreshold: 1000,
          scaleDownThreshold: 200,
          minInstances: 1,
          maxInstances: 8,
          cooldownPeriod: 600,
          enabled: false
        }
      ]);

      // Cost data
      const costs = Array.from({ length: 12 }, (_, i) => ({
        period: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        compute: 500 + Math.random() * 200,
        storage: 100 + Math.random() * 50,
        network: 50 + Math.random() * 30,
        total: 0,
        optimization: Math.random() * 100
      }));
      costs.forEach(cost => {
        cost.total = cost.compute + cost.storage + cost.network;
      });
      setCostData(costs);

      setIsLoading(false);
    };

    generateMockData();
    const interval = setInterval(generateMockData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Computed values
  const totalInstances = useMemo(() => 
    loadBalancerData.length
  , [loadBalancerData]);

  const healthyInstances = useMemo(() => 
    loadBalancerData.filter(lb => lb.status === 'healthy').length
  , [loadBalancerData]);

  const averageResponseTime = useMemo(() => 
    loadBalancerData.reduce((acc, lb) => acc + lb.responseTime, 0) / loadBalancerData.length || 0
  , [loadBalancerData]);

  const totalConnections = useMemo(() => 
    loadBalancerData.reduce((acc, lb) => acc + lb.connections, 0)
  , [loadBalancerData]);

  const activeAlerts = useMemo(() => 
    alertRules.filter(rule => rule.enabled).length
  , [alertRules]);

  const currentCosts = useMemo(() => 
    costData[costData.length - 1]?.total || 0
  , [costData]);

  const costTrend = useMemo(() => {
    if (costData.length < 2) return 0;
    const current = costData[costData.length - 1]?.total || 0;
    const previous = costData[costData.length - 2]?.total || 0;
    return ((current - previous) / previous) * 100;
  }, [costData]);

  // Resource Utilization Card
  const ResourceUtilizationCard: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Resource Utilization
        </CardTitle>
        <CardDescription>Real-time system resource usage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentMetrics && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentMetrics.cpu.toFixed(1)}%
                </span>
              </div>
              <Progress value={currentMetrics.cpu} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentMetrics.memory.toFixed(1)}%
                </span>
              </div>
              <Progress value={currentMetrics.memory} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Storage Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentMetrics.storage.toFixed(1)}%
                </span>
              </div>
              <Progress value={currentMetrics.storage} className="h-2" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Network Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentMetrics.network.toFixed(1)}%
                </span>
              </div>
              <Progress value={currentMetrics.network} className="h-2" />
            </div>
          </>
        )}
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {currentMetrics?.activeConnections.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Active Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {currentMetrics?.requestsPerSecond.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Requests/sec</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Performance Trends Chart
  const PerformanceTrendsChart: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Trends
        </CardTitle>
        <CardDescription>Historical performance metrics over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(2)}${name === 'errorRate' ? '%' : name === 'responseTime' ? 'ms' : ''}`,
                  name
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Response Time (ms)"
              />
              <Line 
                type="monotone" 
                dataKey="throughput" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Throughput"
              />
              <Line 
                type="monotone" 
                dataKey="errorRate" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Error Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  // Capacity Planning Widget
  const CapacityPlanningWidget: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Capacity Planning
        </CardTitle>
        <CardDescription>AI-powered capacity forecasting and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {capacityPredictions.map((prediction, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{prediction.resource}</h4>
                <Badge variant="outline">
                  {prediction.confidence}% confidence
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-sm text-muted-foreground">Current Usage</div>
                  <div className="text-lg font-bold">{prediction.currentUsage}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Predicted Usage</div>
                  <div className="text-lg font-bold flex items-center gap-1">
                    {prediction.predictedUsage}%
                    {prediction.predictedUsage > prediction.currentUsage ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                Time to capacity: {prediction.timeToCapacity} hours
              </div>
              
              <div className="text-sm bg-muted p-2 rounded">
                {prediction.recommendation}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Predictive Analytics Panel
  const PredictiveAnalyticsPanel: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Predictive Analytics
        </CardTitle>
        <CardDescription>ML-powered scaling predictions and insights</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scaling Recommendation</AlertTitle>
            <AlertDescription>
              Based on current trends, consider scaling up web servers by 40% 
              in the next 6 hours to maintain optimal performance.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded">
              <div className="text-sm text-muted-foreground">Predicted Peak Load</div>
              <div className="text-xl font-bold">15:30 GMT</div>
            </div>
            <div className="p-3 border rounded">
              <div className="text-sm text-muted-foreground">Confidence Level</div>
              <div className="text-xl font-bold text-green-600">94%</div>
            </div>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceHistory.slice(-12)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="throughput" 
                  stroke="#3b82f6"