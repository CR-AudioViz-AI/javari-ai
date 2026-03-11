'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitBranch, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Server,
  Eye,
  Filter,
  RefreshCw,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Square,
  AlertCircle,
  Info,
  XCircle,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Types
interface DeploymentPipeline {
  id: string
  name: string
  status: 'running' | 'success' | 'failed' | 'pending' | 'cancelled'
  environment: string
  branch: string
  commit: string
  startTime: Date
  endTime?: Date
  duration?: number
  stages: PipelineStage[]
  metrics: DeploymentMetrics
}

interface PipelineStage {
  id: string
  name: string
  status: 'running' | 'success' | 'failed' | 'pending' | 'skipped'
  startTime?: Date
  endTime?: Date
  duration?: number
  logs: string[]
}

interface DeploymentMetrics {
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  throughput: number
  errorRate: number
  uptime: number
}

interface Alert {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  dismissed: boolean
  pipelineId?: string
}

interface PredictiveInsight {
  type: 'failure_prediction' | 'performance_trend' | 'resource_forecast'
  confidence: number
  message: string
  recommendation: string
  timeline: string
}

interface DeploymentMonitoringDashboardProps {
  className?: string
  refreshInterval?: number
  enableAlerts?: boolean
  enablePredictiveAnalytics?: boolean
  onDeploymentSelect?: (deployment: DeploymentPipeline) => void
  onAlertDismiss?: (alertId: string) => void
}

