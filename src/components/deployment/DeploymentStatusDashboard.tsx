```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  MarkerType,
  Handle,
  Position,
} from 'reactflow'
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
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Network,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Database,
  Globe,
  Refresh,
  Filter,
  X,
} from 'lucide-react'

// Types
interface DeploymentStatus {
  id: string
  service_name: string
  version: string
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back'
  progress: number
  started_at: string
  completed_at?: string
  error_message?: string
  health_score: number
}

interface HealthMetric {
  id: string
  service_name: string
  metric_type: 'cpu' | 'memory' | 'disk' | 'network'
  value: number
  unit: string
  timestamp: string
  threshold: number
}

interface SystemAlert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  service_name?: string
  created_at: string
  acknowledged: boolean
  resolved: boolean
}

interface ServiceTopology {
  id: string
  name: string
  type: 'api' | 'database' | 'frontend' | 'cache' | 'queue'
  status: 'healthy' | 'degraded' | 'down'
  position: { x: number; y: number }
  connections: string[]
  metrics: {
    cpu: number
    memory: number
    requests_per_second: number
  }
}

interface TimeSeriesData {
  timestamp: string
  success_rate: number
  deployment_count: number
  avg_duration: number
}

interface DeploymentStatusDashboardProps {
  className?: string
  refreshInterval?: number
  showTopology?: boolean
  showMetrics?: boolean
  showAlerts?: boolean
  maxAlerts?: number
}

// Service Node Component
const ServiceNode = ({ data }: { data: ServiceTopology }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500 border-green-500'
      case 'degraded': return 'text-yellow-500 border-yellow-500'
      case 'down': return 'text-red-500 border-red-500'
      default: return 'text-gray-500 border-gray-500'
    }
  }

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'api': return <Server className="w-4 h-4" />
      case 'database': return <Database className="w-4 h-4" />
      case 'frontend': return <Globe className="w-4 h-4" />
      case 'cache': return <Zap className="w-4 h-4" />
      case 'queue': return <Activity className="w-4 h-4" />
      default: return <Server className="w-4 h-4" />
    }
  }

  return (
    <div className={`bg-background border-2 rounded-lg p-3 min-w-[120px] ${getStatusColor(data.status)}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center gap-2 mb-2">
        {getServiceIcon(data.type)}
        <span className="font-medium text-sm">{data.name}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>CPU:</span>
          <span>{data.metrics.cpu}%</span>
        </div>
        <div className="flex justify-between">
          <span>Memory:</span>
          <span>{data.metrics.memory}%</span>
        </div>
        <div className="flex justify-between">
          <span>RPS:</span>
          <span>{data.metrics.requests_per_second}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}

// Custom node types
const nodeTypes = {
  service: ServiceNode,
}

