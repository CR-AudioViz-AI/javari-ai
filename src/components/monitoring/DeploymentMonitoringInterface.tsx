```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitBranch, 
  Monitor, 
  RefreshCw, 
  RotateCcw, 
  Server, 
  TrendingUp, 
  XCircle, 
  Zap,
  Filter,
  Download,
  Bell,
  Users,
  Database,
  Cpu
} from 'lucide-react';

interface DeploymentStatus {
  id: string;
  environment: string;
  version: string;
  status: 'pending' | 'deploying' | 'success' | 'failed' | 'rolling_back';
  progress: number;
  startTime: string;
  endTime?: string;
  branch: string;
  commit: string;
  deployedBy: string;
  healthScore: number;
  rollbackAvailable: boolean;
}

interface HealthCheck {
  id: string;
  deploymentId: string;
  service: string;
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  uptime: number;
  lastCheck: string;
  message: string;
}

interface PerformanceMetric {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

interface AlertNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface DeploymentMonitoringInterfaceProps {
  onDeploymentAction?: (action: string, deploymentId: string) => void;
  onAlertAcknowledge?: (alertId: string) => void;
  refreshInterval?: number;
  className?: string;
}

const mockDeployments: DeploymentStatus[] = [
  {
    id: '1',
    environment: 'production',
    version: 'v2.1.0',
    status: 'success',
    progress: 100,
    startTime: '2024-01-20T10:00:00Z',
    endTime: '2024-01-20T10:05:00Z',
    branch: 'main',
    commit: 'abc123f',
    deployedBy: 'john.doe',
    healthScore: 98,
    rollbackAvailable: true
  },
  {
    id: '2',
    environment: 'staging',
    version: 'v2.1.1-rc',
    status: 'deploying',
    progress: 65,
    startTime: '2024-01-20T10:30:00Z',
    branch: 'release/2.1.1',
    commit: 'def456a',
    deployedBy: 'jane.smith',
    healthScore: 95,
    rollbackAvailable: false
  },
  {
    id: '3',
    environment: 'development',
    version: 'v2.2.0-dev',
    status: 'failed',
    progress: 30,
    startTime: '2024-01-20T09:45:00Z',
    endTime: '2024-01-20T09:50:00Z',
    branch: 'feature/new-dashboard',
    commit: 'ghi789b',
    deployedBy: 'bob.wilson',
    healthScore: 45,
    rollbackAvailable: true
  }
];

const mockHealthChecks: HealthCheck[] = [
  {
    id: '1',
    deploymentId: '1',
    service: 'API Gateway',
    status: 'healthy',
    responseTime: 120,
    uptime: 99.9,
    lastCheck: '2024-01-20T10:35:00Z',
    message: 'All systems operational'
  },
  {
    id: '2',
    deploymentId: '1',
    service: 'Database',
    status: 'warning',
    responseTime: 450,
    uptime: 99.5,
    lastCheck: '2024-01-20T10:35:00Z',
    message: 'High response time detected'
  },
  {
    id: '3',
    deploymentId: '2',
    service: 'Redis Cache',
    status: 'healthy',
    responseTime: 5,
    uptime: 100,
    lastCheck: '2024-01-20T10:35:00Z',
    message: 'Cache performing optimally'
  }
];

const mockPerformanceData: PerformanceMetric[] = [
  { timestamp: '10:00', cpuUsage: 45, memoryUsage: 60, responseTime: 120, throughput: 850, errorRate: 0.1 },
  { timestamp: '10:05', cpuUsage: 52, memoryUsage: 65, responseTime: 135, throughput: 920, errorRate: 0.2 },
  { timestamp: '10:10', cpuUsage: 48, memoryUsage: 62, responseTime: 128, throughput: 890, errorRate: 0.1 },
  { timestamp: '10:15', cpuUsage: 55, memoryUsage: 68, responseTime: 145, throughput: 950, errorRate: 0.3 },
  { timestamp: '10:20', cpuUsage: 50, memoryUsage: 64, responseTime: 132, throughput: 880, errorRate: 0.2 },
  { timestamp: '10:25', cpuUsage: 47, memoryUsage: 61, responseTime: 125, throughput: 900, errorRate: 0.1 },
  { timestamp: '10:30', cpuUsage: 53, memoryUsage: 66, responseTime: 138, throughput: 940, errorRate: 0.2 }
];

const mockAlerts: AlertNotification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'High Response Time',
    message: 'Database response time exceeded 400ms threshold',
    timestamp: '2024-01-20T10:32:00Z',
    acknowledged: false
  },
  {
    id: '2',
    type: 'info',
    title: 'Deployment Complete',
    message: 'Production deployment v2.1.0 completed successfully',
    timestamp: '2024-01-20T10:05:00Z',
    acknowledged: true
  }
];

export function DeploymentMonitoringInterface({
  onDeploymentAction,
  onAlertAcknowledge,
  refreshInterval = 30000,
  className = ''
}: DeploymentMonitoringInterfaceProps) {
  const [deployments, setDeployments] = useState<DeploymentStatus[]>(mockDeployments);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>(mockHealthChecks);
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>(mockPerformanceData);
  const [alerts, setAlerts] = useState<AlertNotification[]>(mockAlerts);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [logFilter, setLogFilter] = useState('all');

  // Mock deployment logs
  const deploymentLogs: DeploymentLog[] = [
    {
      id: '1',
      deploymentId: '2',
      timestamp: '2024-01-20T10:35:00Z',
      level: 'info',
      message: 'Starting deployment to staging environment',
      source: 'deployment-controller'
    },
    {
      id: '2',
      deploymentId: '2',
      timestamp: '2024-01-20T10:35:30Z',
      level: 'info',
      message: 'Building application image',
      source: 'build-system'
    },
    {
      id: '3',
      deploymentId: '2',
      timestamp: '2024-01-20T10:36:00Z',
      level: 'warn',
      message: 'High memory usage during build process',
      source: 'build-system'
    }
  ];

  const refreshData = useCallback(() => {
    // Simulate real-time updates
    setDeployments(prev => prev.map(deployment => {
      if (deployment.status === 'deploying') {
        const newProgress = Math.min(deployment.progress + Math.random() * 10, 100);
        return {
          ...deployment,
          progress: newProgress,
          status: newProgress === 100 ? 'success' : 'deploying'
        };
      }
      return deployment;
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshData, refreshInterval]);

  const handleRollback = (deploymentId: string) => {
    onDeploymentAction?.('rollback', deploymentId);
    setDeployments(prev => prev.map(deployment => 
      deployment.id === deploymentId 
        ? { ...deployment, status: 'rolling_back', progress: 0 }
        : deployment
    ));
  };

  const handleAlertAcknowledge = (alertId: string) => {
    onAlertAcknowledge?.(alertId);
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      deploying: 'bg-blue-500',
      success: 'bg-green-500',
      failed: 'bg-red-500',
      rolling_back: 'bg-orange-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: Clock,
      deploying: RefreshCw,
      success: CheckCircle,
      failed: XCircle,
      rolling_back: RotateCcw
    };
    const Icon = icons[status as keyof typeof icons] || Clock;
    return <Icon className="h-4 w-4" />;
  };

  const filteredDeployments = selectedEnvironment === 'all' 
    ? deployments 
    : deployments.filter(d => d.environment === selectedEnvironment);

  const environments = Array.from(new Set(deployments.map(d => d.environment)));

  const EnvironmentStatusGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredDeployments.map((deployment) => (
        <Card key={deployment.id} className="relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {deployment.environment.toUpperCase()}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {deployment.version}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {deployment.branch} • {deployment.commit}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(deployment.status)}
                <Badge 
                  className={`${getStatusColor(deployment.status)} text-white`}
                  variant="secondary"
                >
                  {deployment.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              
              {deployment.status === 'deploying' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Progress</span>
                    <span>{deployment.progress}%</span>
                  </div>
                  <Progress value={deployment.progress} className="h-2" />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Health Score</span>
                <span className="font-medium">{deployment.healthScore}%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span>Deployed by: {deployment.deployedBy}</span>
                {deployment.rollbackAvailable && deployment.status === 'success' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will rollback the {deployment.environment} environment to the previous version. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRollback(deployment.id)}>
                          Rollback
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const HealthCheckPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Health Checks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {healthChecks.map((check) => (
            <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  check.status === 'healthy' ? 'bg-green-500' : 
                  check.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="font-medium">{check.service}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p>{check.responseTime}ms</p>
                <p className="text-xs text-muted-foreground">{check.uptime}% uptime</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const PerformanceMetricsChart = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="response-time" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="response-time">Response Time</TabsTrigger>
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>
          
          <TabsContent value="response-time" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="throughput" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="throughput" 
                  fill="#10b981" 
                  name="Requests/min"
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cpuUsage" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="CPU Usage (%)"
                />
                <Line 
                  type="monotone" 
                  dataKey="memoryUsage" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Memory Usage (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="errorRate" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Error Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const DeploymentLogViewer = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Deployment Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-2">
            {deploymentLogs
              .filter(log => logFilter === 'all' || log.level === logFilter)
              .map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded text-sm font-mono">
                  <Badge 
                    variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'default' : 'secondary'}
                    className="min-w-16 text-xs"
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground min-w-20">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-muted-foreground min-w-24">{log.source}</span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const AlertNotificationCenter = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alert Center
          {alerts.some(a => !a.acknowledged) && (
            <Badge variant="destructive" className="ml-2">
              {alerts.filter(a => !a.acknowledged).length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">