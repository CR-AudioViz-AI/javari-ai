'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  ReferenceLine
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Download,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  Settings,
  TrendingUp,
  TrendingDown,
  Wifi,
  Clock,
  Zap,
  Eye,
  Filter,
  RefreshCw,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format, subHours, subDays, isWithinInterval } from 'date-fns';

interface PerformanceMetric {
  id: string;
  timestamp: Date;
  metricType: 'cpu' | 'memory' | 'disk' | 'network' | 'database' | 'api_latency' | 'concurrent_users';
  value: number;
  threshold: number;
  unit: string;
  node: string;
  region: string;
}

interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  database: number;
  apiLatency: number;
}

interface Bottleneck {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendation: string;
  affectedNodes: string[];
  detectedAt: Date;
}

interface CapacityRecommendation {
  id: string;
  resource: string;
  currentUtilization: number;
  projectedGrowth: number;
  timeToCapacity: string;
  recommendedAction: string;
  priority: 'low' | 'medium' | 'high';
}

interface Alert {
  id: string;
  type: 'performance' | 'capacity' | 'health' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  source: string;
}

interface DrillDownData {
  type: 'metric' | 'bottleneck' | 'capacity';
  title: string;
  data: any;
  timeRange: string;
}

interface PerformanceAnalyticsDashboardProps {
  refreshInterval?: number;
  defaultTimeRange?: string;
  enableRealTime?: boolean;
  onMetricThresholdUpdate?: (metricType: string, threshold: number) => void;
  onExportData?: (format: 'csv' | 'json' | 'pdf') => void;
  className?: string;
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#22c55e',
  muted: '#6b7280'
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function PerformanceAnalyticsDashboard({
  refreshInterval = 30000,
  defaultTimeRange = '24h',
  enableRealTime = true,
  onMetricThresholdUpdate,
  onExportData,
  className = ''
}: PerformanceAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState(defaultTimeRange);
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(enableRealTime);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Mock data - replace with real data fetching
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus>({
    overall: 'healthy',
    cpu: 45,
    memory: 62,
    disk: 34,
    network: 28,
    database: 71,
    apiLatency: 156
  });
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [capacityRecommendations, setCapacityRecommendations] = useState<CapacityRecommendation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Generate mock data
  useEffect(() => {
    const generateMockMetrics = () => {
      const now = new Date();
      const mockMetrics: PerformanceMetric[] = [];
      
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
        mockMetrics.push(
          {
            id: `cpu-${i}`,
            timestamp,
            metricType: 'cpu',
            value: 30 + Math.random() * 40,
            threshold: 80,
            unit: '%',
            node: 'node-1',
            region: 'us-east-1'
          },
          {
            id: `memory-${i}`,
            timestamp,
            metricType: 'memory',
            value: 40 + Math.random() * 30,
            threshold: 85,
            unit: '%',
            node: 'node-1',
            region: 'us-east-1'
          },
          {
            id: `api-${i}`,
            timestamp,
            metricType: 'api_latency',
            value: 100 + Math.random() * 200,
            threshold: 500,
            unit: 'ms',
            node: 'api-server',
            region: 'us-east-1'
          }
        );
      }
      setMetrics(mockMetrics);
    };

    const generateMockBottlenecks = () => {
      setBottlenecks([
        {
          id: 'btn-1',
          type: 'database',
          severity: 'medium',
          description: 'Database connection pool exhaustion',
          impact: 'Increased API response times',
          recommendation: 'Increase connection pool size to 50',
          affectedNodes: ['db-primary', 'api-server-1'],
          detectedAt: subHours(new Date(), 2)
        },
        {
          id: 'btn-2',
          type: 'memory',
          severity: 'high',
          description: 'Memory usage consistently above 80%',
          impact: 'Potential service degradation',
          recommendation: 'Scale up memory allocation',
          affectedNodes: ['worker-node-3'],
          detectedAt: subHours(new Date(), 1)
        }
      ]);
    };

    const generateMockCapacityRecommendations = () => {
      setCapacityRecommendations([
        {
          id: 'cap-1',
          resource: 'CPU Cores',
          currentUtilization: 72,
          projectedGrowth: 15,
          timeToCapacity: '3 weeks',
          recommendedAction: 'Add 4 CPU cores',
          priority: 'medium'
        },
        {
          id: 'cap-2',
          resource: 'Database Storage',
          currentUtilization: 85,
          projectedGrowth: 25,
          timeToCapacity: '1 week',
          recommendedAction: 'Expand storage by 500GB',
          priority: 'high'
        }
      ]);
    };

    const generateMockAlerts = () => {
      setAlerts([
        {
          id: 'alert-1',
          type: 'performance',
          severity: 'warning',
          title: 'High API Latency Detected',
          message: 'API response time exceeded 500ms threshold',
          timestamp: subHours(new Date(), 1),
          acknowledged: false,
          source: 'performance-monitor'
        },
        {
          id: 'alert-2',
          type: 'capacity',
          severity: 'error',
          title: 'Database Storage Critical',
          message: 'Database storage usage above 90%',
          timestamp: subHours(new Date(), 2),
          acknowledged: true,
          source: 'capacity-planner'
        }
      ]);
    };

    generateMockMetrics();
    generateMockBottlenecks();
    generateMockCapacityRecommendations();
    generateMockAlerts();
  }, []);

