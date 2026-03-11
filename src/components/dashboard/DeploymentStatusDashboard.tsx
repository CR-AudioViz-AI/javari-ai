'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Database,
  Wifi,
  XCircle,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Eye,
  Filter,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface DeploymentStatus {
  id: string;
  name: string;
  version: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: string;
  endTime?: string;
  environment: 'development' | 'staging' | 'production';
  triggeredBy: string;
  services: ServiceStatus[];
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  responseTime: number;
  errorRate: number;
}

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  requests: number;
  errors: number;
}

interface DecisionLog {
  id: string;
  timestamp: string;
  type: 'deployment' | 'scaling' | 'rollback' | 'alert';
  decision: string;
  reasoning: string;
  confidence: number;
  outcome: 'success' | 'failure' | 'pending';
  metadata: Record<string, any>;
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  source: string;
}

interface DeploymentStatusDashboardProps {
  refreshInterval?: number;
  maxLogEntries?: number;
  enableRealTime?: boolean;
  className?: string;
}

const statusColors = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500'
};

const healthColors = {
  healthy: 'text-green-500',
  warning: 'text-yellow-500',
  critical: 'text-red-500',
  offline: 'text-gray-500'
};

const severityColors = {
  low: 'border-blue-200 bg-blue-50',
  medium: 'border-yellow-200 bg-yellow-50',
  high: 'border-orange-200 bg-orange-50',
  critical: 'border-red-200 bg-red-50'
};

// Mock data generators
const generateMockDeployments = (): DeploymentStatus[] => [
  {
    id: 'dep-001',
    name: 'CR AudioViz AI Core',
    version: 'v2.3.1',
    status: 'running',
    progress: 75,
    startTime: new Date(Date.now() - 300000).toISOString(),
    environment: 'production',
    triggeredBy: 'automated-pipeline',
    services: [
      { name: 'API Gateway', status: 'healthy', uptime: 99.9, responseTime: 45, errorRate: 0.01 },
      { name: 'Audio Engine', status: 'healthy', uptime: 99.8, responseTime: 120, errorRate: 0.02 },
      { name: 'Database', status: 'warning', uptime: 99.5, responseTime: 80, errorRate: 0.05 }
    ]
  },
  {
    id: 'dep-002',
    name: 'Dashboard UI',
    version: 'v1.8.2',
    status: 'completed',
    progress: 100,
    startTime: new Date(Date.now() - 600000).toISOString(),
    endTime: new Date(Date.now() - 300000).toISOString(),
    environment: 'staging',
    triggeredBy: 'john.doe@company.com',
    services: [
      { name: 'Frontend', status: 'healthy', uptime: 100, responseTime: 35, errorRate: 0.00 },
      { name: 'CDN', status: 'healthy', uptime: 99.99, responseTime: 25, errorRate: 0.00 }
    ]
  }
];

const generateMockMetrics = (): SystemMetrics[] => {
  const data = [];
  for (let i = 23; i >= 0; i--) {
    data.push({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      cpu: Math.random() * 80 + 10,
      memory: Math.random() * 70 + 20,
      disk: Math.random() * 40 + 30,
      network: Math.random() * 100,
      requests: Math.floor(Math.random() * 1000) + 500,
      errors: Math.floor(Math.random() * 10)
    });
  }
  return data;
};

const generateMockDecisionLogs = (): DecisionLog[] => [
  {
    id: 'log-001',
    timestamp: new Date().toISOString(),
    type: 'scaling',
    decision: 'Scale up audio processing pods',
    reasoning: 'CPU utilization exceeded 80% threshold for 5 minutes. Historical data shows traffic increase during peak hours.',
    confidence: 0.95,
    outcome: 'success',
    metadata: { targetReplicas: 5, currentReplicas: 3 }
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    type: 'deployment',
    decision: 'Proceed with production deployment',
    reasoning: 'All pre-deployment checks passed. Staging environment shows 99.9% success rate over 24h test period.',
    confidence: 0.88,
    outcome: 'pending',
    metadata: { version: 'v2.3.1', environment: 'production' }
  }
];

const generateMockAlerts = (): Alert[] => [
  {
    id: 'alert-001',
    severity: 'high',
    title: 'High Memory Usage',
    message: 'Database server memory usage at 92%. Consider scaling or optimization.',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    status: 'active',
    source: 'monitoring-system'
  },
  {
    id: 'alert-002',
    severity: 'medium',
    title: 'Deployment Warning',
    message: 'Deployment taking longer than expected. Current progress: 75%',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    status: 'acknowledged',
    source: 'deployment-pipeline'
  }
];

// Sub-components
const StatusIndicator: React.FC<{
  status: DeploymentStatus['status'];
  size?: 'sm' | 'md' | 'lg';
}> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <div
      className={cn(
        'rounded-full animate-pulse',
        statusColors[status],
        sizeClasses[size]
      )}
      aria-label={`Status: ${status}`}
    />
  );
};

