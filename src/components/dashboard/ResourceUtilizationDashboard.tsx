"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  DollarSign, 
  HardDrive, 
  MemoryStick, 
  Network, 
  TrendingDown, 
  TrendingUp, 
  Wifi, 
  Zap,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Settings
} from 'lucide-react'

interface ResourceMetric {
  id: string
  name: string
  value: number
  threshold: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

interface ServiceResource {
  serviceId: string
  serviceName: string
  cpu: number
  memory: number
  disk: number
  network: number
  status: 'healthy' | 'warning' | 'critical'
  instances: number
  cost: number
}

interface TimeSeriesData {
  timestamp: string
  cpu: number
  memory: number
  disk: number
  network: number
}

interface OptimizationRecommendation {
  id: string
  type: 'scale_down' | 'scale_up' | 'migrate' | 'optimize'
  priority: 'high' | 'medium' | 'low'
  service: string
  description: string
  estimatedSavings?: number
  estimatedImpact: string
  actionable: boolean
}

interface ResourceAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  service: string
  metric: string
  value: number
  threshold: number
  timestamp: string
  acknowledged: boolean
}

interface ResourceUtilizationDashboardProps {
  className?: string
  refreshInterval?: number
  enableRealtime?: boolean
  onServiceSelect?: (serviceId: string) => void
  onRecommendationAction?: (recommendationId: string, action: string) => void
  onAlertAcknowledge?: (alertId: string) => void
}

