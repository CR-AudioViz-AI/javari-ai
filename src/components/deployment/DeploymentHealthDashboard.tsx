```tsx
"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  GitBranch, 
  MemoryStick, 
  Network, 
  RefreshCw, 
  Server, 
  TrendingUp, 
  Zap,
  Play,
  Pause,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Environment {
  id: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'offline'
  healthScore: number
  lastDeployment: string
  activeServices: number
  totalServices: number
  responseTime: number
  errorRate: number
  uptime: number
}

interface AutonomousAction {
  id: string
  type: 'scale_up' | 'scale_down' | 'restart' | 'rollback' | 'failover' | 'optimize'
  description: string
  environment: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  timestamp: string
  impact: 'low' | 'medium' | 'high'
  duration?: number
}

interface SystemMetric {
  timestamp: string
  cpu: number
  memory: number
  disk: number
  network: number
  responseTime: number
  errorRate: number
  throughput: number
}

interface DeploymentEvent {
  id: string
  type: 'deployment' | 'rollback' | 'hotfix' | 'maintenance'
  environment: string
  version: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  timestamp: string
  author: string
  changes: number
}

interface AlertNotification {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  environment: string
  timestamp: string
  resolved: boolean
}

interface DeploymentHealthDashboardProps {
  className?: string
  refreshInterval?: number
  environments?: Environment[]
  onActionTrigger?: (action: string, environment: string) => void
  onAlertResolve?: (alertId: string) => void
}

const mockEnvironments: Environment[] = [
  {
    id: "prod",
    name: "Production",
    status: "healthy",
    healthScore: 95,
    lastDeployment: "2024-01-15T10:30:00Z",
    activeServices: 24,
    totalServices: 24,
    responseTime: 120,
    errorRate: 0.02,
    uptime: 99.98
  },
  {
    id: "staging",
    name: "Staging",
    status: "warning",
    healthScore: 78,
    lastDeployment: "2024-01-15T14:45:00Z",
    activeServices: 22,
    totalServices: 24,
    responseTime: 180,
    errorRate: 0.15,
    uptime: 98.5
  },
  {
    id: "dev",
    name: "Development",
    status: "healthy",
    healthScore: 88,
    lastDeployment: "2024-01-15T16:20:00Z",
    activeServices: 20,
    totalServices: 20,
    responseTime: 95,
    errorRate: 0.08,
    uptime: 99.2
  }
]

const mockActions: AutonomousAction[] = [
  {
    id: "1",
    type: "scale_up",
    description: "Auto-scaled web tier from 3 to 5 instances due to high CPU usage",
    environment: "Production",
    status: "completed",
    timestamp: "2024-01-15T16:45:00Z",
    impact: "medium",
    duration: 120
  },
  {
    id: "2",
    type: "restart",
    description: "Restarted database connection pool service",
    environment: "Staging",
    status: "executing",
    timestamp: "2024-01-15T16:40:00Z",
    impact: "low"
  }
]

const mockMetrics: SystemMetric[] = [
  { timestamp: "16:00", cpu: 45, memory: 62, disk: 78, network: 34, responseTime: 120, errorRate: 0.02, throughput: 1200 },
  { timestamp: "16:15", cpu: 52, memory: 65, disk: 78, network: 41, responseTime: 135, errorRate: 0.03, throughput: 1150 },
  { timestamp: "16:30", cpu: 48, memory: 63, disk: 79, network: 38, responseTime: 128, errorRate: 0.02, throughput: 1180 },
  { timestamp: "16:45", cpu: 41, memory: 60, disk: 79, network: 35, responseTime: 115, errorRate: 0.01, throughput: 1250 }
]

const mockAlerts: AlertNotification[] = [
  {
    id: "1",
    severity: "warning",
    title: "High Response Time",
    message: "Average response time exceeded 200ms threshold",
    environment: "Staging",
    timestamp: "2024-01-15T16:42:00Z",
    resolved: false
  },
  {
    id: "2",
    severity: "critical",
    title: "Service Unavailable",
    message: "Payment service is returning 503 errors",
    environment: "Production",
    timestamp: "2024-01-15T16:38:00Z",
    resolved: true
  }
]

export function DeploymentHealthDashboard({ 
  className,
  refreshInterval = 30000,
  environments = mockEnvironments,
  onActionTrigger,
  onAlertResolve 
}: DeploymentHealthDashboardProps) {
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("all")
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled, refreshInterval])

  const overallHealthScore = useMemo(() => {
    return Math.round(environments.reduce((acc, env) => acc + env.healthScore, 0) / environments.length)
  }, [environments])

  const statusCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 }
    environments.forEach(env => {
      counts[env.status]++
    })
    return counts
  }, [environments])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'offline': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle
      case 'warning': return AlertTriangle
      case 'critical': return AlertCircle
      case 'offline': return Server
      default: return Server
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'scale_up': return TrendingUp
      case 'scale_down': return TrendingUp
      case 'restart': return RefreshCw
      case 'rollback': return GitBranch
      case 'failover': return Zap
      case 'optimize': return Activity
      default: return Activity
    }
  }

  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployment Health Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of deployment health and autonomous operations
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isRealTimeEnabled ? "bg-green-500" : "bg-gray-400"
            )} />
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            {isRealTimeEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRealTimeEnabled ? "Pause" : "Resume"} Updates
          </Button>
        </div>
      </div>

      {/* Overall Health Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">Overall System Health</h3>
              <p className="text-muted-foreground">Aggregate health across all environments</p>
            </div>
            <div className="flex items-center space-x-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{overallHealthScore}%</div>
                <p className="text-sm text-muted-foreground">Health Score</p>
              </div>
              <div className="relative h-20 w-20">
                <svg className="h-20 w-20 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-muted stroke-current"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallHealthScore / 100)}`}
                    className="text-green-600 stroke-current transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {environments.map((env) => {
          const StatusIcon = getStatusIcon(env.status)
          return (
            <Card key={env.id} className={cn("border-2", getStatusColor(env.status))}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{env.name}</CardTitle>
                  <StatusIcon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Health Score</span>
                  <span className="font-semibold">{env.healthScore}%</span>
                </div>
                <Progress value={env.healthScore} className="h-2" />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Services</p>
                    <p className="font-medium">{env.activeServices}/{env.totalServices}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Response</p>
                    <p className="font-medium">{env.responseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Error Rate</p>
                    <p className="font-medium">{(env.errorRate * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uptime</p>
                    <p className="font-medium">{env.uptime.toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="actions">Autonomous Actions</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="timeline">Deployment Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <span>System Resources</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="CPU %" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memory" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Memory %" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Network className="h-5 w-5" />
                  <span>Response Time & Throughput</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="responseTime" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                      name="Response Time (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Autonomous Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {mockActions.map((action) => {
                    const ActionIcon = getActionIcon(action.type)
                    return (
                      <div 
                        key={action.id}
                        className="flex items-start space-x-4 p-4 rounded-lg border"
                      >
                        <div className="rounded-full p-2 bg-primary/10">
                          <ActionIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{action.description}</h4>
                            <Badge variant={action.status === 'completed' ? 'default' : 'secondary'}>
                              {action.status}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>{action.environment}</span>
                            <span>•</span>
                            <span>{new Date(action.timestamp).toLocaleTimeString()}</span>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {action.impact} impact
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-4">
            {mockAlerts.map((alert) => (
              <Alert 
                key={alert.id}
                className={cn(
                  "border-l-4",
                  alert.severity === 'critical' && "border-l-red-500 bg-red-50",
                  alert.severity === 'warning' && "border-l-yellow-500 bg-yellow-50",
                  alert.severity === 'info' && "border-l-blue-500 bg-blue-50"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <AlertDescription className="font-medium">
                        {alert.title}
                      </AlertDescription>
                      <Badge variant={alert.resolved ? 'default' : 'destructive'}>
                        {alert.resolved ? 'Resolved' : alert.severity}
                      </Badge>
                    </div>
                    <AlertDescription className="text-sm text-muted-foreground">
                      {alert.message}
                    </AlertDescription>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{alert.environment}</span>
                      <span>•</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onAlertResolve?.(alert.id)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Deployment Timeline</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center text-muted-foreground">
                  Deployment timeline visualization would be implemented here
                  with chronological deployment events, status changes, and impact analysis.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```