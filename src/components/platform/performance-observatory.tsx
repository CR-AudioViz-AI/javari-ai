```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Server,
  Database,
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  LineChart,
  Gauge,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  Zap,
  RefreshCw,
  Settings,
  Bell,
  Eye,
  Filter
} from 'lucide-react';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  change: number;
  threshold: {
    warning: number;
    critical: number;
  };
  timestamp: Date;
}

interface ScalingEvent {
  id: string;
  service: string;
  action: 'scale_up' | 'scale_down';
  reason: string;
  from: number;
  to: number;
  timestamp: Date;
  duration: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface InfrastructureNode {
  id: string;
  name: string;
  type: 'server' | 'database' | 'load_balancer' | 'cache';
  status: 'healthy' | 'degraded' | 'down';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  location: {
    region: string;
    zone: string;
  };
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  service: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

interface NetworkLatency {
  source: string;
  target: string;
  latency: number;
  status: 'good' | 'degraded' | 'poor';
}

interface DatabaseMetric {
  database: string;
  connections: number;
  queries_per_second: number;
  slow_queries: number;
  cache_hit_ratio: number;
  disk_usage: number;
  replication_lag: number;
}

interface PerformanceObservatoryProps {
  className?: string;
  refreshInterval?: number;
  enableRealtime?: boolean;
  onAlertAcknowledge?: (alertId: string) => void;
  onScalingTrigger?: (service: string, direction: 'up' | 'down') => void;
}

const PerformanceObservatory: React.FC<PerformanceObservatoryProps> = ({
  className,
  refreshInterval = 30000,
  enableRealtime = true,
  onAlertAcknowledge,
  onScalingTrigger
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(enableRealtime);
  const [selectedView, setSelectedView] = useState('overview');
  const [filterSeverity, setFilterSeverity] = useState('all');
  
  // Mock data - in real implementation, this would come from APIs/WebSockets
  const [metrics] = useState<PerformanceMetric[]>([
    {
      id: '1',
      name: 'CPU Usage',
      value: 67,
      unit: '%',
      status: 'warning',
      trend: 'up',
      change: 12,
      threshold: { warning: 70, critical: 90 },
      timestamp: new Date()
    },
    {
      id: '2',
      name: 'Memory Usage',
      value: 82,
      unit: '%',
      status: 'warning',
      trend: 'up',
      change: 8,
      threshold: { warning: 80, critical: 95 },
      timestamp: new Date()
    },
    {
      id: '3',
      name: 'Response Time',
      value: 245,
      unit: 'ms',
      status: 'healthy',
      trend: 'stable',
      change: -2,
      threshold: { warning: 500, critical: 1000 },
      timestamp: new Date()
    },
    {
      id: '4',
      name: 'Throughput',
      value: 1420,
      unit: 'req/s',
      status: 'healthy',
      trend: 'up',
      change: 15,
      threshold: { warning: 1000, critical: 500 },
      timestamp: new Date()
    }
  ]);

  const [scalingEvents] = useState<ScalingEvent[]>([
    {
      id: '1',
      service: 'api-gateway',
      action: 'scale_up',
      reason: 'High CPU usage detected',
      from: 3,
      to: 5,
      timestamp: new Date(Date.now() - 300000),
      duration: 45,
      status: 'completed'
    },
    {
      id: '2',
      service: 'worker-pool',
      action: 'scale_down',
      reason: 'Low traffic period',
      from: 8,
      to: 5,
      timestamp: new Date(Date.now() - 600000),
      duration: 30,
      status: 'completed'
    }
  ]);

  const [infrastructure] = useState<InfrastructureNode[]>([
    {
      id: '1',
      name: 'web-01',
      type: 'server',
      status: 'healthy',
      cpu: 45,
      memory: 67,
      disk: 34,
      network: 78,
      location: { region: 'us-east-1', zone: 'a' }
    },
    {
      id: '2',
      name: 'db-primary',
      type: 'database',
      status: 'degraded',
      cpu: 89,
      memory: 78,
      disk: 92,
      network: 45,
      location: { region: 'us-east-1', zone: 'b' }
    },
    {
      id: '3',
      name: 'cache-01',
      type: 'cache',
      status: 'healthy',
      cpu: 23,
      memory: 56,
      disk: 12,
      network: 89,
      location: { region: 'us-west-2', zone: 'a' }
    }
  ]);

  const [alerts] = useState<Alert[]>([
    {
      id: '1',
      severity: 'critical',
      title: 'High Database CPU Usage',
      message: 'Database CPU usage has exceeded 85% for the past 10 minutes',
      service: 'postgresql',
      metric: 'cpu_usage',
      value: 89,
      threshold: 85,
      timestamp: new Date(Date.now() - 120000),
      acknowledged: false
    },
    {
      id: '2',
      severity: 'warning',
      title: 'Memory Usage Warning',
      message: 'Memory usage approaching threshold on web-01',
      service: 'web-01',
      metric: 'memory_usage',
      value: 82,
      threshold: 80,
      timestamp: new Date(Date.now() - 300000),
      acknowledged: false
    }
  ]);

  const [networkLatency] = useState<NetworkLatency[]>([
    { source: 'us-east-1', target: 'us-west-2', latency: 78, status: 'good' },
    { source: 'us-east-1', target: 'eu-west-1', latency: 156, status: 'degraded' },
    { source: 'us-west-2', target: 'ap-south-1', latency: 234, status: 'poor' }
  ]);

  const [databaseMetrics] = useState<DatabaseMetric[]>([
    {
      database: 'main_db',
      connections: 45,
      queries_per_second: 1240,
      slow_queries: 3,
      cache_hit_ratio: 98.5,
      disk_usage: 67,
      replication_lag: 0.2
    },
    {
      database: 'analytics_db',
      connections: 23,
      queries_per_second: 560,
      slow_queries: 8,
      cache_hit_ratio: 94.2,
      disk_usage: 89,
      replication_lag: 1.5
    }
  ]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        // Refresh data
        console.log('Refreshing performance data...');
      }, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
      case 'down':
      case 'poor':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'server':
        return <Server className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'load_balancer':
        return <Network className="h-4 w-4" />;
      case 'cache':
        return <MemoryStick className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const filteredAlerts = useMemo(() => {
    if (filterSeverity === 'all') return alerts;
    return alerts.filter(alert => alert.severity === filterSeverity);
  }, [alerts, filterSeverity]);

  const MetricsOverviewGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric) => (
        <Card key={metric.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            {getStatusIcon(metric.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metric.value}{metric.unit}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {getTrendIcon(metric.trend)}
              <span className="ml-1">
                {metric.change > 0 ? '+' : ''}{metric.change}% from last hour
              </span>
            </div>
            <Progress 
              value={metric.value} 
              className="mt-2"
              aria-label={`${metric.name} progress`}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const RealTimePerformanceChart = () => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Real-Time Performance</CardTitle>
            <CardDescription>Live system metrics over time</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="6h">6h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <LineChart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-muted/20 rounded-md flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2" />
            <p>Performance chart visualization</p>
            <p className="text-xs">Real-time data streaming active</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ResourceUtilizationPanel = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Resource Utilization</CardTitle>
        <CardDescription>Current system resource usage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4" />
                <span className="text-sm font-medium">CPU</span>
              </div>
              <span className="text-sm text-muted-foreground">67%</span>
            </div>
            <Progress value={67} className="h-2" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MemoryStick className="h-4 w-4" />
                <span className="text-sm font-medium">Memory</span>
              </div>
              <span className="text-sm text-muted-foreground">82%</span>
            </div>
            <Progress value={82} className="h-2" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm font-medium">Disk</span>
              </div>
              <span className="text-sm text-muted-foreground">45%</span>
            </div>
            <Progress value={45} className="h-2" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm font-medium">Network</span>
              </div>
              <span className="text-sm text-muted-foreground">78%</span>
            </div>
            <Progress value={78} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ScalingEventsTimeline = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Auto-Scaling Events</CardTitle>
        <CardDescription>Recent scaling activities</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-4">
            {scalingEvents.map((event) => (
              <div key={event.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                <div className="flex-shrink-0">
                  {event.action === 'scale_up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.service} scaled {event.action.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.reason} • {event.from} → {event.to} instances
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const InfrastructureHealthMap = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Infrastructure Health</CardTitle>
        <CardDescription>System components status overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {infrastructure.map((node) => (
            <div key={node.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getNodeIcon(node.type)}
                  <span className="font-medium">{node.name}</span>
                </div>
                {getStatusIcon(node.status)}
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>CPU</span>
                  <span>{node.cpu}%</span>
                </div>
                <Progress value={node.cpu} className="h-1" />
                
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span>{node.memory}%</span>
                </div>
                <Progress value={node.memory} className="h-1" />
                
                <div className="text-xs text-muted-foreground mt-2">
                  {node.location.region} • {node.location.zone}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const AlertsAndNotifications = () => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Alerts</CardTitle>
            <CardDescription>System alerts and notifications</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  {alert.severity === 'critical' && <XCircle className="h-4 w-4 text-red-500" />}
                  {alert.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {alert.severity === 'info' && <CheckCircle className="h-4 w-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {alert.service} • {alert.value}{alert.metric === 'cpu_usage' ? '%' : 'ms'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAlertAcknowledge?.(alert.id)}
                      className="h-6 px-2 text-xs"
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Acknowledge
                    </Button>
                  </div>
                </div>