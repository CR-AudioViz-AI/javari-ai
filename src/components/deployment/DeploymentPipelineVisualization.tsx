```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Activity,
  GitBranch,
  Database,
  Server,
  Shield,
  Eye,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeploymentStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  startTime?: string;
  endTime?: string;
  logs: string[];
  progress: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface DeploymentPipeline {
  id: string;
  name: string;
  branch: string;
  version: string;
  environment: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  stages: DeploymentStage[];
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  triggeredBy: string;
}

interface MetricsData {
  successRate: number;
  averageDeployTime: number;
  deploymentsThisWeek: number;
  failureRate: number;
  rollbackRate: number;
  trends: Array<{
    date: string;
    deployments: number;
    successes: number;
    failures: number;
  }>;
}

interface DeploymentPipelineVisualizationProps {
  pipelineId?: string;
  environment?: string;
  onStageClick?: (stage: DeploymentStage) => void;
  onRollback?: (pipelineId: string) => Promise<void>;
  onRetry?: (pipelineId: string) => Promise<void>;
  className?: string;
}

const mockPipeline: DeploymentPipeline = {
  id: "deploy-123",
  name: "Production Deployment",
  branch: "main",
  version: "v2.4.1",
  environment: "production",
  status: "running",
  startTime: new Date().toISOString(),
  triggeredBy: "john.doe@company.com",
  stages: [
    {
      id: "build",
      name: "Build",
      status: "success",
      duration: 120,
      progress: 100,
      logs: ["Building application...", "Dependencies installed", "Build completed successfully"],
      icon: GitBranch
    },
    {
      id: "test",
      name: "Test",
      status: "running",
      duration: 90,
      progress: 65,
      logs: ["Running unit tests...", "Running integration tests...", "Test coverage: 85%"],
      icon: Shield
    },
    {
      id: "security",
      name: "Security Scan",
      status: "pending",
      progress: 0,
      logs: [],
      icon: Shield
    },
    {
      id: "deploy",
      name: "Deploy",
      status: "pending",
      progress: 0,
      logs: [],
      icon: Server
    },
    {
      id: "verify",
      name: "Verify",
      status: "pending",
      progress: 0,
      logs: [],
      icon: CheckCircle
    }
  ]
};

const mockMetrics: MetricsData = {
  successRate: 94.5,
  averageDeployTime: 12.3,
  deploymentsThisWeek: 23,
  failureRate: 5.5,
  rollbackRate: 2.1,
  trends: [
    { date: "Mon", deployments: 5, successes: 5, failures: 0 },
    { date: "Tue", deployments: 3, successes: 3, failures: 0 },
    { date: "Wed", deployments: 4, successes: 3, failures: 1 },
    { date: "Thu", deployments: 6, successes: 6, failures: 0 },
    { date: "Fri", deployments: 5, successes: 4, failures: 1 },
    { date: "Sat", deployments: 0, successes: 0, failures: 0 },
    { date: "Sun", deployments: 0, successes: 0, failures: 0 }
  ]
};

const StageStatusBadge: React.FC<{ status: DeploymentStage['status'] }> = ({ status }) => {
  const variants = {
    pending: { variant: 'secondary' as const, icon: Clock, color: 'text-muted-foreground' },
    running: { variant: 'default' as const, icon: Activity, color: 'text-blue-600' },
    success: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
    failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
    skipped: { variant: 'outline' as const, icon: AlertTriangle, color: 'text-yellow-600' }
  };

  const { variant, icon: Icon, color } = variants[status];

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className={cn("h-3 w-3", color)} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const PipelineStageCard: React.FC<{ 
  stage: DeploymentStage; 
  onClick?: () => void;
  isActive?: boolean;
}> = ({ stage, onClick, isActive }) => {
  const Icon = stage.icon;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isActive && "ring-2 ring-primary",
        stage.status === 'running' && "border-blue-500",
        stage.status === 'success' && "border-green-500",
        stage.status === 'failed' && "border-red-500"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
          </div>
          <StageStatusBadge status={stage.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {stage.status === 'running' && (
            <Progress value={stage.progress} className="h-2" />
          )}
          {stage.duration && (
            <p className="text-xs text-muted-foreground">
              Duration: {stage.duration}s
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const PipelineTimeline: React.FC<{ stages: DeploymentStage[] }> = ({ stages }) => {
  return (
    <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.id}>
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center",
              stage.status === 'success' && "bg-green-500 border-green-500 text-white",
              stage.status === 'running' && "bg-blue-500 border-blue-500 text-white animate-pulse",
              stage.status === 'failed' && "bg-red-500 border-red-500 text-white",
              stage.status === 'pending' && "bg-background border-muted-foreground",
              stage.status === 'skipped' && "bg-yellow-500 border-yellow-500 text-white"
            )}>
              <stage.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium">{stage.name}</span>
          </div>
          {index < stages.length - 1 && (
            <div className={cn(
              "flex-1 h-0.5 min-w-8",
              stages[index + 1].status !== 'pending' ? "bg-green-500" : "bg-muted-foreground"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const DeploymentLog: React.FC<{ logs: string[]; isLive?: boolean }> = ({ logs, isLive }) => {
  return (
    <ScrollArea className="h-64 w-full rounded-md border p-4 font-mono text-sm">
      <div className="space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="text-muted-foreground">
            <span className="text-xs opacity-70">
              [{new Date().toLocaleTimeString()}]
            </span>{' '}
            {log}
          </div>
        ))}
        {isLive && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            Live
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

const MetricsPanel: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold">{metrics.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Deploy Time</p>
                <p className="text-lg font-semibold">{metrics.averageDeployTime}min</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-lg font-semibold">{metrics.deploymentsThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Failure Rate</p>
                <p className="text-lg font-semibold">{metrics.failureRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Rollback Rate</p>
                <p className="text-lg font-semibold">{metrics.rollbackRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deployment Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="successes" stackId="a" fill="#10b981" />
              <Bar dataKey="failures" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

const RollbackControls: React.FC<{ 
  pipelineId: string;
  onRollback?: (pipelineId: string) => Promise<void>;
  disabled?: boolean;
}> = ({ pipelineId, onRollback, disabled }) => {
  const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    if (!onRollback) return;
    
    setIsRollingBack(true);
    try {
      await onRollback(pipelineId);
      setIsRollbackDialogOpen(false);
    } catch (error) {
      console.error('Rollback failed:', error);
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <Dialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          className="text-orange-600 hover:text-orange-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Rollback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Rollback</DialogTitle>
          <DialogDescription>
            Are you sure you want to rollback this deployment? This will revert to the previous version.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsRollbackDialogOpen(false)}
            disabled={isRollingBack}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleRollback}
            disabled={isRollingBack}
          >
            {isRollingBack ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Rolling back...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Confirm Rollback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeploymentPipelineVisualization: React.FC<DeploymentPipelineVisualizationProps> = ({
  pipelineId = "deploy-123",
  environment = "production",
  onStageClick,
  onRollback,
  onRetry,
  className
}) => {
  const [selectedStage, setSelectedStage] = useState<DeploymentStage | null>(null);
  const [pipeline, setPipeline] = useState<DeploymentPipeline>(mockPipeline);
  const [metrics, setMetrics] = useState<MetricsData>(mockMetrics);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      if (pipeline.status === 'running') {
        setPipeline(prev => ({
          ...prev,
          stages: prev.stages.map(stage => {
            if (stage.status === 'running' && stage.progress < 100) {
              return {
                ...stage,
                progress: Math.min(stage.progress + Math.random() * 10, 100),
                logs: [...stage.logs, `Progress: ${Math.min(stage.progress + Math.random() * 10, 100).toFixed(1)}%`]
              };
            }
            return stage;
          })
        }));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pipeline.status]);

  const handleStageClick = (stage: DeploymentStage) => {
    setSelectedStage(stage);
    onStageClick?.(stage);
  };

  const canRollback = pipeline.status === 'success' || pipeline.status === 'failed';
  const canRetry = pipeline.status === 'failed';

  return (
    <div className={cn("space-y-6", className)}>
      {/* Pipeline Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {pipeline.name}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Branch: {pipeline.branch}</span>
                <span>Version: {pipeline.version}</span>
                <span>Environment: {pipeline.environment}</span>
                <span>By: {pipeline.triggeredBy}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StageStatusBadge status={pipeline.status} />
              {canRetry && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onRetry?.(pipeline.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              <RollbackControls 
                pipelineId={pipeline.id}
                onRollback={onRollback}
                disabled={!canRollback}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PipelineTimeline stages={pipeline.stages} />
        </CardContent>
      </Card>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stages">Pipeline Stages</TabsTrigger>
          <TabsTrigger value="logs">Deployment Logs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {pipeline.stages.map((stage) => (
              <PipelineStageCard
                key={stage.id}
                stage={stage}
                onClick={() => handleStageClick(stage)}
                isActive={selectedStage?.id === stage.id}
              />
            ))}
          </div>

          {selectedStage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <selectedStage.icon className="h-5 w-5" />
                  {selectedStage.name} Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <StageStatusBadge status={selectedStage.status} />
                    {selectedStage.duration && (
                      <span className="text-sm text-muted-foreground">
                        Duration: {selectedStage.duration}s
                      </span>
                    )}
                  </div>
                  
                  {selectedStage.status === 'running' && (
                    <Progress value={selectedStage.progress} className="h-2" />
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Stage Logs</h4>
                    <DeploymentLog 
                      logs={selectedStage.logs} 
                      isLive={selectedStage.status === 'running'} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Deployment Logs
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsLive(!isLive)}
                >
                  {isLive ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Live
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Live
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DeploymentLog 
                logs={pipeline.stages.flatMap(stage => 
                  stage.logs.map(log => `[${stage.name}] ${log}`)
                )} 
                isLive={isLive}
              />