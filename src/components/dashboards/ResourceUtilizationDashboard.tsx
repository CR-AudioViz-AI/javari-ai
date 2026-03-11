```tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Activity, 
  Cpu, 
  Database, 
  HardDrive, 
  Network, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react'

// Types
interface ResourceMetric {
  id: string
  name: string
  type: 'compute' | 'storage' | 'bandwidth' | 'database' | 'memory'
  current: number
  capacity: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  cost: number
  threshold: {
    warning: number
    critical: number
  }
}

interface HistoricalData {
  timestamp: string
  cpu: number
  memory: number
  storage: number
  bandwidth: number
  database: number
}

interface ServiceHealth {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'offline'
  uptime: number
  responseTime: number
  errorRate: number
  lastCheck: string
}

interface CapacityPrediction {
  resource: string
  currentUtilization: number
  predictedUtilization: number
  timeToCapacity: string
  recommendedAction: string
  confidence: number
}

interface CostProjection {
  current: number
  projected: number
  period: string
  breakdown: Array<{
    service: string
    current: number
    projected: number
  }>
}

interface AlertItem {
  id: string
  type: 'warning' | 'critical' | 'info'
  resource: string
  message: string
  timestamp: string
  acknowledged: boolean
}

interface ScalingRecommendation {
  id: string
  resource: string
  currentCapacity: number
  recommendedCapacity: number
  reason: string
  impact: string
  priority: 'low' | 'medium' | 'high'
  estimatedCost: number
}

interface ResourceUtilizationDashboardProps {
  refreshInterval?: number
  showCostProjections?: boolean
  enableRealTimeUpdates?: boolean
  className?: string
  onAlertAcknowledge?: (alertId: string) => void
  onScalingAction?: (recommendationId: string, action: 'apply' | 'dismiss') => void
}

// Mock data generators
const generateResourceMetrics = (): ResourceMetric[] => [
  {
    id: 'cpu',
    name: 'CPU Usage',
    type: 'compute',
    current: 68,
    capacity: 100,
    unit: '%',
    trend: 'up',
    cost: 245.50,
    threshold: { warning: 70, critical: 90 }
  },
  {
    id: 'memory',
    name: 'Memory Usage',
    type: 'memory',
    current: 42,
    capacity: 64,
    unit: 'GB',
    trend: 'stable',
    cost: 180.20,
    threshold: { warning: 50, critical: 58 }
  },
  {
    id: 'storage',
    name: 'Storage Usage',
    type: 'storage',
    current: 1.2,
    capacity: 2.0,
    unit: 'TB',
    trend: 'up',
    cost: 120.00,
    threshold: { warning: 1.6, critical: 1.8 }
  },
  {
    id: 'bandwidth',
    name: 'Bandwidth Usage',
    type: 'bandwidth',
    current: 850,
    capacity: 1000,
    unit: 'Mbps',
    trend: 'down',
    cost: 320.75,
    threshold: { warning: 800, critical: 950 }
  },
  {
    id: 'database',
    name: 'Database Connections',
    type: 'database',
    current: 145,
    capacity: 200,
    unit: 'connections',
    trend: 'stable',
    cost: 95.30,
    threshold: { warning: 160, critical: 180 }
  }
]

const generateHistoricalData = (): HistoricalData[] => {
  const data: HistoricalData[] = []
  const now = new Date()
  
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    data.push({
      timestamp: timestamp.toISOString(),
      cpu: 45 + Math.random() * 30,
      memory: 35 + Math.random() * 25,
      storage: 55 + Math.random() * 20,
      bandwidth: 60 + Math.random() * 25,
      database: 40 + Math.random() * 35
    })
  }
  
  return data
}

const generateServiceHealth = (): ServiceHealth[] => [
  {
    id: 'audio-processing',
    name: 'Audio Processing Service',
    status: 'healthy',
    uptime: 99.8,
    responseTime: 125,
    errorRate: 0.02,
    lastCheck: new Date().toISOString()
  },
  {
    id: 'api-gateway',
    name: 'API Gateway',
    status: 'warning',
    uptime: 99.2,
    responseTime: 280,
    errorRate: 0.15,
    lastCheck: new Date().toISOString()
  },
  {
    id: 'database',
    name: 'Database Cluster',
    status: 'healthy',
    uptime: 99.9,
    responseTime: 45,
    errorRate: 0.01,
    lastCheck: new Date().toISOString()
  },
  {
    id: 'storage',
    name: 'File Storage',
    status: 'critical',
    uptime: 97.5,
    responseTime: 450,
    errorRate: 2.1,
    lastCheck: new Date().toISOString()
  }
]

const ResourceUtilizationDashboard: React.FC<ResourceUtilizationDashboardProps> = ({
  refreshInterval = 30000,
  showCostProjections = true,
  enableRealTimeUpdates = true,
  className = '',
  onAlertAcknowledge,
  onScalingAction
}) => {
  // State
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetric[]>(generateResourceMetrics())
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>(generateHistoricalData())
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>(generateServiceHealth())
  const [capacityPredictions, setCapacityPredictions] = useState<CapacityPrediction[]>([])
  const [costProjections, setCostProjections] = useState<CostProjection | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [scalingRecommendations, setScalingRecommendations] = useState<ScalingRecommendation[]>([])
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')
  const [isLoading, setIsLoading] = useState(false)

  // Initialize data
  useEffect(() => {
    const initializeData = () => {
      // Generate capacity predictions
      const predictions: CapacityPrediction[] = resourceMetrics.map(metric => ({
        resource: metric.name,
        currentUtilization: (metric.current / metric.capacity) * 100,
        predictedUtilization: Math.min(95, (metric.current / metric.capacity) * 100 + Math.random() * 20),
        timeToCapacity: `${Math.floor(Math.random() * 30 + 7)} days`,
        recommendedAction: metric.current / metric.capacity > 0.7 ? 'Scale up' : 'Monitor',
        confidence: 0.85 + Math.random() * 0.1
      }))
      setCapacityPredictions(predictions)

      // Generate cost projections
      if (showCostProjections) {
        const totalCurrent = resourceMetrics.reduce((sum, metric) => sum + metric.cost, 0)
        setCostProjections({
          current: totalCurrent,
          projected: totalCurrent * (1.15 + Math.random() * 0.1),
          period: 'next 30 days',
          breakdown: resourceMetrics.map(metric => ({
            service: metric.name,
            current: metric.cost,
            projected: metric.cost * (1.1 + Math.random() * 0.2)
          }))
        })
      }

      // Generate alerts
      const alertsData: AlertItem[] = [
        {
          id: '1',
          type: 'warning',
          resource: 'CPU Usage',
          message: 'CPU utilization approaching threshold (68%)',
          timestamp: new Date().toISOString(),
          acknowledged: false
        },
        {
          id: '2',
          type: 'critical',
          resource: 'File Storage',
          message: 'Storage service experiencing high error rates',
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          acknowledged: false
        }
      ]
      setAlerts(alertsData)

      // Generate scaling recommendations
      const recommendations: ScalingRecommendation[] = [
        {
          id: '1',
          resource: 'CPU',
          currentCapacity: 4,
          recommendedCapacity: 6,
          reason: 'Sustained high utilization during peak hours',
          impact: '+50% processing capacity',
          priority: 'medium',
          estimatedCost: 89.50
        },
        {
          id: '2',
          resource: 'Database',
          currentCapacity: 200,
          recommendedCapacity: 300,
          reason: 'Connection pool nearing capacity',
          impact: '+50% concurrent connections',
          priority: 'high',
          estimatedCost: 45.20
        }
      ]
      setScalingRecommendations(recommendations)
    }

    initializeData()
  }, [resourceMetrics, showCostProjections])

  // Real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates) return

    const interval = setInterval(() => {
      setResourceMetrics(prev => prev.map(metric => ({
        ...metric,
        current: Math.max(0, metric.current + (Math.random() - 0.5) * 5),
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable'
      })))

      // Add new historical data point
      setHistoricalData(prev => {
        const newData = [...prev.slice(1)]
        newData.push({
          timestamp: new Date().toISOString(),
          cpu: 45 + Math.random() * 30,
          memory: 35 + Math.random() * 25,
          storage: 55 + Math.random() * 20,
          bandwidth: 60 + Math.random() * 25,
          database: 40 + Math.random() * 35
        })
        return newData
      })
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [enableRealTimeUpdates, refreshInterval])

  // Handlers
  const handleAlertAcknowledge = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
    onAlertAcknowledge?.(alertId)
  }, [onAlertAcknowledge])

  const handleScalingAction = useCallback((recommendationId: string, action: 'apply' | 'dismiss') => {
    if (action === 'apply') {
      setScalingRecommendations(prev => prev.filter(rec => rec.id !== recommendationId))
    } else {
      setScalingRecommendations(prev => prev.map(rec => 
        rec.id === recommendationId ? { ...rec, priority: 'low' } : rec
      ))
    }
    onScalingAction?.(recommendationId, action)
  }, [onScalingAction])

  // Utility functions
  const getMetricIcon = (type: ResourceMetric['type']) => {
    switch (type) {
      case 'compute': return <Cpu className="w-4 h-4" />
      case 'memory': return <Zap className="w-4 h-4" />
      case 'storage': return <HardDrive className="w-4 h-4" />
      case 'bandwidth': return <Network className="w-4 h-4" />
      case 'database': return <Database className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getStatusIcon = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />
      case 'offline': return <XCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getTrendIcon = (trend: ResourceMetric['trend']) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-red-500" />
      case 'down': return <TrendingDown className="w-3 h-3 text-green-500" />
      case 'stable': return <Activity className="w-3 h-3 text-blue-500" />
    }
  }

  const getUtilizationColor = (current: number, capacity: number, threshold: ResourceMetric['threshold']) => {
    const utilization = (current / capacity) * 100
    if (utilization >= threshold.critical) return 'text-red-500'
    if (utilization >= threshold.warning) return 'text-yellow-500'
    return 'text-green-500'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Chart colors
  const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Utilization</h1>
          <p className="text-muted-foreground">
            Monitor and optimize platform resource usage across all services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Activity className="w-3 h-3" />
            Live
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      {alerts.filter(alert => !alert.acknowledged).length > 0 && (
        <div className="space-y-2">
          {alerts
            .filter(alert => !alert.acknowledged)
            .map(alert => (
              <Alert key={alert.id} variant={alert.type === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.resource}</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleAlertAcknowledge(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </AlertDescription>
              </Alert>
            ))
          }
        </div>
      )}

      {/* Resource Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {resourceMetrics.map((metric) => {
          const utilizationPercentage = (metric.current / metric.capacity) * 100
          return (
            <Card key={metric.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {getMetricIcon(metric.type)}
                  {metric.name}
                </CardTitle>
                {getTrendIcon(metric.trend)}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-bold ${getUtilizationColor(metric.current, metric.capacity, metric.threshold)}`}>
                      {metric.current.toFixed(metric.type === 'storage' ? 1 : 0)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {metric.capacity} {metric.unit}
                    </span>
                  </div>
                  <Progress 
                    value={utilizationPercentage} 
                    className="h-2"
                    aria-label={`${metric.name} utilization`}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{utilizationPercentage.toFixed(1)}% used</span>
                    <span>{formatCurrency(metric.cost)}/month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Planning</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          <TabsTrigger value="health">Service Health</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Utilization Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Resource Utilization Trends
                </CardTitle>
                <CardDescription>
                  Resource usage patterns over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTime}
                      aria-label="Time"
                    />
                    <YAxis aria-label="Utilization percentage" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="cpu" 
                      stackId="1" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      name="CPU"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="memory" 
                      stackId="1" 
                      stroke="#ef4444" 
                      fill="#ef4444" 
                      name="Memory"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="storage" 
                      stackId="1" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      name="Storage"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bandwidth" 
                      stackId="1" 
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      name="Bandwidth"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="database" 
                      stackId="1" 
                      stroke="#8b5cf6" 
                      fill="#8b5cf6" 
                      name="Database"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resource Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4" />