// Topology View Component
const TopologyView: React.FC<{ services: ServiceTopology[] }> = ({ services }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    const flowNodes: Node[] = services.map(service => ({
      id: service.id,
      type: 'service',
      position: service.position,
      data: service,
    }))

    const flowEdges: Edge[] = services.flatMap(service =>
      service.connections.map(targetId => ({
        id: `${service.id}-${targetId}`,
        source: service.id,
        target: targetId,
        type: ConnectionLineType.SmoothStep,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#9CA3AF',
        },
        style: {
          strokeWidth: 2,
          stroke: '#9CA3AF',
        },
      }))
    )

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [services, setNodes, setEdges])

  return (
    <div className="h-[400px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

// Metric Card Component
const MetricCard: React.FC<{
  title: string
  value: string | number
  trend?: 'up' | 'down' | 'stable'
  icon: React.ReactNode
  description?: string
}> = ({ title, value, trend, icon, description }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {getTrendIcon()}
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Alert Panel Component
const AlertPanel: React.FC<{
  alerts: SystemAlert[]
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
}> = ({ alerts, onAcknowledge, onResolve }) => {
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'unresolved'>('all')

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filter === 'unacknowledged') return !alert.acknowledged
      if (filter === 'unresolved') return !alert.resolved
      return true
    })
  }, [alerts, filter])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-900'
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-900'
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-900'
      case 'low': return 'border-blue-500 bg-blue-50 text-blue-900'
      default: return 'border-gray-500 bg-gray-50 text-gray-900'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  return (
    <Card className="h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">System Alerts</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Alerts</option>
              <option value="unacknowledged">Unacknowledged</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>
        </div>
        <CardDescription>
          {filteredAlerts.length} alerts shown
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[480px]">
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <AlertTitle className="text-sm font-medium">
                        {alert.title}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {alert.severity}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1">
                        {alert.message}
                      </AlertDescription>
                      {alert.service_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Service: {alert.service_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!alert.acknowledged && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAcknowledge(alert.id)}
                        className="text-xs"
                      >
                        Ack
                      </Button>
                    )}
                    {!alert.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResolve(alert.id)}
                        className="text-xs"
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Progress Tracker Component
const ProgressTracker: React.FC<{ deployments: DeploymentStatus[] }> = ({ deployments }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'pending': return <Clock className="w-4 h-4 text-gray-500" />
      case 'rolled_back': return <XCircle className="w-4 h-4 text-orange-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'border-green-500 bg-green-50'
      case 'failed': return 'border-red-500 bg-red-50'
      case 'in_progress': return 'border-blue-500 bg-blue-50'
      case 'pending': return 'border-gray-300 bg-gray-50'
      case 'rolled_back': return 'border-orange-500 bg-orange-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Active Deployments</CardTitle>
        <CardDescription>
          {deployments.length} deployment(s) in progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className={`p-4 rounded-lg border-2 ${getStatusColor(deployment.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(deployment.status)}
                    <span className="font-medium">{deployment.service_name}</span>
                    <Badge variant="outline">{deployment.version}</Badge>
                  </div>
                  <Badge className="text-xs">
                    {deployment.status.replace('_', ' ')}
                  </Badge>
                </div>
                <Progress value={deployment.progress} className="mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress: {deployment.progress}%</span>
                  <span>Health: {deployment.health_score}/100</span>
                </div>
                {deployment.error_message && (
                  <p className="text-xs text-red-600 mt-2">
                    {deployment.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Time Series Chart Component
const TimeSeriesChart: React.FC<{ data: TimeSeriesData[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Deployment Metrics</CardTitle>
        <CardDescription>Success rate and deployment frequency over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleString()}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="success_rate"
              stroke="#10b981"
              strokeWidth={2}
              name="Success Rate (%)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="deployment_count"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Deployments"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avg_duration"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Avg Duration (min)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// Main Dashboard Component
export const DeploymentStatusDashboard: React.FC<DeploymentStatusDashboardProps> = ({
  className = '',
  refreshInterval = 5000,
  showTopology = true,
  showMetrics = true,
  showAlerts = true,
  maxAlerts = 10,
}) => {
  const [activeTab, setActiveTab] = useState('overview')
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Fetch deployment statuses
  const { data: deployments = [], isLoading: deploymentsLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployment_status')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      return data as DeploymentStatus[]
    },
    refetchInterval: refreshInterval,
  })

  // Fetch health metrics
  const { data: healthMetrics = [] } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployment_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100)
      
      if (error) throw error
      return data as HealthMetric[]
    },
    refetchInterval: refreshInterval,
  })

  // Fetch system alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxAlerts)
      
      if (error) throw error
      return data as SystemAlert[]
    },
    refetchInterval: refreshInterval,
  })

  // Fetch service topology
  const { data: serviceTopology = [] } = useQuery({
    queryKey: ['service-topology'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_topology')
        .select('*')
      
      if (error) throw error
      return data as ServiceTopology[]
    },
    refetchInterval: refreshInterval * 2, // Less frequent updates for topology
  })

  // Fetch time series data
  const { data: timeSeriesData = [] } = useQuery({
    queryKey: ['time-series'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_deployment_time_series', { hours: 24 })
      
      if (error) throw error
      return data as TimeSeriesData[]
    },
    refetchInterval: refreshInterval * 6, // Even less frequent for historical data
  })

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('deployment_events')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'deployment_status' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['deployments'] })
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'system_alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])

  // Alert handlers
  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    await supabase
      .from('system_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId)
    
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }, [supabase, queryClient])

  const handleResolveAlert = useCallback(async (alertId: string) => {
    await supabase
      .from('system_alerts')
      .update({ resolved: true })
      .eq('id', alertId)
    
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }, [supabase, queryClient])

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const activeDeployments = deployments.filter(d => 
      d.status === 'in_progress' || d.status === 'pending'
    ).length
    
    const successfulDeployments = deployments.filter(d => 
      d.status === 'success'
    ).length
    
    const successRate = deployments.length > 0 
      ? (successfulDeployments / deployments.length * 100).toFixed(1)
      : '0'
    
    const criticalAlerts = alerts.filter(a => 
      a.severity === 'critical' && !a.resolved
    ).length

    const avgHealthScore = deployments.length > 0
      ? (deployments.reduce((sum, d) => sum + d.health_score, 0) / deployments.length).toFixed(0)
      : '0'

    return {
      active