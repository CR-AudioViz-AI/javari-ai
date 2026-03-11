'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  BarChart,
  Bar
} from 'recharts';
import {
  Play,
  Pause,
  Square,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Settings,
  History,
  Zap,
  RotateCcw,
  Eye,
  EyeOff,
  Shield,
  TrendingUp,
  Server,
  AlertCircle,
  RefreshCw,
  GitBranch
} from 'lucide-react';

interface DeploymentStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'paused' | 'cancelled';
  progress: number;
  environment: string;
  version: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  steps: DeploymentStep[];
}

interface DeploymentStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  logs: string[];
  error?: string;
}

interface HealthMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  errors: number;
  warnings: number;
  uptime: number;
}

interface DeploymentConfig {
  autoDeployEnabled: boolean;
  rollbackOnFailure: boolean;
  parallelDeployments: number;
  healthCheckTimeout: number;
  retryAttempts: number;
  notificationChannels: string[];
}

interface DeploymentHistory {
  timestamp: Date;
  deployments: number;
  success: number;
  failures: number;
  duration: number;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  deploymentId?: string;
}

interface AutonomousDeploymentControlProps {
  deployments?: DeploymentStatus[];
  healthMetrics?: HealthMetrics;
  config?: DeploymentConfig;
  history?: DeploymentHistory[];
  logs?: LogEntry[];
  onStart?: (deploymentId: string) => Promise<void>;
  onPause?: (deploymentId: string) => Promise<void>;
  onStop?: (deploymentId: string) => Promise<void>;
  onRollback?: (deploymentId: string, version: string) => Promise<void>;
  onConfigUpdate?: (config: DeploymentConfig) => Promise<void>;
  onEmergencyStop?: () => Promise<void>;
  className?: string;
}