const DeploymentProgressCard: React.FC<{ deployment: DeploymentStatus }> = ({
  deployment
}) => {
  const duration = deployment.endTime
    ? new Date(deployment.endTime).getTime() - new Date(deployment.startTime).getTime()
    : Date.now() - new Date(deployment.startTime).getTime();

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{deployment.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{deployment.environment}</Badge>
            <StatusIndicator status={deployment.status} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Version {deployment.version} • {Math.floor(duration / 60000)}m ago
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{deployment.progress}%</span>
            </div>
            <Progress value={deployment.progress} className="h-2" />
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {deployment.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', 
                    service.status === 'healthy' ? 'bg-green-500' :
                    service.status === 'warning' ? 'bg-yellow-500' :
                    service.status === 'critical' ? 'bg-red-500' : 'bg-gray-500'
                  )} />
                  <span>{service.name}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{service.uptime}%</span>
                  <span>{service.responseTime}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SystemHealthMetrics: React.FC<{ metrics: SystemMetrics[] }> = ({ metrics }) => {
  const latestMetrics = metrics[metrics.length - 1];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPU Usage</span>
                <span>{latestMetrics?.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics?.cpu} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Memory</span>
                <span>{latestMetrics?.memory.toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics?.memory} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Disk</span>
                <span>{latestMetrics?.disk.toFixed(1)}%</span>
              </div>
              <Progress value={latestMetrics?.disk} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metrics.slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              />
              <Line 
                type="monotone" 
                dataKey="cpu" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="CPU"
              />
              <Line 
                type="monotone" 
                dataKey="memory" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Memory"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

const DecisionLogsPanel: React.FC<{ logs: DecisionLog[] }> = ({ logs }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          AI Decision Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.type === 'deployment' ? 'default' : 'secondary'}>
                      {log.type}
                    </Badge>
                    <span className="text-sm font-medium">{log.decision}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {log.confidence * 100}%
                    </span>
                    <Badge 
                      variant={
                        log.outcome === 'success' ? 'default' :
                        log.outcome === 'failure' ? 'destructive' : 'secondary'
                      }
                    >
                      {log.outcome}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{log.reasoning}</p>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const AlertsPanel: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const activeAlerts = alerts.filter(alert => alert.status === 'active');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Active Alerts ({activeAlerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
              No active alerts
            </div>
          ) : (
            activeAlerts.map((alert) => (
              <Alert key={alert.id} className={severityColors[alert.severity]}>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle className="flex items-center justify-between">
                  {alert.title}
                  <Badge variant="outline">{alert.severity}</Badge>
                </AlertTitle>
                <AlertDescription>
                  {alert.message}
                  <div className="text-xs mt-1 opacity-70">
                    {new Date(alert.timestamp).toLocaleString()} • {alert.source}
                  </div>
                </AlertDescription>
              </Alert>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main component
const DeploymentStatusDashboard: React.FC<DeploymentStatusDashboardProps> = ({
  refreshInterval = 5000,
  maxLogEntries = 50,
  enableRealTime = true,
  className
}) => {
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Initialize mock data
  useEffect(() => {
    setDeployments(generateMockDeployments());
    setMetrics(generateMockMetrics());
    setDecisionLogs(generateMockDecisionLogs());
    setAlerts(generateMockAlerts());
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    if (!enableRealTime) return;

    const interval = setInterval(() => {
      // Update metrics
      setMetrics(prev => {
        const newMetric: SystemMetrics = {
          timestamp: new Date().toISOString(),
          cpu: Math.random() * 80 + 10,
          memory: Math.random() * 70 + 20,
          disk: Math.random() * 40 + 30,
          network: Math.random() * 100,
          requests: Math.floor(Math.random() * 1000) + 500,
          errors: Math.floor(Math.random() * 10)
        };
        return [...prev.slice(-23), newMetric];
      });

      // Update deployment progress
      setDeployments(prev => prev.map(dep => 
        dep.status === 'running' 
          ? { ...dep, progress: Math.min(100, dep.progress + Math.random() * 5) }
          : dep
      ));

      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enableRealTime, refreshInterval]);

  const systemHealthScore = useMemo(() => {
    if (metrics.length === 0) return 100;
    const latest = metrics[metrics.length - 1];
    const avgUsage = (latest.cpu + latest.memory + latest.disk) / 3;
    return Math.max(0, 100 - avgUsage);
  }, [metrics]);

  const runningDeployments = deployments.filter(d => d.status === 'running').length;
  const totalActiveAlerts = alerts.filter(a => a.status === 'active').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployment Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time system monitoring and deployment tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <Badge variant="outline">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Badge>
          <Button size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Deployments</p>
                <p className="text-2xl font-bold">{runningDeployments}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Health</p>
                <p className="text-2xl font-bold">{systemHealthScore.toFixed(0)}%</p>
              </div>
              <Activity className={cn(
                'w-8 h-8',
                systemHealthScore > 80 ? 'text-green-500' :
                systemHealthScore > 60 ? 'text-yellow-500' : 'text-red-500'
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{totalActiveAlerts}</p>
              </div>
              <AlertTriangle className={cn(
                'w-8 h-8',
                totalActiveAlerts === 0 ? 'text-green-500' :
                totalActiveAlerts