  // Real-time data refresh
  useEffect(() => {
    if (!isRealTimeEnabled) return;

    const interval = setInterval(() => {
      setLastUpdated(new Date());
      // Refresh data here
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, isRealTimeEnabled]);

  const filteredMetrics = useMemo(() => {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = subHours(now, 1);
        break;
      case '6h':
        startTime = subHours(now, 6);
        break;
      case '24h':
        startTime = subHours(now, 24);
        break;
      case '7d':
        startTime = subDays(now, 7);
        break;
      default:
        startTime = subHours(now, 24);
    }

    return metrics.filter(metric => 
      isWithinInterval(metric.timestamp, { start: startTime, end: now }) &&
      (selectedMetric === 'all' || metric.metricType === selectedMetric)
    );
  }, [metrics, timeRange, selectedMetric]);

  const chartData = useMemo(() => {
    const dataMap = new Map<string, any>();

    filteredMetrics.forEach(metric => {
      const timeKey = format(metric.timestamp, 'HH:mm');
      if (!dataMap.has(timeKey)) {
        dataMap.set(timeKey, { time: timeKey });
      }
      const data = dataMap.get(timeKey);
      data[metric.metricType] = metric.value;
    });

    return Array.from(dataMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredMetrics]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const handleDrillDown = (type: 'metric' | 'bottleneck' | 'capacity', title: string, data: any) => {
    setDrillDownData({ type, title, data, timeRange });
  };

  const MetricsOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemHealth.cpu}%</div>
          <Progress value={systemHealth.cpu} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Normal operating range
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemHealth.memory}%</div>
          <Progress value={systemHealth.memory} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Approaching threshold
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemHealth.disk}%</div>
          <Progress value={systemHealth.disk} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Optimal usage level
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Latency</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemHealth.apiLatency}ms</div>
          <div className="flex items-center mt-2">
            <TrendingDown className="h-4 w-4 text-green-600 mr-1" />
            <span className="text-sm text-green-600">-12% from last hour</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const PerformanceTrendChart = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Real-time system metrics over time</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1H</SelectItem>
                <SelectItem value="6h">6H</SelectItem>
                <SelectItem value="24h">24H</SelectItem>
                <SelectItem value="7d">7D</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
            >
              <Wifi className={`h-4 w-4 ${isRealTimeEnabled ? 'text-green-600' : 'text-gray-400'}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="cpu" 
              stroke={COLORS.primary} 
              strokeWidth={2}
              name="CPU %"
            />
            <Line 
              type="monotone" 
              dataKey="memory" 
              stroke={COLORS.secondary} 
              strokeWidth={2}
              name="Memory %"
            />
            <Line 
              type="monotone" 
              dataKey="api_latency" 
              stroke={COLORS.warning} 
              strokeWidth={2}
              name="API Latency (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const BottleneckAnalysis = () => (
    <Card>
      <CardHeader>
        <CardTitle>Bottleneck Analysis</CardTitle>
        <CardDescription>Current system bottlenecks and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bottlenecks.map((bottleneck) => (
            <div key={bottleneck.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant={getSeverityBadgeVariant(bottleneck.severity)}>
                      {bottleneck.severity.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {bottleneck.type.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-medium mb-1">{bottleneck.description}</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Impact:</strong> {bottleneck.impact}
                  </p>
                  <p className="text-sm text-green-600">
                    <strong>Recommendation:</strong> {bottleneck.recommendation}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Detected {format(bottleneck.detectedAt, 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDrillDown('bottleneck', bottleneck.description, bottleneck)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const CapacityPlanning = () => (
    <Card>
      <CardHeader>
        <CardTitle>Capacity Planning</CardTitle>
        <CardDescription>Resource utilization projections and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {capacityRecommendations.map((rec) => (
            <div key={rec.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium">{rec.resource}</h4>
                  <Badge variant={getSeverityBadgeVariant(rec.priority)}>
                    {rec.priority.toUpperCase()} PRIORITY
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{rec.currentUtilization}%</div>
                  <div className="text-sm text-muted-foreground">Current usage</div>
                </div>
              </div>
              <Progress value={rec.currentUtilization} className="mb-3" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Projected Growth:</span>
                  <span className="ml-2 font-medium">+{rec.projectedGrowth}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time to Capacity:</span>
                  <span className="ml-2 font-medium">{rec.timeToCapacity}</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded">
                <p className="text-sm">
                  <strong>Recommendation:</strong> {rec.recommendedAction}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const AlertsPanel = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>System alerts and notifications</CardDescription>
          </div>
          <Badge variant="outline">{alerts.filter(a => !a.acknowledged).length} Active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}