```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitBranch, 
  Play, 
  Pause, 
  RotateCcw, 
  Server, 
  TrendingUp, 
  XCircle,
  Zap,
  Database,
  Globe,
  Shield
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface PipelineStage {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: string
  endTime?: string
  duration?: number
  logs?: string[]
}

interface HealthCheck {
  id: string
  service: string
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  responseTime: number
  lastCheck: string
  endpoint: string
  message?: string
}

interface PerformanceMetric {
  timestamp: string
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  throughput: number
  errorRate: number
}

interface AutomatedDecision {
  id: string
  timestamp: string
  type: 'scaling' | 'rollback' | 'health_check' | 'performance'
  decision: string
  confidence: number
  reason: string
  impact: 'low' | 'medium' | 'high'
}

interface DeploymentStatus {
  id: string
  environment: string
  version: string
  status: 'deploying' | 'completed' | 'failed' | 'rolling_back'
  progress: number
  startTime: string
  estimatedCompletion?: string
  branch: string
  commit: string
}

interface CriticalAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  timestamp: string
  resolved: boolean
  service?: string
}

interface DeploymentStatusInterfaceProps {
  deploymentId?: string
  environment?: string
  refreshInterval?: number
  onRollback?: (deploymentId: string) => void
  onPause?: (deploymentId: string) => void
  onResume?: (deploymentId: string) => void
  className?: string
}

export default function DeploymentStatusInterface({
  deploymentId,
  environment = 'production',
  refreshInterval = 5000,
  onRollback,
  onPause,
  onResume,
  className = ''
}: DeploymentStatusInterfaceProps) {
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null)
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([])
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [automatedDecisions, setAutomatedDecisions] = useState<AutomatedDecision[]>([])
  const [alerts, setAlerts] = useState<CriticalAlert[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Mock data generation for demo purposes
  const generateMockData = () => {
    const mockDeployment: DeploymentStatus = {
      id: deploymentId || 'dep-001',
      environment,
      version: 'v2.3.1',
      status: 'deploying',
      progress: Math.floor(Math.random() * 100),
      startTime: new Date(Date.now() - 300000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 180000).toISOString(),
      branch: 'main',
      commit: 'a1b2c3d'
    }

    const mockStages: PipelineStage[] = [
      {
        id: 'build',
        name: 'Build',
        status: 'completed',
        startTime: new Date(Date.now() - 250000).toISOString(),
        endTime: new Date(Date.now() - 200000).toISOString(),
        duration: 50000
      },
      {
        id: 'test',
        name: 'Test',
        status: 'completed',
        startTime: new Date(Date.now() - 200000).toISOString(),
        endTime: new Date(Date.now() - 150000).toISOString(),
        duration: 50000
      },
      {
        id: 'deploy',
        name: 'Deploy',
        status: 'running',
        startTime: new Date(Date.now() - 100000).toISOString(),
      },
      {
        id: 'verify',
        name: 'Verify',
        status: 'pending'
      }
    ]

    const mockHealthChecks: HealthCheck[] = [
      {
        id: 'api',
        service: 'API Gateway',
        status: 'healthy',
        responseTime: 45,
        lastCheck: new Date().toISOString(),
        endpoint: '/health'
      },
      {
        id: 'db',
        service: 'Database',
        status: 'healthy',
        responseTime: 12,
        lastCheck: new Date().toISOString(),
        endpoint: '/db/health'
      },
      {
        id: 'cache',
        service: 'Redis Cache',
        status: 'warning',
        responseTime: 89,
        lastCheck: new Date().toISOString(),
        endpoint: '/cache/ping',
        message: 'High response time'
      },
      {
        id: 'cdn',
        service: 'CDN',
        status: 'healthy',
        responseTime: 23,
        lastCheck: new Date().toISOString(),
        endpoint: '/cdn/status'
      }
    ]

    const mockMetrics: PerformanceMetric[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(Date.now() - (19 - i) * 30000).toISOString(),
      cpuUsage: Math.floor(Math.random() * 80) + 10,
      memoryUsage: Math.floor(Math.random() * 70) + 20,
      responseTime: Math.floor(Math.random() * 200) + 50,
      throughput: Math.floor(Math.random() * 1000) + 500,
      errorRate: Math.random() * 5
    }))

    const mockDecisions: AutomatedDecision[] = [
      {
        id: 'decision-1',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        type: 'scaling',
        decision: 'Scale up API instances to 5',
        confidence: 0.92,
        reason: 'High CPU usage detected',
        impact: 'medium'
      },
      {
        id: 'decision-2',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'health_check',
        decision: 'Restart Redis service',
        confidence: 0.87,
        reason: 'Response time threshold exceeded',
        impact: 'low'
      }
    ]

    const mockAlerts: CriticalAlert[] = [
      {
        id: 'alert-1',
        severity: 'warning',
        title: 'High Memory Usage',
        description: 'Memory usage is above 85% threshold',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        resolved: false,
        service: 'API Gateway'
      }
    ]

    setDeploymentStatus(mockDeployment)
    setPipelineStages(mockStages)
    setHealthChecks(mockHealthChecks)
    setPerformanceMetrics(mockMetrics)
    setAutomatedDecisions(mockDecisions)
    setAlerts(mockAlerts)
    setIsConnected(true)
    setLastUpdate(new Date())
  }

  useEffect(() => {
    generateMockData()
    const interval = setInterval(generateMockData, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'healthy':
        return 'text-green-500'
      case 'running':
      case 'deploying':
        return 'text-blue-500'
      case 'failed':
      case 'critical':
        return 'text-red-500'
      case 'warning':
        return 'text-yellow-500'
      case 'pending':
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />
      case 'running':
      case 'deploying':
        return <Activity className="w-4 h-4 animate-spin" />
      case 'failed':
      case 'critical':
        return <XCircle className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      case 'pending':
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
  }

  const currentMetrics = useMemo(() => {
    return performanceMetrics[performanceMetrics.length - 1] || {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0
    }
  }, [performanceMetrics])

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header with deployment info and controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Deployment Status</h1>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </span>
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>

        {deploymentStatus && (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause?.(deploymentStatus.id)}
              disabled={deploymentStatus.status !== 'deploying'}
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume?.(deploymentStatus.id)}
              disabled={deploymentStatus.status === 'deploying'}
            >
              <Play className="w-4 h-4 mr-1" />
              Resume
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRollback?.(deploymentStatus.id)}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Rollback
            </Button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.filter(alert => !alert.resolved).length > 0 && (
        <div className="space-y-2">
          {alerts.filter(alert => !alert.resolved).map(alert => (
            <Alert key={alert.id} className={alert.severity === 'critical' ? 'border-red-500' : 'border-yellow-500'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{alert.title}</strong> - {alert.description}
                {alert.service && <span className="text-muted-foreground ml-2">({alert.service})</span>}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Deployment Progress */}
      {deploymentStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <GitBranch className="w-5 h-5" />
              <span>Current Deployment</span>
              <Badge variant={deploymentStatus.status === 'completed' ? 'default' : 'secondary'}>
                {deploymentStatus.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Environment</div>
                  <div className="font-medium">{deploymentStatus.environment}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Version</div>
                  <div className="font-medium">{deploymentStatus.version}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Branch</div>
                  <div className="font-medium">{deploymentStatus.branch}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Commit</div>
                  <div className="font-medium font-mono">{deploymentStatus.commit}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{deploymentStatus.progress}%</span>
                </div>
                <Progress value={deploymentStatus.progress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 overflow-x-auto pb-4">
            {pipelineStages.map((stage, index) => (
              <div key={stage.id} className="flex items-center space-x-4 min-w-max">
                <div className="flex flex-col items-center space-y-2">
                  <div className={`p-3 rounded-full border-2 ${getStatusColor(stage.status)} border-current`}>
                    {getStatusIcon(stage.status)}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{stage.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stage.duration ? formatDuration(stage.duration) : stage.status}
                    </div>
                  </div>
                </div>
                {index < pipelineStages.length - 1 && (
                  <div className="h-0.5 w-8 bg-border"></div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Checks and Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Checks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Health Checks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthChecks.map(check => (
                <div key={check.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <div className={getStatusColor(check.status)}>
                      {check.status === 'healthy' ? <CheckCircle className="w-4 h-4" /> :
                       check.status === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                       check.status === 'critical' ? <XCircle className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-medium">{check.service}</div>
                      <div className="text-xs text-muted-foreground">
                        {check.responseTime}ms • {check.endpoint}
                      </div>
                      {check.message && (
                        <div className="text-xs text-yellow-600">{check.message}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant={check.status === 'healthy' ? 'default' : 
                                 check.status === 'warning' ? 'secondary' : 'destructive'}>
                    {check.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Current Metrics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">CPU Usage</div>
                <div className="text-2xl font-bold">{currentMetrics.cpuUsage}%</div>
                <Progress value={currentMetrics.cpuUsage} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Memory Usage</div>
                <div className="text-2xl font-bold">{currentMetrics.memoryUsage}%</div>
                <Progress value={currentMetrics.memoryUsage} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Response Time</div>
                <div className="text-2xl font-bold">{currentMetrics.responseTime}ms</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Throughput</div>
                <div className="text-2xl font-bold">{currentMetrics.throughput}</div>
                <div className="text-xs text-muted-foreground">req/min</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="cpuUsage" 
                  stroke="#8884d8" 
                  name="CPU Usage (%)"
                />
                <Line 
                  type="monotone" 
                  dataKey="memoryUsage" 
                  stroke="#82ca9d" 
                  name="Memory Usage (%)"
                />
                <Line 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#ffc658" 
                  name="Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Automated Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Automated Decisions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {automatedDecisions.map(decision => (
              <div key={decision.id} className="p-4 rounded-lg border">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{decision.type}</Badge>
                      <Badge variant={decision.impact === 'high' ? 'destructive' : 
                                   decision.impact === 'medium' ? 'secondary' : 'default'}>
                        {decision.impact} impact
                      </Badge>
                    </div>
                    <div className="font-medium">{decision.decision}</div>
                    <div className="text-sm text-muted-foreground">{decision.reason}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm font-medium">
                      {Math.round(decision.confidence * 100)}% confidence
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>