```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity, 
  Settings, 
  Zap,
  TrendingUp,
  Server,
  Database,
  Network,
  Shield,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Types
interface Deployment {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  environment: string;
  createdAt: string;
  updatedAt: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  pipeline: PipelineStep[];
}

interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

interface SystemMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  storage: number;
  network: number;
}

interface DeploymentAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  deploymentId?: string;
  timestamp: string;
  acknowledged: boolean;
}

interface ControlState {
  isAutonomousMode: boolean;
  emergencyStop: boolean;
  selectedDeployment: string | null;
  overrideReason: string;
  setAutonomousMode: (mode: boolean) => void;
  setEmergencyStop: (stop: boolean) => void;
  setSelectedDeployment: (id: string | null) => void;
  setOverrideReason: (reason: string) => void;
}

// Store
const useControlStore = create<ControlState>((set) => ({
  isAutonomousMode: true,
  emergencyStop: false,
  selectedDeployment: null,
  overrideReason: '',
  setAutonomousMode: (mode) => set({ isAutonomousMode: mode }),
  setEmergencyStop: (stop) => set({ emergencyStop: stop }),
  setSelectedDeployment: (id) => set({ selectedDeployment: id }),
  setOverrideReason: (reason) => set({ overrideReason: reason }),
}));

// Mock data generators
const generateMockDeployments = (): Deployment[] => [
  {
    id: '1',
    name: 'Frontend Production Deploy',
    status: 'running',
    progress: 75,
    environment: 'production',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:30:00Z',
    resourceUsage: { cpu: 65, memory: 72, storage: 45 },
    pipeline: [
      { id: '1', name: 'Build', status: 'completed', duration: 120, startedAt: '2024-01-20T10:00:00Z', completedAt: '2024-01-20T10:02:00Z' },
      { id: '2', name: 'Test', status: 'completed', duration: 180, startedAt: '2024-01-20T10:02:00Z', completedAt: '2024-01-20T10:05:00Z' },
      { id: '3', name: 'Deploy', status: 'running', startedAt: '2024-01-20T10:05:00Z' },
      { id: '4', name: 'Verify', status: 'pending' }
    ]
  },
  {
    id: '2',
    name: 'API Service Update',
    status: 'completed',
    progress: 100,
    environment: 'staging',
    createdAt: '2024-01-20T09:00:00Z',
    updatedAt: '2024-01-20T09:45:00Z',
    resourceUsage: { cpu: 45, memory: 58, storage: 38 },
    pipeline: [
      { id: '1', name: 'Build', status: 'completed', duration: 150, startedAt: '2024-01-20T09:00:00Z', completedAt: '2024-01-20T09:02:30Z' },
      { id: '2', name: 'Test', status: 'completed', duration: 200, startedAt: '2024-01-20T09:02:30Z', completedAt: '2024-01-20T09:05:50Z' },
      { id: '3', name: 'Deploy', status: 'completed', duration: 180, startedAt: '2024-01-20T09:05:50Z', completedAt: '2024-01-20T09:08:50Z' },
      { id: '4', name: 'Verify', status: 'completed', duration: 120, startedAt: '2024-01-20T09:08:50Z', completedAt: '2024-01-20T09:10:50Z' }
    ]
  },
  {
    id: '3',
    name: 'Database Migration',
    status: 'failed',
    progress: 40,
    environment: 'production',
    createdAt: '2024-01-20T08:00:00Z',
    updatedAt: '2024-01-20T08:25:00Z',
    resourceUsage: { cpu: 25, memory: 30, storage: 85 },
    pipeline: [
      { id: '1', name: 'Backup', status: 'completed', duration: 300, startedAt: '2024-01-20T08:00:00Z', completedAt: '2024-01-20T08:05:00Z' },
      { id: '2', name: 'Migrate', status: 'failed', duration: 480, startedAt: '2024-01-20T08:05:00Z', completedAt: '2024-01-20T08:13:00Z' },
      { id: '3', name: 'Verify', status: 'skipped' },
      { id: '4', name: 'Cleanup', status: 'skipped' }
    ]
  }
];

const generateMockMetrics = (): SystemMetric[] => 
  Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    cpu: 40 + Math.random() * 40,
    memory: 50 + Math.random() * 30,
    storage: 60 + Math.random() * 20,
    network: 30 + Math.random() * 50
  }));

const generateMockAlerts = (): DeploymentAlert[] => [
  {
    id: '1',
    type: 'warning',
    message: 'High CPU usage detected in production deployment',
    deploymentId: '1',
    timestamp: '2024-01-20T10:25:00Z',
    acknowledged: false
  },
  {
    id: '2',
    type: 'error',
    message: 'Database migration failed - connection timeout',
    deploymentId: '3',
    timestamp: '2024-01-20T08:13:00Z',
    acknowledged: false
  },
  {
    id: '3',
    type: 'info',
    message: 'Autonomous deployment completed successfully',
    deploymentId: '2',
    timestamp: '2024-01-20T09:10:50Z',
    acknowledged: true
  }
];

// Components
const SystemHealthIndicator = () => {
  const systemHealth = 87;
  const healthColor = systemHealth >= 80 ? 'text-green-500' : systemHealth >= 60 ? 'text-yellow-500' : 'text-red-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={healthColor}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={`${systemHealth}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-semibold ${healthColor}`}>{systemHealth}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Status: Healthy</div>
            <div className="text-xs text-muted-foreground">Active Deployments: 3</div>
            <div className="text-xs text-muted-foreground">Success Rate: 94%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DeploymentStatusGrid = ({ deployments }: { deployments: Deployment[] }) => {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    running: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    paused: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const StatusIcon = ({ status }: { status: Deployment['status'] }) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-3 w-3 animate-spin" />;
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'failed': return <AlertTriangle className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <div className="grid gap-4">
      {deployments.map((deployment) => (
        <motion.div
          key={deployment.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{deployment.name}</CardTitle>
                <Badge className={`${statusColors[deployment.status]} flex items-center gap-1`}>
                  <StatusIcon status={deployment.status} />
                  {deployment.status}
                </Badge>
              </div>
              <CardDescription>{deployment.environment}</CardDescription>
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

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">CPU</div>
                    <div className="flex items-center gap-2">
                      <Progress value={deployment.resourceUsage.cpu} className="h-1 flex-1" />
                      <span>{deployment.resourceUsage.cpu}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Memory</div>
                    <div className="flex items-center gap-2">
                      <Progress value={deployment.resourceUsage.memory} className="h-1 flex-1" />
                      <span>{deployment.resourceUsage.memory}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Storage</div>
                    <div className="flex items-center gap-2">
                      <Progress value={deployment.resourceUsage.storage} className="h-1 flex-1" />
                      <span>{deployment.resourceUsage.storage}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Started: {new Date(deployment.createdAt).toLocaleTimeString()}</span>
                  <span>Updated: {new Date(deployment.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

const PipelineVisualization = ({ deployment }: { deployment: Deployment }) => {
  const stepColors = {
    pending: 'bg-gray-200',
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    skipped: 'bg-gray-300'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Pipeline: {deployment.name}</CardTitle>
        <CardDescription>Step-by-step deployment progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {deployment.pipeline.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full ${stepColors[step.status]} flex items-center justify-center text-white text-xs font-medium`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{step.name}</span>
                  <Badge variant={step.status === 'failed' ? 'destructive' : 'secondary'}>
                    {step.status}
                  </Badge>
                </div>
                {step.duration && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Duration: {Math.floor(step.duration / 60)}m {step.duration % 60}s
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ManualOverridePanel = () => {
  const { isAutonomousMode, emergencyStop, selectedDeployment, overrideReason, setAutonomousMode, setEmergencyStop, setSelectedDeployment, setOverrideReason } = useControlStore();
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          Manual Override Controls
        </CardTitle>
        <CardDescription>Take manual control of autonomous deployments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="autonomous-mode">Autonomous Mode</Label>
          <Switch
            id="autonomous-mode"
            checked={isAutonomousMode}
            onCheckedChange={setAutonomousMode}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="deployment-select">Select Deployment</Label>
          <Select value={selectedDeployment || ''} onValueChange={setSelectedDeployment}>
            <SelectTrigger id="deployment-select">
              <SelectValue placeholder="Choose deployment to control" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Frontend Production Deploy</SelectItem>
              <SelectItem value="2">API Service Update</SelectItem>
              <SelectItem value="3">Database Migration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!selectedDeployment}>
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
          <Button size="sm" variant="outline" disabled={!selectedDeployment}>
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
          <Button size="sm" variant="outline" disabled={!selectedDeployment}>
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>

        <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Zap className="h-3 w-3 mr-1" />
              Emergency Stop All
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Emergency Stop Confirmation</DialogTitle>
              <DialogDescription>
                This will immediately stop all running deployments. Please provide a reason for this action.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="override-reason">Reason for Emergency Stop</Label>
                <Textarea
                  id="override-reason"
                  placeholder="Describe the reason for emergency stop..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setEmergencyStop(true);
                    setIsOverrideDialogOpen(false);
                  }}
                  disabled={!overrideReason.trim()}
                >
                  Confirm Emergency Stop
                </Button>
                <Button variant="outline" onClick={() => setIsOverrideDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const ResourceMonitoring = ({ metrics }: { metrics: SystemMetric[] }) => {
  const latestMetrics = metrics[metrics.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Server className="h-4 w-4" />
          Resource Monitoring
        </CardTitle>
        <CardDescription>Real-time system resource utilization</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">CPU Usage</span>
                </div>
                <Progress value={latestMetrics?.cpu || 0} className="h-2" />
                <span className="text-xs text-muted-foreground">{Math.round(latestMetrics?.cpu || 0)}%</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Memory</span>
                </div>
                <Progress value={latestMetrics?.memory || 0} className="h-2" />
                <span className="text-xs text-muted-foreground">{Math.round(latestMetrics?.memory || 0)}%</span>
              </div>
              
              <div className="space