const DeploymentMonitoringDashboard: React.FC<DeploymentMonitoringDashboardProps> = ({
  className = '',
  refreshInterval = 5000,
  enableAlerts = true,
  enablePredictiveAnalytics = true,
  onDeploymentSelect,
  onAlertDismiss
}) => {
  // State
  const [pipelines, setPipelines] = useState<DeploymentPipeline[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [insights, setInsights] = useState<PredictiveInsight[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Mock data generator
  const generateMockData = useCallback(() => {
    const environments = ['production', 'staging', 'development']
    const statuses: DeploymentPipeline['status'][] = ['running', 'success', 'failed', 'pending']
    const stageNames = ['Build', 'Test', 'Security Scan', 'Deploy', 'Verify']

    const mockPipelines: DeploymentPipeline[] = Array.from({ length: 8 }, (_, i) => {
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const environment = environments[Math.floor(Math.random() * environments.length)]
      const startTime = new Date(Date.now() - Math.random() * 86400000)
      const duration = status === 'running' ? undefined : Math.floor(Math.random() * 3600000)
      
      const stages: PipelineStage[] = stageNames.map((name, idx) => ({
        id: `${i}-stage-${idx}`,
        name,
        status: idx < 2 ? 'success' : idx === 2 && status === 'running' ? 'running' : 
                idx === 2 && status === 'failed' ? 'failed' : 'pending',
        startTime: idx < 2 ? new Date(startTime.getTime() + idx * 300000) : undefined,
        endTime: idx < 2 ? new Date(startTime.getTime() + (idx + 1) * 300000) : undefined,
        duration: idx < 2 ? 300000 : undefined,
        logs: [`${name} stage started`, `Processing ${name}...`, `${name} completed successfully`]
      }))

      return {
        id: `pipeline-${i}`,
        name: `App Deployment ${i + 1}`,
        status,
        environment,
        branch: `feature/branch-${i}`,
        commit: `abc123${i}`,
        startTime,
        endTime: duration ? new Date(startTime.getTime() + duration) : undefined,
        duration,
        stages,
        metrics: {
          cpuUsage: Math.floor(Math.random() * 100),
          memoryUsage: Math.floor(Math.random() * 100),
          responseTime: Math.floor(Math.random() * 1000),
          throughput: Math.floor(Math.random() * 10000),
          errorRate: Math.random() * 5,
          uptime: 95 + Math.random() * 5
        }
      }
    })

    const mockAlerts: Alert[] = [
      {
        id: 'alert-1',
        type: 'error',
        title: 'Deployment Failed',
        message: 'Pipeline deployment failed in production environment',
        timestamp: new Date(Date.now() - 300000),
        dismissed: false,
        pipelineId: 'pipeline-1'
      },
      {
        id: 'alert-2',
        type: 'warning',
        title: 'High CPU Usage',
        message: 'CPU usage exceeded 80% threshold in staging environment',
        timestamp: new Date(Date.now() - 600000),
        dismissed: false
      },
      {
        id: 'alert-3',
        type: 'info',
        title: 'Deployment Complete',
        message: 'Successfully deployed to production environment',
        timestamp: new Date(Date.now() - 900000),
        dismissed: false,
        pipelineId: 'pipeline-3'
      }
    ]

    const mockInsights: PredictiveInsight[] = [
      {
        type: 'failure_prediction',
        confidence: 85,
        message: 'High probability of deployment failure detected',
        recommendation: 'Review recent code changes and run additional tests',
        timeline: 'Next 2 hours'
      },
      {
        type: 'performance_trend',
        confidence: 92,
        message: 'Response time degradation trend detected',
        recommendation: 'Consider scaling resources or optimizing code',
        timeline: 'Next 24 hours'
      },
      {
        type: 'resource_forecast',
        confidence: 78,
        message: 'Memory usage approaching capacity limits',
        recommendation: 'Plan resource scaling for peak hours',
        timeline: 'Next 48 hours'
      }
    ]

    setPipelines(mockPipelines)
    setAlerts(mockAlerts)
    setInsights(mockInsights)
    setIsLoading(false)
  }, [])

  // Effects
  useEffect(() => {
    generateMockData()
  }, [generateMockData])

  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      generateMockData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled, refreshInterval, generateMockData])

  // Computed values
  const filteredPipelines = useMemo(() => {
    return pipelines.filter(pipeline => {
      const matchesEnvironment = filterEnvironment === 'all' || pipeline.environment === filterEnvironment
      const matchesStatus = filterStatus === 'all' || pipeline.status === filterStatus
      const matchesSearch = searchQuery === '' || 
        pipeline.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pipeline.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pipeline.commit.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesEnvironment && matchesStatus && matchesSearch
    })
  }, [pipelines, filterEnvironment, filterStatus, searchQuery])

  const activeAlerts = useMemo(() => {
    return alerts.filter(alert => !alert.dismissed)
  }, [alerts])

  const overallMetrics = useMemo(() => {
    if (pipelines.length === 0) return null

    const totalPipelines = pipelines.length
    const successfulPipelines = pipelines.filter(p => p.status === 'success').length
    const failedPipelines = pipelines.filter(p => p.status === 'failed').length
    const runningPipelines = pipelines.filter(p => p.status === 'running').length
    
    const avgMetrics = pipelines.reduce((acc, pipeline) => {
      acc.cpuUsage += pipeline.metrics.cpuUsage
      acc.memoryUsage += pipeline.metrics.memoryUsage
      acc.responseTime += pipeline.metrics.responseTime
      acc.throughput += pipeline.metrics.throughput
      acc.errorRate += pipeline.metrics.errorRate
      acc.uptime += pipeline.metrics.uptime
      return acc
    }, {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      uptime: 0
    })

    Object.keys(avgMetrics).forEach(key => {
      avgMetrics[key as keyof typeof avgMetrics] /= totalPipelines
    })

    return {
      totalPipelines,
      successfulPipelines,
      failedPipelines,
      runningPipelines,
      successRate: (successfulPipelines / totalPipelines) * 100,
      avgMetrics
    }
  }, [pipelines])

  // Event handlers
  const handlePipelineSelect = useCallback((pipeline: DeploymentPipeline) => {
    setSelectedPipeline(pipeline.id)
    onDeploymentSelect?.(pipeline)
  }, [onDeploymentSelect])

  const handleAlertDismiss = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    ))
    onAlertDismiss?.(alertId)
  }, [onAlertDismiss])

  const getStatusColor = (status: DeploymentPipeline['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'running': return 'text-blue-600 bg-blue-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: DeploymentPipeline['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <XCircle className="h-4 w-4" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'cancelled': return <Square className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'info': return <Info className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={`space-y-6 p-6 ${className}`} role="main" aria-label="Deployment Monitoring Dashboard">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deployment Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time monitoring of deployment pipelines and system health
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="real-time"
                checked={isRealTimeEnabled}
                onCheckedChange={setIsRealTimeEnabled}
                aria-label="Toggle real-time updates"
              />
              <Label htmlFor="real-time" className="text-sm">
                Real-time Updates
              </Label>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={generateMockData}
              disabled={isLoading}
              aria-label="Refresh data"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts Banner */}
        {enableAlerts && activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => (
              <Alert key={alert.id} className={`
                ${alert.type === 'error' ? 'border-red-200 bg-red-50' : ''}
                ${alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
                ${alert.type === 'info' ? 'border-blue-200 bg-blue-50' : ''}
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getAlertIcon(alert.type)}
                    <div>
                      <AlertTitle>{alert.title}</AlertTitle>
                      <AlertDescription>{alert.message}</AlertDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAlertDismiss(alert.id)}
                    aria-label={`Dismiss alert: ${alert.title}`}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Overview Cards */}
        {overallMetrics && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallMetrics.totalPipelines}</div>
                <p className="text-xs text-muted-foreground">
                  {overallMetrics.runningPipelines} running
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallMetrics.successRate.toFixed(1)}%
                </div>
                <Progress value={overallMetrics.successRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(overallMetrics.avgMetrics.responseTime)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Error rate: {overallMetrics.avgMetrics.errorRate.toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overallMetrics.avgMetrics.uptime.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  CPU: {Math.round(overallMetrics.avgMetrics.cpuUsage)}%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Deployments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Deployments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {filteredPipelines.slice(0, 5).map((pipeline) => (
                        <div
                          key={pipeline.id}
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handlePipelineSelect(pipeline)}
                          role="button"
                          tabIndex={0}
                          aria-label={`View pipeline ${pipeline.name}`}
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(pipeline.status)}
                            <div>
                              <div className="font-medium">{pipeline.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {pipeline.environment} • {pipeline.branch}
                              </div>
                            </div>
                          </div>
                          <Badge className={getStatusColor(pipeline.status)}>
                            {pipeline.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {overallMetrics && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>CPU Usage</span>
                          <span>{Math.round(overallMetrics.avgMetrics.cpuUsage)}%</span>
                        </div>
                        <Progress value={overallMetrics.avgMetrics.cpuUsage} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Memory Usage</span>
                          <span>{Math.round(overallMetrics.avgMetrics.memoryUsage)}%</span>
                        </div>
                        <Progress value={overallMetrics.avgMetrics.memoryUsage} />
                      </div>