const DeploymentStatusPanel: React.FC<{
  deployments: DeploymentStatus[];
  onStart: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
}> = ({ deployments, onStart, onPause, onStop }) => {
  const getStatusIcon = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Active Deployments
        </CardTitle>
        <CardDescription>
          Monitor and control autonomous deployment processes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deployments.map((deployment) => (
          <div key={deployment.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(deployment.status)}
                <span className="font-medium">{deployment.name}</span>
                <Badge variant="outline">{deployment.environment}</Badge>
                <Badge variant="secondary">v{deployment.version}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStart(deployment.id)}
                  disabled={deployment.status === 'running'}
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPause(deployment.id)}
                  disabled={deployment.status !== 'running'}
                >
                  <Pause className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onStop(deployment.id)}
                >
                  <Square className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{deployment.progress}%</span>
              </div>
              <Progress value={deployment.progress} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Started</Label>
                <div>{deployment.startedAt.toLocaleTimeString()}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Duration</Label>
                <div>{deployment.duration ? `${deployment.duration}s` : '-'}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Steps</Label>
                <div>
                  {deployment.steps.filter(s => s.status === 'success').length} / {deployment.steps.length}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {deployment.steps.map((step) => (
                <div
                  key={step.id}
                  className={`h-2 w-8 rounded-sm ${getStatusColor(step.status)}`}
                  title={`${step.name}: ${step.status}`}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const OverrideControlsPanel: React.FC<{
  onEmergencyStop: () => Promise<void>;
  config: DeploymentConfig;
  onConfigUpdate: (config: DeploymentConfig) => Promise<void>;
}> = ({ onEmergencyStop, config, onConfigUpdate }) => {
  const [emergencyConfirm, setEmergencyConfirm] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  const handleEmergencyStop = async () => {
    if (emergencyConfirm) {
      await onEmergencyStop();
      setEmergencyConfirm(false);
    } else {
      setEmergencyConfirm(true);
      setTimeout(() => setEmergencyConfirm(false), 5000);
    }
  };

  const handleConfigSave = async () => {
    await onConfigUpdate(localConfig);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Manual Override Controls
        </CardTitle>
        <CardDescription>
          Emergency controls and autonomous deployment settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant={emergencyConfirm ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Emergency Stop</AlertTitle>
          <AlertDescription className="mb-3">
            {emergencyConfirm 
              ? "Click again to confirm emergency stop of all deployments"
              : "Immediately halt all active deployments across all environments"
            }
          </AlertDescription>
          <Button
            variant="destructive"
            onClick={handleEmergencyStop}
            className={emergencyConfirm ? "animate-pulse" : ""}
          >
            <Zap className="h-4 w-4 mr-2" />
            {emergencyConfirm ? "CONFIRM EMERGENCY STOP" : "Emergency Stop"}
          </Button>
        </Alert>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Autonomous Settings
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-deploy">Auto Deploy</Label>
              <Switch
                id="auto-deploy"
                checked={localConfig.autoDeployEnabled}
                onCheckedChange={(checked) =>
                  setLocalConfig(prev => ({ ...prev, autoDeployEnabled: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-rollback">Auto Rollback</Label>
              <Switch
                id="auto-rollback"
                checked={localConfig.rollbackOnFailure}
                onCheckedChange={(checked) =>
                  setLocalConfig(prev => ({ ...prev, rollbackOnFailure: checked }))
                }
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parallel-deployments">Parallel Deployments</Label>
              <Input
                id="parallel-deployments"
                type="number"
                value={localConfig.parallelDeployments}
                onChange={(e) =>
                  setLocalConfig(prev => ({ 
                    ...prev, 
                    parallelDeployments: parseInt(e.target.value) 
                  }))
                }
                min="1"
                max="10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="health-timeout">Health Check Timeout (s)</Label>
              <Input
                id="health-timeout"
                type="number"
                value={localConfig.healthCheckTimeout}
                onChange={(e) =>
                  setLocalConfig(prev => ({ 
                    ...prev, 
                    healthCheckTimeout: parseInt(e.target.value) 
                  }))
                }
                min="10"
                max="300"
              />
            </div>
          </div>
          
          <Button onClick={handleConfigSave} className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DeploymentHistoryChart: React.FC<{
  history: DeploymentHistory[];
}> = ({ history }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Deployment History
        </CardTitle>
        <CardDescription>
          Success rates and performance trends over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="success"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  name="Successful"
                />
                <Area
                  type="monotone"
                  dataKey="failures"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="#3b82f6"
                  name="Avg Duration (s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const HealthMetricsDisplay: React.FC<{
  metrics: HealthMetrics;
}> = ({ metrics }) => {
  const getMetricColor = (value: number) => {
    if (value < 50) return 'text-green-500';
    if (value < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getMetricBg = (value: number) => {
    if (value < 50) return 'bg-green-500';
    if (value < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          System Health
        </CardTitle>
        <CardDescription>
          Real-time infrastructure and deployment pipeline health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                CPU
              </Label>
              <span className={`font-mono ${getMetricColor(metrics.cpu)}`}>
                {metrics.cpu}%
              </span>
            </div>
            <Progress value={metrics.cpu} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Memory
              </Label>
              <span className={`font-mono ${getMetricColor(metrics.memory)}`}>
                {metrics.memory}%
              </span>
            </div>
            <Progress value={metrics.memory} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Disk</Label>
              <span className={`font-mono ${getMetricColor(metrics.disk)}`}>
                {metrics.disk}%
              </span>
            </div>
            <Progress value={metrics.disk} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Network</Label>
              <span className={`font-mono ${getMetricColor(metrics.network)}`}>
                {metrics.network}%
              </span>
            </div>
            <Progress value={metrics.network} className="h-2" />
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-red-500">{metrics.errors}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-yellow-500">{metrics.warnings}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-500">{Math.floor(metrics.uptime / 3600)}h</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LogStreamViewer: React.FC<{
  logs: LogEntry[];
}> = ({ logs }) => {
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLogs = logs.filter(log => {
    const matchesText = log.message.toLowerCase().includes(filter.toLowerCase()) ||
                       log.source.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesText && matchesLevel;
  });

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Live Deployment Logs
        </CardTitle>
        <CardDescription>
          Real-time log stream from deployment processes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        
        <ScrollArea className="h-96 border rounded-md p-4 bg-muted/20">
          <div className="space-y-1 font-mono text-sm">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-muted-foreground whitespace-nowrap">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={`font-medium ${getLevelColor(log.level)} uppercase text-xs`}>
                  {log.level}
                </span>
                <span className="text-muted-foreground">
                  [{log.source}]
                </span>
                <span className="flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const RollbackControls: React.FC<{
  deployments: DeploymentStatus[];
  onRollback: (deploymentId: string, version: string) => Promise<void>;
}> = ({ deployments, onRollback }) => {
  const [selectedDeployment, setSelectedDeployment] = useState('');
  const [rollbackVersion, setR