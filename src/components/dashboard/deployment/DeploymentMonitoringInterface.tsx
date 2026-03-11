```tsx
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  GitBranch, 
  HardDrive, 
  Memory, 
  Network, 
  Play, 
  Pause, 
  RotateCcw, 
  Server, 
  TrendingUp, 
  X, 
  Zap 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface DeploymentEvent {
  id: string;
  environment: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  pipeline: string;
  branch: string;
  commit: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  triggeredBy: string;
  logs?: string[];
}

interface MetricDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface ResourceMetrics {
  cpu: {
    usage: number;
    limit: number;
    history: MetricDataPoint[];
  };
  memory: {
    usage: number;
    limit: number;
    history: MetricDataPoint[];
  };
  storage: {
    usage: number;
    limit: number;
    history: MetricDataPoint[];
  };
  network: {
    inbound: number;
    outbound: number;
    history: MetricDataPoint[];
  };
}

interface Environment {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  version: string;
  lastDeployment: string;
  uptime: number;
  resources: ResourceMetrics;
}

interface PipelineStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  stage: string;
  progress: number;
  duration: number;
  environment: string;
}

interface DeploymentAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  environment: string;
}

interface DeploymentMonitoringInterfaceProps {
  className?: string;
  refreshInterval?: number;
  onDeploymentClick?: (deployment: DeploymentEvent) => void;
  onEnvironmentClick?: (environment: Environment) => void;
  onAlertAcknowledge?: (alertId: string) => void;
}

// Mock data generators
const generateMockDeployments = (): DeploymentEvent[] => [
  {
    id: '1',
    environment: 'production',
    status: 'running',
    pipeline: 'main-deploy',
    branch: 'main',
    commit: 'abc1234',
    startTime: new Date(Date.now() - 300000).toISOString(),
    triggeredBy: 'john.doe@example.com'
  },
  {
    id: '2',
    environment: 'staging',
    status: 'success',
    pipeline: 'feature-deploy',
    branch: 'feature/new-ui',
    commit: 'def5678',
    startTime: new Date(Date.now() - 600000).toISOString(),
    endTime: new Date(Date.now() - 300000).toISOString(),
    duration: 300,
    triggeredBy: 'jane.smith@example.com'
  },
  {
    id: '3',
    environment: 'development',
    status: 'failed',
    pipeline: 'test-deploy',
    branch: 'hotfix/critical-bug',
    commit: 'ghi9012',
    startTime: new Date(Date.now() - 900000).toISOString(),
    endTime: new Date(Date.now() - 600000).toISOString(),
    duration: 180,
    triggeredBy: 'bob.johnson@example.com'
  }
];

const generateMockEnvironments = (): Environment[] => [
  {
    id: 'prod',
    name: 'Production',
    status: 'healthy',
    version: 'v1.2.3',
    lastDeployment: new Date(Date.now() - 3600000).toISOString(),
    uptime: 99.9,
    resources: {
      cpu: { usage: 45, limit: 100, history: [] },
      memory: { usage: 68, limit: 100, history: [] },
      storage: { usage: 23, limit: 100, history: [] },
      network: { inbound: 120, outbound: 89, history: [] }
    }
  },
  {
    id: 'staging',
    name: 'Staging',
    status: 'warning',
    version: 'v1.3.0-beta.1',
    lastDeployment: new Date(Date.now() - 1800000).toISOString(),
    uptime: 98.5,
    resources: {
      cpu: { usage: 78, limit: 100, history: [] },
      memory: { usage: 82, limit: 100, history: [] },
      storage: { usage: 34, limit: 100, history: [] },
      network: { inbound: 45, outbound: 67, history: [] }
    }
  },
  {
    id: 'dev',
    name: 'Development',
    status: 'error',
    version: 'v1.3.0-alpha.5',
    lastDeployment: new Date(Date.now() - 7200000).toISOString(),
    uptime: 95.2,
    resources: {
      cpu: { usage: 12, limit: 100, history: [] },
      memory: { usage: 28, limit: 100, history: [] },
      storage: { usage: 67, limit: 100, history: [] },
      network: { inbound: 8, outbound: 12, history: [] }
    }
  }
];

const generateMockPipelines = (): PipelineStatus[] => [
  {
    id: 'p1',
    name: 'Production Deploy',
    status: 'running',
    stage: 'Testing',
    progress: 65,
    duration: 420,
    environment: 'production'
  },
  {
    id: 'p2',
    name: 'Staging Deploy',
    status: 'success',
    stage: 'Complete',
    progress: 100,
    duration: 280,
    environment: 'staging'
  },
  {
    id: 'p3',
    name: 'Development Deploy',
    status: 'failed',
    stage: 'Build',
    progress: 25,
    duration: 45,
    environment: 'development'
  }
];

const generateMockAlerts = (): DeploymentAlert[] => [
  {
    id: 'a1',
    type: 'error',
    title: 'Deployment Failed',
    message: 'Production deployment failed due to test failures',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    acknowledged: false,
    environment: 'production'
  },
  {
    id: 'a2',
    type: 'warning',
    title: 'High Resource Usage',
    message: 'Staging environment CPU usage is above 75%',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    acknowledged: false,
    environment: 'staging'
  }
];

// Components
const PipelineStatusGrid: React.FC<{ pipelines: PipelineStatus[] }> = ({ pipelines }) => {
  const getStatusIcon = (status: PipelineStatus['status']) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Pause className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PipelineStatus['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pipelines.map((pipeline) => (
        <Card key={pipeline.id} className="relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {pipeline.name}
              </CardTitle>
              {getStatusIcon(pipeline.status)}
            </div>
            <Badge variant="secondary" className="w-fit">
              {pipeline.environment}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stage</span>
                <span className="font-medium">{pipeline.stage}</span>
              </div>
              <Progress 
                value={pipeline.progress} 
                className="h-2"
                aria-label={`${pipeline.name} progress: ${pipeline.progress}%`}
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  {Math.floor(pipeline.duration / 60)}m {pipeline.duration % 60}s
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const MetricsChart: React.FC<{ 
  data: MetricDataPoint[]; 
  title: string; 
  color?: string; 
}> = ({ data, title, color = 'blue' }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-24 flex items-end space-x-1">
          {data.slice(-20).map((point, index) => (
            <div
              key={index}
              className={cn(
                'flex-1 bg-gradient-to-t rounded-t',
                color === 'blue' && 'from-blue-500 to-blue-300',
                color === 'green' && 'from-green-500 to-green-300',
                color === 'red' && 'from-red-500 to-red-300',
                color === 'yellow' && 'from-yellow-500 to-yellow-300'
              )}
              style={{ 
                height: `${(point.value / maxValue) * 100}%`,
                minHeight: '2px'
              }}
              title={`${point.label || point.timestamp}: ${point.value}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ResourceUtilizationPanel: React.FC<{ resources: ResourceMetrics }> = ({ resources }) => {
  const getUsageColor = (usage: number) => {
    if (usage >= 80) return 'text-red-500';
    if (usage >= 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-2xl font-bold', getUsageColor(resources.cpu.usage))}>
              {resources.cpu.usage}%
            </span>
            <span className="text-sm text-muted-foreground">
              / {resources.cpu.limit}%
            </span>
          </div>
          <Progress 
            value={resources.cpu.usage} 
            className="h-2"
            aria-label={`CPU usage: ${resources.cpu.usage}%`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <Memory className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-2xl font-bold', getUsageColor(resources.memory.usage))}>
              {resources.memory.usage}%
            </span>
            <span className="text-sm text-muted-foreground">
              / {resources.memory.limit}%
            </span>
          </div>
          <Progress 
            value={resources.memory.usage} 
            className="h-2"
            aria-label={`Memory usage: ${resources.memory.usage}%`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className={cn('text-2xl font-bold', getUsageColor(resources.storage.usage))}>
              {resources.storage.usage}%
            </span>
            <span className="text-sm text-muted-foreground">
              / {resources.storage.limit}%
            </span>
          </div>
          <Progress 
            value={resources.storage.usage} 
            className="h-2"
            aria-label={`Storage usage: ${resources.storage.usage}%`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inbound</span>
              <span className="font-medium">{resources.network.inbound} MB/s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outbound</span>
              <span className="font-medium">{resources.network.outbound} MB/s</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const EnvironmentStatusCard: React.FC<{ 
  environment: Environment; 
  onClick?: (environment: Environment) => void; 
}> = ({ environment, onClick }) => {
  const getStatusColor = (status: Environment['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-500 bg-red-50 border-red-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: Environment['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'error':
        return <X className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        onClick && 'hover:scale-[1.02]'
      )}
      onClick={() => onClick?.(environment)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{environment.name}</CardTitle>
          <div className={cn('flex items-center space-x-1 px-2 py-1 rounded-full text-xs', getStatusColor(environment.status))}>
            {getStatusIcon(environment.status)}
            <span className="capitalize">{environment.status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="outline">{environment.version}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-medium">{environment.uptime}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last Deployment</span>
            <span className="font-medium">
              {new Date(environment.lastDeployment).toLocaleDateString()}
            </span>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPU</span>
              <span>{environment.resources.cpu.usage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memory</span>
              <span>{environment.resources.memory.usage}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DeploymentTimeline: React.FC<{ deployments: DeploymentEvent[] }> = ({ deployments }) => {
  const getStatusIcon = (status: DeploymentEvent['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <ScrollArea className="h-96">
      <div className="space-y-4 p-2">
        {deployments.map((deployment, index) => (
          <div key={deployment.id} className="flex space-x-3">
            <div className="flex flex-col items-center">
              {getStatusIcon(deployment.status)}
              {index < deployments.length - 1 && (
                <div className="h-8 w-px bg-border mt-2" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{deployment.pipeline}</span>
                <Badge variant="secondary" className="text-xs">
                  {deployment.environment}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {deployment.status}
                </Badge>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span>{deployment.branch}</span>
                  <span>•</span>
                  <span>{deployment.commit.slice(0, 7)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Started {new Date(deployment.startTime).toLocaleTimeString()}
                  {deployment.duration && (
                    <span> • {Math.floor(deployment.duration / 60)}m {deployment.duration % 60}s</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  by {deployment.triggeredBy}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const AlertsPanel: React.FC<{ 
  alerts: DeploymentAlert[]; 
  onAcknowledge?: (alertId: string) => void; 
}> = ({ alerts, onAcknowledge }) => {
  const getAlertIcon = (type: DeploymentAlert['type']) => {
    switch (type) {
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4