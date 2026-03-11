```tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Activity,
  Server,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Database,
  Network,
  Cpu,
  HardDrive,
  Users,
  Clock,
  Zap,
  Shield,
  Bell,
  BarChart3
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

// Validation schemas
const scalingConfigSchema = z.object({
  autoScalingEnabled: z.boolean(),
  minInstances: z.number().min(1).max(100),
  maxInstances: z.number().min(1).max(100),
  targetCpuUtilization: z.number().min(10).max(90),
  targetMemoryUtilization: z.number().min(10).max(90),
  scaleUpThreshold: z.number().min(1).max(100),
  scaleDownThreshold: z.number().min(1).max(100),
  cooldownPeriod: z.number().min(30).max(3600)
})

const alertConfigSchema = z.object({
  cpuAlertThreshold: z.number().min(50).max(100),
  memoryAlertThreshold: z.number().min(50).max(100),
  diskAlertThreshold: z.number().min(70).max(100),
  errorRateThreshold: z.number().min(1).max(50),
  responseTimeThreshold: z.number().min(100).max(10000),
  alertsEnabled: z.boolean(),
  notificationChannels: z.array(z.string())
})

type ScalingConfig = z.infer<typeof scalingConfigSchema>
type AlertConfig = z.infer<typeof alertConfigSchema>

// Mock data interfaces
interface MetricData {
  timestamp: string
  cpuUtilization: number
  memoryUtilization: number
  diskUtilization: number
  networkIn: number
  networkOut: number
  activeConnections: number
  responseTime: number
  errorRate: number
  throughput: number
}

interface InstanceHealth {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'offline'
  cpuUsage: number
  memoryUsage: number
  uptime: number
  lastCheck: string
}

interface CostMetric {
  period: string
  compute: number
  storage: number
  network: number
  total: number
  efficiency: number
}

interface ScalingEvent {
  id: string
  timestamp: string
  type: 'scale_up' | 'scale_down' | 'manual_override'
  reason: string
  instanceCount: number
  cost: number
}

interface PlatformScalingMetricsProps {
  organizationId?: string
  refreshInterval?: number
  showHistoricalData?: boolean
  enableRealTimeUpdates?: boolean
  className?: string
}

export function PlatformScalingMetrics({
  organizationId,
  refreshInterval = 30000,
  showHistoricalData = true,
  enableRealTimeUpdates = true,
  className = ''
}: PlatformScalingMetricsProps) {
  // State management
  const [realTimeMetrics, setRealTimeMetrics] = useState<MetricData[]>([])
  const [instanceHealth, setInstanceHealth] = useState<InstanceHealth[]>([])
  const [costMetrics, setCostMetrics] = useState<CostMetric[]>([])
  const [scalingEvents, setScalingEvents] = useState<ScalingEvent[]>([])
  const [isAutoScalingEnabled, setIsAutoScalingEnabled] = useState(true)
  const [isManualOverride, setIsManualOverride] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [activeAlerts, setActiveAlerts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form management
  const scalingForm = useForm<ScalingConfig>({
    resolver: zodResolver(scalingConfigSchema),
    defaultValues: {
      autoScalingEnabled: true,
      minInstances: 2,
      maxInstances: 10,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      cooldownPeriod: 300
    }
  })

  const alertForm = useForm<AlertConfig>({
    resolver: zodResolver(alertConfigSchema),
    defaultValues: {
      cpuAlertThreshold: 85,
      memoryAlertThreshold: 90,
      diskAlertThreshold: 85,
      errorRateThreshold: 5,
      responseTimeThreshold: 2000,
      alertsEnabled: true,
      notificationChannels: ['email']
    }
  })

  // Mock data generators
  const generateMockMetrics = useCallback((): MetricData[] => {
    const now = new Date()
    return Array.from({ length: 24 }, (_, i) => ({
      timestamp: format(new Date(now.getTime() - (23 - i) * 3600000), 'HH:mm'),
      cpuUtilization: Math.floor(Math.random() * 40 + 30),
      memoryUtilization: Math.floor(Math.random() * 35 + 45),
      diskUtilization: Math.floor(Math.random() * 25 + 25),
      networkIn: Math.floor(Math.random() * 500 + 100),
      networkOut: Math.floor(Math.random() * 300 + 50),
      activeConnections: Math.floor(Math.random() * 1000 + 500),
      responseTime: Math.floor(Math.random() * 500 + 200),
      errorRate: Math.random() * 5,
      throughput: Math.floor(Math.random() * 5000 + 2000)
    }))
  }, [])

  const generateMockInstances = useCallback((): InstanceHealth[] => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: `instance-${i + 1}`,
      name: `web-server-${i + 1}`,
      status: ['healthy', 'healthy', 'healthy', 'warning', 'healthy'][Math.floor(Math.random() * 5)] as any,
      cpuUsage: Math.floor(Math.random() * 80 + 10),
      memoryUsage: Math.floor(Math.random() * 75 + 15),
      uptime: Math.floor(Math.random() * 168) + 1,
      lastCheck: format(new Date(Date.now() - Math.random() * 300000), "MMM d, HH:mm")
    }))
  }, [])

  const generateMockCostMetrics = useCallback((): CostMetric[] => {
    return Array.from({ length: 7 }, (_, i) => ({
      period: format(new Date(Date.now() - (6 - i) * 86400000), 'MMM d'),
      compute: Math.floor(Math.random() * 500 + 300),
      storage: Math.floor(Math.random() * 150 + 50),
      network: Math.floor(Math.random() * 100 + 30),
      total: 0,
      efficiency: Math.floor(Math.random() * 20 + 75)
    })).map(item => ({
      ...item,
      total: item.compute + item.storage + item.network
    }))
  }, [])

  // Effects
  useEffect(() => {
    const initializeData = () => {
      setRealTimeMetrics(generateMockMetrics())
      setInstanceHealth(generateMockInstances())
      setCostMetrics(generateMockCostMetrics())
      setIsLoading(false)
    }

    initializeData()
  }, [generateMockMetrics, generateMockInstances, generateMockCostMetrics])

  useEffect(() => {
    if (!enableRealTimeUpdates) return

    const interval = setInterval(() => {
      setRealTimeMetrics(generateMockMetrics())
      setInstanceHealth(generateMockInstances())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [enableRealTimeUpdates, refreshInterval, generateMockMetrics, generateMockInstances])

  // Handlers
  const handleScalingConfigSubmit = (data: ScalingConfig) => {
    console.log('Updating scaling configuration:', data)
    setIsAutoScalingEnabled(data.autoScalingEnabled)
  }

  const handleManualScaling = (action: 'up' | 'down', count: number) => {
    console.log(`Manual scaling ${action} by ${count} instances`)
    setIsManualOverride(true)
    setTimeout(() => setIsManualOverride(false), 5000)
  }

  const handleEmergencyStop = () => {
    console.log('Emergency scaling stop triggered')
    setIsAutoScalingEnabled(false)
    setIsManualOverride(true)
  }

  const currentMetrics = realTimeMetrics[realTimeMetrics.length - 1]
  const healthyInstances = instanceHealth.filter(i => i.status === 'healthy').length
  const totalCost = costMetrics[costMetrics.length - 1]?.total || 0
  const avgEfficiency = costMetrics.reduce((acc, m) => acc + m.efficiency, 0) / costMetrics.length || 0

  const statusColors = {
    healthy: '#22c55e',
    warning: '#f59e0b',
    critical: '#ef4444',
    offline: '#6b7280'
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Instances</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instanceHealth.length}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">{healthyInstances} healthy</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Utilization</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMetrics?.cpuUtilization || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {currentMetrics?.cpuUtilization > 70 ? (
                <TrendingUp className="inline h-3 w-3 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="inline h-3 w-3 text-green-500 mr-1" />
              )}
              vs target 70%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost}</div>
            <p className="text-xs text-muted-foreground">
              {avgEfficiency.toFixed(1)}% efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Scaling</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={isAutoScalingEnabled ? 'default' : 'secondary'}>
                {isAutoScalingEnabled ? 'Active' : 'Disabled'}
              </Badge>
              {isManualOverride && (
                <Badge variant="outline">Manual</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {scalingEvents.length} events today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Alerts</AlertTitle>
          <AlertDescription>
            {activeAlerts.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="scaling">Scaling</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>CPU, Memory, and Disk usage over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={realTimeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cpuUtilization"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="CPU %"
                    />
                    <Line
                      type="monotone"
                      dataKey="memoryUtilization"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Memory %"
                    />
                    <Line
                      type="monotone"
                      dataKey="diskUtilization"
                      stroke="#ffc658"
                      strokeWidth={2}
                      name="Disk %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Traffic</CardTitle>
                <CardDescription>Inbound and outbound network activity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={realTimeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="networkIn"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      name="Network In (MB)"
                    />
                    <Area
                      type="monotone"
                      dataKey="networkOut"
                      stackId="1"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      name="Network Out (MB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Response time and error rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={realTimeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#ff7300"
                      strokeWidth={2}
                      name="Response Time (ms)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#ff0000"
                      strokeWidth={2}
                      name="Error Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
                <CardDescription>Requests per minute</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={realTimeMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="throughput" fill="#8884d8" name="Requests/min" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {instanceHealth.map((instance) => (
              <Card key={instance.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{instance.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      {instance.status === 'healthy' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {instance.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                      {instance.status === 'critical' && <XCircle className="h-4 w-4 text-red-500" />}
                      {instance.status === 'offline' && <XCircle className="h-4 w-4 text-gray-500" />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU:</span>
                    <span className={instance.cpuUsage > 80 ? 'text-red-500' : ''}>{instance.cpuUsage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Memory:</span>
                    <span className={instance.memoryUsage > 85 ? 'text-red-500' : ''}>{instance.memoryUsage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Uptime:</span>
                    <span>{instance.uptime}h</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last check: {instance.lastCheck}
                  </div>
                  <Badge variant={instance.status === 'healthy' ? 'default' : 'destructive'} className="w-full justify-center">
                    {instance.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">