```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from 'recharts';
import {
  Cloud,
  Server,
  Activity,
  DollarSign,
  Clock,
  Settings,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Globe,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

// Types
interface CloudProvider {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  region: string;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    instances: number;
  };
  costs: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  performance: {
    latency: number;
    throughput: number;
    availability: number;
  };
}

interface DeploymentConfig {
  id: string;
  name: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'stopped';
  targetProviders: string[];
  requirements: {
    minCpu: number;
    minMemory: number;
    minStorage: number;
    maxLatency: number;
    minAvailability: number;
  };
  optimization: {
    priority: 'cost' | 'performance' | 'balanced';
    autoScale: boolean;
    maxCost: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface DeploymentMetrics {
  totalDeployments: number;
  activeDeployments: number;
  failedDeployments: number;
  totalCost: number;
  avgLatency: number;
  uptime: number;
}

interface MultiCloudOrchestrationDashboardProps {
  className?: string;
  onDeploymentStart?: (config: DeploymentConfig) => void;
  onDeploymentStop?: (deploymentId: string) => void;
  onConfigUpdate?: (config: DeploymentConfig) => void;
}

const CLOUD_COLORS = {
  aws: '#FF9900',
  azure: '#0078D4',
  gcp: '#4285F4',
} as const;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MultiCloudOrchestrationDashboard({
  className,
  onDeploymentStart,
  onDeploymentStop,
  onConfigUpdate,
}: MultiCloudOrchestrationDashboardProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [autoOptimization, setAutoOptimization] = useState(true);
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const { data: realTimeData, isConnected } = useWebSocket('/api/deployment-events');

  // Fetch deployment configurations
  const { data: deploymentConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['deployment-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployment_configs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DeploymentConfig[];
    },
  });

  // Fetch cloud providers status
  const { data: cloudProviders = [], isLoading: providersLoading } = useQuery({
    queryKey: ['cloud-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cloud_providers')
        .select('*');
      
      if (error) throw error;
      return data as CloudProvider[];
    },
  });

  // Fetch deployment metrics
  const { data: metrics } = useQuery({
    queryKey: ['deployment-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployment_metrics')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as DeploymentMetrics;
    },
  });

  // Fetch cost optimization data
  const { data: costOptimizationData = [] } = useQuery({
    queryKey: ['cost-optimization'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_optimization_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24);
      
      if (error) throw error;
      return data;
    },
  });

  // Start deployment mutation
  const startDeploymentMutation = useMutation({
    mutationFn: async (config: DeploymentConfig) => {
      const response = await fetch('/api/deployments/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start deployment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-configs'] });
      queryClient.invalidateQueries({ queryKey: ['deployment-metrics'] });
    },
  });

  // Stop deployment mutation
  const stopDeploymentMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      const response = await fetch(`/api/deployments/${deploymentId}/stop`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to stop deployment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-configs'] });
      queryClient.invalidateQueries({ queryKey: ['deployment-metrics'] });
    },
  });

  // Filter providers based on selection
  const filteredProviders = useMemo(() => {
    if (selectedProvider === 'all') return cloudProviders;
    return cloudProviders.filter(provider => provider.id === selectedProvider);
  }, [cloudProviders, selectedProvider]);

  // Calculate aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    return filteredProviders.reduce(
      (acc, provider) => ({
        totalCost: acc.totalCost + provider.costs.hourly,
        avgLatency: acc.avgLatency + provider.performance.latency / filteredProviders.length,
        totalInstances: acc.totalInstances + provider.resources.instances,
        avgAvailability: acc.avgAvailability + provider.performance.availability / filteredProviders.length,
      }),
      { totalCost: 0, avgLatency: 0, totalInstances: 0, avgAvailability: 0 }
    );
  }, [filteredProviders]);

  // Handle deployment actions
  const handleStartDeployment = (config: DeploymentConfig) => {
    startDeploymentMutation.mutate(config);
    onDeploymentStart?.(config);
  };

  const handleStopDeployment = (deploymentId: string) => {
    stopDeploymentMutation.mutate(deploymentId);
    onDeploymentStop?.(deploymentId);
  };

  // Real-time updates effect
  useEffect(() => {
    if (realTimeData) {
      queryClient.invalidateQueries({ queryKey: ['deployment-configs'] });
      queryClient.invalidateQueries({ queryKey: ['cloud-providers'] });
    }
  }, [realTimeData, queryClient]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Cloud Orchestration</h1>
          <p className="text-muted-foreground">
            Manage deployments across AWS, Azure, and Google Cloud Platform
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {cloudProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalDeployments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeDeployments || 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hourly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${aggregatedMetrics.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Across {filteredProviders.length} provider(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedMetrics.avgLatency.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {aggregatedMetrics.avgAvailability.toFixed(1)}% uptime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instances</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregatedMetrics.totalInstances}</div>
            <p className="text-xs text-muted-foreground">
              Running across clouds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="optimization">Cost Optimization</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cloud Provider Matrix */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Cloud Provider Status</CardTitle>
                <CardDescription>Real-time status across providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredProviders.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CLOUD_COLORS[provider.id as keyof typeof CLOUD_COLORS] }}
                        />
                        <div>
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-sm text-muted-foreground">{provider.region}</div>
                        </div>
                      </div>
                      <Badge variant={
                        provider.status === 'active' ? 'default' :
                        provider.status === 'error' ? 'destructive' : 'secondary'
                      }>
                        {provider.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Latency and throughput over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={costOptimizationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="latency" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="throughput" stroke="#82ca9d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Resource Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Allocation</CardTitle>
              <CardDescription>Current resource distribution across providers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>CPU Cores</TableHead>
                    <TableHead>Memory (GB)</TableHead>
                    <TableHead>Storage (TB)</TableHead>
                    <TableHead>Instances</TableHead>
                    <TableHead>Cost/Hour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>{provider.resources.cpu}</TableCell>
                      <TableCell>{provider.resources.memory}</TableCell>
                      <TableCell>{provider.resources.storage}</TableCell>
                      <TableCell>{provider.resources.instances}</TableCell>
                      <TableCell>${provider.costs.hourly.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Active Deployments</h3>
            <Button onClick={() => handleStartDeployment({} as DeploymentConfig)}>
              <Play className="mr-2 h-4 w-4" />
              New Deployment
            </Button>
          </div>

          <div className="grid gap-4">
            {deploymentConfigs.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription>
                        Target: {config.targetProviders.join(', ')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        config.status === 'deployed' ? 'default' :
                        config.status === 'failed' ? 'destructive' :
                        config.status === 'deploying' ? 'secondary' : 'outline'
                      }>
                        {config.status}
                      </Badge>
                      {config.status === 'deploying' && (
                        <Button size="sm" variant="outline" onClick={() => handleStopDeployment(config.id)}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-sm font-medium">Requirements</Label>
                      <div className="text-sm text-muted-foreground">
                        CPU: {config.requirements.minCpu} cores<br />
                        Memory: {config.requirements.minMemory} GB<br />
                        Storage: {config.requirements.minStorage} GB
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Performance</Label>
                      <div className="text-sm text-muted-foreground">
                        Max Latency: {config.requirements.maxLatency}ms<br />
                        Min Availability: {config.requirements.minAvailability}%
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Optimization</Label>
                      <div className="text-sm text-muted-foreground">
                        Priority: {config.optimization.priority}<br />
                        Auto Scale: {config.optimization.autoScale ? 'Yes' : 'No'}<br />
                        Max Cost: ${config.optimization.maxCost}/hour
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Cost Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cost Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Trends</CardTitle>
                <CardDescription>24-hour cost optimization results</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={costOptimizationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="cost" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="optimizedCost" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Savings Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Savings by Provider</CardTitle>
                <CardDescription>Cost optimization across cloud providers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={filteredProviders.map(provider => ({
                        name: provider.name,
                        value: provider.costs.daily,
                        fill: CLOUD_COLORS[provider.id as keyof typeof CLOUD_COLORS],
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Auto-scaling Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Auto-scaling Configuration</CardTitle>
              <CardDescription>Automatic resource scaling parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-optimization"
                  checked={autoOptimization}