const ResourceUtilizationDashboard: React.FC<ResourceUtilizationDashboardProps> = ({
  className = "",
  refreshInterval = 30000,
  enableRealtime = true,
  onServiceSelect,
  onRecommendationAction,
  onAlertAcknowledge
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h')
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['overview']))
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Mock data - replace with actual data fetching hooks
  const resourceMetrics: ResourceMetric[] = [
    {
      id: 'cpu',
      name: 'CPU Usage',
      value: 68,
      threshold: 80,
      unit: '%',
      status: 'healthy',
      trend: 'up',
      trendPercentage: 5.2
    },
    {
      id: 'memory',
      name: 'Memory Usage',
      value: 84,
      threshold: 85,
      unit: '%',
      status: 'warning',
      trend: 'up',
      trendPercentage: 12.1
    },
    {
      id: 'disk',
      name: 'Disk Usage',
      value: 45,
      threshold: 90,
      unit: '%',
      status: 'healthy',
      trend: 'stable',
      trendPercentage: 0.8
    },
    {
      id: 'network',
      name: 'Network I/O',
      value: 32,
      threshold: 75,
      unit: 'Mbps',
      status: 'healthy',
      trend: 'down',
      trendPercentage: -3.4
    }
  ]

  const serviceResources: ServiceResource[] = [
    {
      serviceId: 'audio-processing',
      serviceName: 'Audio Processing',
      cpu: 72,
      memory: 68,
      disk: 34,
      network: 45,
      status: 'healthy',
      instances: 8,
      cost: 2847.50
    },
    {
      serviceId: 'ai-analysis',
      serviceName: 'AI Analysis',
      cpu: 89,
      memory: 94,
      disk: 28,
      network: 67,
      status: 'warning',
      instances: 12,
      cost: 4325.20
    },
    {
      serviceId: 'storage',
      serviceName: 'Storage Service',
      cpu: 23,
      memory: 45,
      disk: 78,
      network: 12,
      status: 'healthy',
      instances: 4,
      cost: 1892.30
    },
    {
      serviceId: 'api-gateway',
      serviceName: 'API Gateway',
      cpu: 45,
      memory: 52,
      disk: 19,
      network: 89,
      status: 'healthy',
      instances: 6,
      cost: 1654.80
    }
  ]

  const timeSeriesData: TimeSeriesData[] = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60000).toISOString(),
    cpu: Math.random() * 40 + 50,
    memory: Math.random() * 30 + 60,
    disk: Math.random() * 20 + 30,
    network: Math.random() * 50 + 25
  }))

  const optimizationRecommendations: OptimizationRecommendation[] = [
    {
      id: 'rec1',
      type: 'scale_down',
      priority: 'high',
      service: 'Storage Service',
      description: 'Scale down storage service instances during off-peak hours',
      estimatedSavings: 340.50,
      estimatedImpact: 'No performance impact expected',
      actionable: true
    },
    {
      id: 'rec2',
      type: 'optimize',
      priority: 'medium',
      service: 'AI Analysis',
      description: 'Optimize memory allocation for AI analysis workloads',
      estimatedSavings: 185.20,
      estimatedImpact: '15% performance improvement',
      actionable: true
    },
    {
      id: 'rec3',
      type: 'migrate',
      priority: 'low',
      service: 'API Gateway',
      description: 'Consider migrating to spot instances for development environments',
      estimatedSavings: 245.80,
      estimatedImpact: 'Potential brief interruptions',
      actionable: false
    }
  ]

  const resourceAlerts: ResourceAlert[] = [
    {
      id: 'alert1',
      severity: 'warning',
      service: 'AI Analysis',
      metric: 'Memory Usage',
      value: 94,
      threshold: 85,
      timestamp: new Date(Date.now() - 300000).toISOString(),
      acknowledged: false
    },
    {
      id: 'alert2',
      severity: 'critical',
      service: 'Audio Processing',
      metric: 'CPU Usage',
      value: 96,
      threshold: 90,
      timestamp: new Date(Date.now() - 120000).toISOString(),
      acknowledged: false
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getMetricIcon = (metricId: string) => {
    switch (metricId) {
      case 'cpu': return <Cpu className="h-5 w-5" />
      case 'memory': return <MemoryStick className="h-5 w-5" />
      case 'disk': return <HardDrive className="h-5 w-5" />
      case 'network': return <Network className="h-5 w-5" />
      default: return <Activity className="h-5 w-5" />
    }
  }

  const togglePanel = (panelId: string) => {
    const newExpanded = new Set(expandedPanels)
    if (newExpanded.has(panelId)) {
      newExpanded.delete(panelId)
    } else {
      newExpanded.add(panelId)
    }
    setExpandedPanels(newExpanded)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId)
    onServiceSelect?.(serviceId)
  }

  const totalCost = useMemo(() => 
    serviceResources.reduce((sum, service) => sum + service.cost, 0)
  , [serviceResources])

  const averageUtilization = useMemo(() => {
    const metrics = resourceMetrics.filter(m => m.unit === '%')
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
  }, [resourceMetrics])

  return (
    <div className={`space-y-6 ${className}`} role="main" aria-label="Resource Utilization Dashboard">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resource Utilization</h1>
          <p className="text-muted-foreground">
            Monitor and optimize platform resource usage across all services
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Tabs value={timeRange} onValueChange={(value: any) => setTimeRange(value)} className="w-auto">
            <TabsList>
              <TabsTrigger value="1h">1H</TabsTrigger>
              <TabsTrigger value="6h">6H</TabsTrigger>
              <TabsTrigger value="24h">24H</TabsTrigger>
              <TabsTrigger value="7d">7D</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      {resourceAlerts.filter(alert => !alert.acknowledged).length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Alerts ({resourceAlerts.filter(alert => !alert.acknowledged).length})</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-2">
              {resourceAlerts.filter(alert => !alert.acknowledged).slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between text-sm">
                  <span>
                    {alert.service}: {alert.metric} at {alert.value}{alert.metric.includes('Usage') ? '%' : 'Mbps'}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onAlertAcknowledge?.(alert.id)}
                    aria-label={`Acknowledge alert for ${alert.service}`}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Resource Metrics Overview */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => togglePanel('overview')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {expandedPanels.has('overview') ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
              <span>Resource Metrics Overview</span>
            </CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Avg Utilization: {averageUtilization.toFixed(1)}%</span>
              <span>Monthly Cost: ${totalCost.toLocaleString()}</span>
            </div>
          </div>
        </CardHeader>
        {expandedPanels.has('overview') && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {resourceMetrics.map((metric) => (
                <Card key={metric.id} className={`border-l-4 ${
                  metric.status === 'healthy' ? 'border-l-green-500' :
                  metric.status === 'warning' ? 'border-l-yellow-500' :
                  'border-l-red-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getMetricIcon(metric.id)}
                        <div>
                          <p className="text-sm font-medium leading-none">{metric.name}</p>
                          <p className="text-2xl font-bold">{metric.value}{metric.unit}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(metric.status)}
                        >
                          {getStatusIcon(metric.status)}
                          {metric.status}
                        </Badge>
                        <div className="flex items-center mt-1">
                          {getTrendIcon(metric.trend)}
                          <span className="text-xs ml-1">
                            {metric.trendPercentage > 0 ? '+' : ''}{metric.trendPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress 
                        value={(metric.value / metric.threshold) * 100} 
                        className="w-full"
                        aria-label={`${metric.name}: ${metric.value}${metric.unit} of ${metric.threshold}${metric.unit} threshold`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0{metric.unit}</span>
                        <span>{metric.threshold}{metric.unit}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Service Resource Chart */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => togglePanel('charts')}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {expandedPanels.has('charts') ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
              <span>Service Resource Trends</span>
            </CardTitle>
          </div>
        </CardHeader>
        {expandedPanels.has('charts') && (
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name.toUpperCase()]}
                  />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="disk" stackId="1" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="network" stackId="1" stroke="#ff7c7c" fill="#ff7c7c" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Service Details and Resource Matrix */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Resource Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Service Resource Matrix</CardTitle>
            <CardDescription>Resource utilization across all services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceResources.map((service) => (
                <div 
                  key={service.serviceId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedService === service.serviceId ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => handleServiceSelect(service.serviceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleServiceSelect(service.serviceId)
                    }
                  }}
                  aria-label={`Select ${service.serviceName} service`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{service.serviceName}</h4>
                      <Badge 
                        variant="secondary"
                        className={getStatusColor(service.status)}
                      >
                        {service.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {service.instances} instances • ${service.cost.toLocaleString()}/mo
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-1">
                        <Cpu className="h-3 w-3" />
                        <span>CPU</span>
                      </div>
                      <Progress value={service.cpu} className="h-2" />
                      <span className="text-xs">{service.cpu}%</span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-1">
                        <MemoryStick className="h-3 w-3" />
                        <span>Memory</span>
                      </div>
                      <Progress value={service.memory} className="h-2" />
                      <span className="text-xs">{service.memory}%</span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-1">
                        <HardDrive className="h-3 w-3" />
                        <span>Disk</span>
                      </div>
                      <Progress value={service.disk} className="h-2" />
                      <span className="text-xs">{service.disk}%</span>