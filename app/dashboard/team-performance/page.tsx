```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Activity, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Settings,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Network,
  BarChart3
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'

interface Agent {
  id: string
  name: string
  status: 'active' | 'idle' | 'offline' | 'busy'
  currentTask?: string
  performance: number
  connections: number
  lastActivity: Date
}

interface Task {
  id: string
  title: string
  assignedTo: string[]
  progress: number
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  startDate: Date
  dueDate: Date
}

interface CommunicationEvent {
  id: string
  fromAgent: string
  toAgent: string
  type: 'message' | 'task-assignment' | 'status-update' | 'alert'
  timestamp: Date
  content?: string
}

interface PerformanceMetric {
  timestamp: Date
  tasksCompleted: number
  responseTime: number
  efficiency: number
  communicationVolume: number
}

interface AlertConfig {
  id: string
  name: string
  type: 'performance' | 'communication' | 'task' | 'agent-status'
  condition: string
  threshold: number
  enabled: boolean
}

interface TeamPerformanceDashboardProps {
  teamId?: string
  refreshInterval?: number
  defaultTimeRange?: '1h' | '4h' | '24h' | '7d'
}

const TeamPerformanceDashboard: React.FC<TeamPerformanceDashboardProps> = ({
  teamId = 'default-team',
  refreshInterval = 5000,
  defaultTimeRange = '24h'
}) => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [communications, setCommunications] = useState<CommunicationEvent[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [alerts, setAlerts] = useState<AlertConfig[]>([])
  const [timeRange, setTimeRange] = useState(defaultTimeRange)
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [alertModalOpen, setAlertModalOpen] = useState(false)

  // Mock data generation
  useEffect(() => {
    const generateMockAgents = (): Agent[] => [
      {
        id: 'agent-1',
        name: 'Data Analyst AI',
        status: 'active',
        currentTask: 'Processing customer feedback',
        performance: 92,
        connections: 8,
        lastActivity: new Date()
      },
      {
        id: 'agent-2',
        name: 'Content Generator AI',
        status: 'busy',
        currentTask: 'Creating marketing content',
        performance: 87,
        connections: 5,
        lastActivity: new Date(Date.now() - 300000)
      },
      {
        id: 'agent-3',
        name: 'Code Review AI',
        status: 'idle',
        performance: 95,
        connections: 12,
        lastActivity: new Date(Date.now() - 600000)
      },
      {
        id: 'agent-4',
        name: 'Customer Support AI',
        status: 'offline',
        performance: 78,
        connections: 3,
        lastActivity: new Date(Date.now() - 1800000)
      }
    ]

    const generateMockTasks = (): Task[] => [
      {
        id: 'task-1',
        title: 'Q4 Performance Analysis',
        assignedTo: ['agent-1', 'agent-3'],
        progress: 75,
        status: 'in-progress',
        priority: 'high',
        startDate: new Date(Date.now() - 86400000),
        dueDate: new Date(Date.now() + 172800000)
      },
      {
        id: 'task-2',
        title: 'Content Campaign Creation',
        assignedTo: ['agent-2'],
        progress: 45,
        status: 'in-progress',
        priority: 'medium',
        startDate: new Date(Date.now() - 43200000),
        dueDate: new Date(Date.now() + 259200000)
      },
      {
        id: 'task-3',
        title: 'System Health Check',
        assignedTo: ['agent-3'],
        progress: 100,
        status: 'completed',
        priority: 'critical',
        startDate: new Date(Date.now() - 172800000),
        dueDate: new Date(Date.now() - 86400000)
      }
    ]

    const generateMockMetrics = (): PerformanceMetric[] => {
      const now = new Date()
      return Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now.getTime() - (23 - i) * 3600000),
        tasksCompleted: Math.floor(Math.random() * 10) + 5,
        responseTime: Math.random() * 500 + 100,
        efficiency: Math.random() * 30 + 70,
        communicationVolume: Math.floor(Math.random() * 50) + 20
      }))
    }

    setAgents(generateMockAgents())
    setTasks(generateMockTasks())
    setPerformanceMetrics(generateMockMetrics())
  }, [])

  // Real-time updates simulation
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => ({
        ...agent,
        performance: Math.max(0, Math.min(100, agent.performance + (Math.random() - 0.5) * 5)),
        connections: Math.max(0, agent.connections + Math.floor((Math.random() - 0.5) * 3))
      })))

      setPerformanceMetrics(prev => {
        const latest = prev[prev.length - 1]
        const newMetric: PerformanceMetric = {
          timestamp: new Date(),
          tasksCompleted: Math.floor(Math.random() * 10) + 5,
          responseTime: Math.random() * 500 + 100,
          efficiency: Math.random() * 30 + 70,
          communicationVolume: Math.floor(Math.random() * 50) + 20
        }
        return [...prev.slice(-23), newMetric]
      })
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled, refreshInterval])

  const agentStatusCounts = useMemo(() => {
    return agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [agents])

  const averagePerformance = useMemo(() => {
    return Math.round(agents.reduce((sum, agent) => sum + agent.performance, 0) / agents.length)
  }, [agents])

  const activeTasks = useMemo(() => {
    return tasks.filter(task => task.status === 'in-progress' || task.status === 'pending')
  }, [tasks])

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'busy': return 'bg-yellow-500'
      case 'idle': return 'bg-blue-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'default'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  const StatusIndicator: React.FC<{ status: Agent['status'] }> = ({ status }) => (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="text-sm capitalize">{status}</span>
    </div>
  )

  const MetricCard: React.FC<{ 
    title: string
    value: string | number
    change?: number
    icon: React.ReactNode
  }> = ({ title, value, change, icon }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <p className={`text-xs flex items-center gap-1 ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className="w-3 h-3" />
                {change > 0 ? '+' : ''}{change}%
              </p>
            )}
          </div>
          <div className="text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const NetworkGraph: React.FC = () => {
    const nodes = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      x: Math.random() * 300 + 50,
      y: Math.random() * 200 + 50
    }))

    return (
      <div className="relative w-full h-64 border border-border rounded-md bg-background">
        <svg className="w-full h-full">
          {/* Connections */}
          {nodes.map((node, i) => 
            nodes.slice(i + 1).map(otherNode => (
              <line
                key={`${node.id}-${otherNode.id}`}
                x1={node.x}
                y1={node.y}
                x2={otherNode.x}
                y2={otherNode.y}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                opacity="0.3"
              />
            ))
          )}
          
          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r="8"
                className={getStatusColor(node.status)}
                stroke="hsl(var(--background))"
                strokeWidth="2"
              />
              <text
                x={node.x}
                y={node.y + 20}
                textAnchor="middle"
                className="text-xs fill-foreground"
              >
                {node.name.split(' ')[0]}
              </text>
            </g>
          ))}
        </svg>
      </div>
    )
  }

  const AlertConfiguration: React.FC = () => (
    <Dialog open={alertModalOpen} onOpenChange={setAlertModalOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alert Configuration</DialogTitle>
          <DialogDescription>
            Configure alerts for team performance monitoring
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alert-name">Alert Name</Label>
                <Input id="alert-name" placeholder="e.g. Low Performance Alert" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-type">Alert Type</Label>
                <Select>
                  <SelectTrigger id="alert-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="task">Task Progress</SelectItem>
                    <SelectItem value="agent-status">Agent Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold">Threshold</Label>
                <Input id="threshold" type="number" placeholder="75" />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch id="enabled" />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAlertModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setAlertModalOpen(false)}>
              Save Alert
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Performance Dashboard</h1>
          <p className="text-muted-foreground">Real-time monitoring of agent activities and team metrics</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={isRealTimeEnabled}
              onCheckedChange={setIsRealTimeEnabled}
            />
            <Label>Real-time</Label>
            {isRealTimeEnabled ? <Play className="w-4 h-4 text-green-500" /> : <Pause className="w-4 h-4" />}
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="4h">Last 4 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAlertModalOpen(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Alerts
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Agents"
          value={`${agentStatusCounts.active || 0}/${agents.length}`}
          change={12}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard
          title="Average Performance"
          value={`${averagePerformance}%`}
          change={-3}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Tasks"
          value={activeTasks.length}
          change={8}
          icon={<Activity className="w-5 h-5" />}
        />
        <MetricCard
          title="Communication Events"
          value="142"
          change={15}
          icon={<MessageSquare className="w-5 h-5" />}
        />
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceMetrics.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line type="monotone" dataKey="efficiency" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="tasksCompleted" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Agent Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Agent Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <StatusIndicator status={agent.status} />
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">{agent.currentTask || 'No active task'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{agent.performance}%</p>
                        <p className="text-xs text-muted-foreground">{agent.connections} connections</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Active Tasks Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasks.filter(task => task.status !== 'completed').map(task => (
                  <div key={task.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge variant={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Assigned to: {task.assignedTo.length} agent(s)</span>
                      <span>Due: {task.dueDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Agent Communication Network
              </CardTitle>
              <CardDescription>
                Visualizes communication patterns between agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NetworkGraph />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would be implemented similarly */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Agent Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Detailed agent management interface would be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader