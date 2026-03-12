```tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  GitBranch, 
  Network, 
  Pause, 
  Play, 
  RotateCcw, 
  Settings, 
  Shield, 
  StopCircle, 
  Zap 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutonomousOperationsCenterProps {
  className?: string
  onOverride?: (operationId: string, action: string) => void
  onConfigurationChange?: (config: Record<string, any>) => void
  realTimeEnabled?: boolean
  userRole?: 'admin' | 'operator' | 'viewer'
}

interface DeploymentStatus {
  id: string
  service: string
  version: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number
  startTime: string
  estimatedCompletion?: string
  autonomous: boolean
  environment: string
}

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: number
  activeDeployments: number
  queuedDeployments: number
}

interface DecisionAuditEntry {
  id: string
  timestamp: string
  decision: string
  agent: string
  reasoning: string
  confidence: number
  outcome: 'success' | 'failure' | 'pending'
  manualOverride?: boolean
}

interface AlertEntry {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
  resolved: boolean
  source: string
}

interface AgentStatus {
  id: string
  name: string
  status: 'active' | 'inactive' | 'error'
  lastActivity: string
  decisionsToday: number
  successRate: number
}

const MOCK_DEPLOYMENTS: DeploymentStatus[] = [
  {
    id: 'dep-001',
    service: 'user-service',
    version: 'v2.1.3',
    status: 'running',
    progress: 75,
    startTime: '2024-01-15T10:30:00Z',
    estimatedCompletion: '2024-01-15T11:15:00Z',
    autonomous: true,
    environment: 'production'
  },
  {
    id: 'dep-002',
    service: 'payment-gateway',
    version: 'v1.8.2',
    status: 'completed',
    progress: 100,
    startTime: '2024-01-15T09:00:00Z',
    autonomous: true,
    environment: 'staging'
  },
  {
    id: 'dep-003',
    service: 'notification-service',
    version: 'v3.0.1',
    status: 'pending',
    progress: 0,
    startTime: '2024-01-15T11:00:00Z',
    autonomous: false,
    environment: 'production'
  }
]

const MOCK_METRICS: SystemMetrics = {
  cpu: 68,
  memory: 72,
  disk: 45,
  network: 23,
  activeDeployments: 3,
  queuedDeployments: 7
}

const MOCK_DECISIONS: DecisionAuditEntry[] = [
  {
    id: 'dec-001',
    timestamp: '2024-01-15T10:45:00Z',
    decision: 'Auto-rollback payment-gateway due to error rate spike',
    agent: 'DeploymentAgent-Alpha',
    reasoning: 'Error rate exceeded 5% threshold (current: 7.2%)',
    confidence: 0.92,
    outcome: 'success'
  },
  {
    id: 'dec-002',
    timestamp: '2024-01-15T10:30:00Z',
    decision: 'Proceed with user-service deployment',
    agent: 'DeploymentAgent-Beta',
    reasoning: 'All health checks passed, traffic patterns normal',
    confidence: 0.87,
    outcome: 'pending'
  }
]

const MOCK_ALERTS: AlertEntry[] = [
  {
    id: 'alert-001',
    severity: 'medium',
    message: 'CPU usage approaching 75% on deployment node-03',
    timestamp: '2024-01-15T10:50:00Z',
    resolved: false,
    source: 'ResourceMonitor'
  },
  {
    id: 'alert-002',
    severity: 'high',
    message: 'Database connection pool exhaustion detected',
    timestamp: '2024-01-15T10:35:00Z',
    resolved: true,
    source: 'DatabaseMonitor'
  }
]

const MOCK_AGENTS: AgentStatus[] = [
  {
    id: 'agent-001',
    name: 'DeploymentAgent-Alpha',
    status: 'active',
    lastActivity: '2024-01-15T10:45:00Z',
    decisionsToday: 23,
    successRate: 94.2
  },
  {
    id: 'agent-002',
    name: 'DeploymentAgent-Beta',
    status: 'active',
    lastActivity: '2024-01-15T10:30:00Z',
    decisionsToday: 18,
    successRate: 87.5
  }
]

export function AutonomousOperationsCenter({
  className,
  onOverride,
  onConfigurationChange,
  realTimeEnabled = true,
  userRole = 'operator'
}: AutonomousOperationsCenterProps) {
  const [deployments, setDeployments] = useState<DeploymentStatus[]>(MOCK_DEPLOYMENTS)
  const [metrics, setMetrics] = useState<SystemMetrics>(MOCK_METRICS)
  const [decisions, setDecisions] = useState<DecisionAuditEntry[]>(MOCK_DECISIONS)
  const [alerts, setAlerts] = useState<AlertEntry[]>(MOCK_ALERTS)
  const [agents, setAgents] = useState<AgentStatus[]>(MOCK_AGENTS)
  const [autonomousMode, setAutonomousMode] = useState(true)
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null)

  const canOverride = userRole === 'admin' || userRole === 'operator'

  const handleOverride = useCallback((operationId: string, action: string) => {
    if (!canOverride) return
    onOverride?.(operationId, action)
    
    // Update local state for immediate feedback
    setDeployments(prev => prev.map(dep => 
      dep.id === operationId 
        ? { ...dep, status: action === 'pause' ? 'paused' : dep.status }
        : dep
    ))
  }, [canOverride, onOverride])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'running': return 'text-blue-600 bg-blue-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'paused': return 'text-yellow-600 bg-yellow-50'
      case 'pending': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Autonomous Operations Center</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and control of autonomous deployment operations
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="autonomous-mode"
              checked={autonomousMode}
              onCheckedChange={setAutonomousMode}
              disabled={!canOverride}
            />
            <label htmlFor="autonomous-mode" className="text-sm font-medium">
              Autonomous Mode
            </label>
          </div>
          <Badge variant={realTimeEnabled ? 'default' : 'secondary'}>
            {realTimeEnabled ? 'Live' : 'Static'}
          </Badge>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDeployments}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.queuedDeployments} queued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu}%</div>
            <Progress value={metrics.cpu} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory}%</div>
            <Progress value={metrics.memory} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.network}%</div>
            <Progress value={metrics.network} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="deployments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="agents">Autonomous Agents</TabsTrigger>
          <TabsTrigger value="decisions">Decision Audit</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Deployment Status Matrix */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Deployment Status Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {deployments.map((deployment) => (
                      <div
                        key={deployment.id}
                        className={cn(
                          'p-4 rounded-lg border cursor-pointer transition-colors',
                          selectedDeployment === deployment.id && 'border-primary'
                        )}
                        onClick={() => setSelectedDeployment(deployment.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <GitBranch className="h-4 w-4" />
                            <span className="font-medium">{deployment.service}</span>
                            <Badge variant="outline">{deployment.version}</Badge>
                          </div>
                          <Badge className={getStatusColor(deployment.status)}>
                            {deployment.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{deployment.progress}%</span>
                          </div>
                          <Progress value={deployment.progress} />
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                          <span>{deployment.environment}</span>
                          <div className="flex items-center space-x-1">
                            {deployment.autonomous && (
                              <Zap className="h-3 w-3 text-blue-500" />
                            )}
                            <Clock className="h-3 w-3" />
                            <span>{new Date(deployment.startTime).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Manual Override Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Manual Override Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDeployment ? (
                  <div className="space-y-4">
                    <div className="text-sm">
                      <div className="font-medium">Selected Deployment</div>
                      <div className="text-muted-foreground">
                        {deployments.find(d => d.id === selectedDeployment)?.service}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!canOverride}
                        onClick={() => handleOverride(selectedDeployment, 'pause')}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Deployment
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!canOverride}
                        onClick={() => handleOverride(selectedDeployment, 'resume')}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume Deployment
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={!canOverride}
                        onClick={() => handleOverride(selectedDeployment, 'rollback')}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Initiate Rollback
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        disabled={!canOverride}
                        onClick={() => handleOverride(selectedDeployment, 'stop')}
                      >
                        <StopCircle className="h-4 w-4 mr-2" />
                        Emergency Stop
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    Select a deployment to access manual controls
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Autonomous Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">{agent.name}</span>
                      </div>
                      <Badge 
                        variant={agent.status === 'active' ? 'default' : 'destructive'}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Success Rate</span>
                        <span className="font-medium">{agent.successRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Decisions Today</span>
                        <span className="font-medium">{agent.decisionsToday}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Activity</span>
                        <span className="text-muted-foreground">
                          {new Date(agent.lastActivity).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision Audit Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {decisions.map((decision, index) => (
                    <div key={decision.id} className="relative">
                      {index < decisions.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                      )}
                      
                      <div className="flex space-x-4">
                        <div className="flex-shrink-0">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            decision.outcome === 'success' && 'bg-green-100',
                            decision.outcome === 'failure' && 'bg-red-100',
                            decision.outcome === 'pending' && 'bg-blue-100'
                          )}>
                            {decision.outcome === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {decision.outcome === 'failure' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            {decision.outcome === 'pending' && <Clock className="h-4 w-4 text-blue-600" />}
                          </div>
                        </div>
                        
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{decision.decision}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(decision.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            {decision.reasoning}
                          </p>
                          
                          <div className="flex items-center space-x-4 text-xs">
                            <span>Agent: {decision.agent}</span>
                            <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
                            {decision.manualOverride && (
                              <Badge variant="outline" className="text-xs">
                                Manual Override
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alerts & Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      <span>{alert.severity.toUpperCase()}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-normal">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                        {alert.resolved && (
                          <Badge variant="secondary" className="text-xs">
                            Resolved