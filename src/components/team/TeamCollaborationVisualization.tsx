```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  MiniMap,
  NodeTypes,
  EdgeTypes
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Users,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Target,
  MessageSquare,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Brain,
  Network,
  Timer
} from 'lucide-react'

// Types
interface Agent {
  id: string
  name: string
  type: 'analyzer' | 'generator' | 'validator' | 'coordinator'
  status: 'active' | 'idle' | 'busy' | 'error'
  currentTask?: string
  progress: number
  capabilities: string[]
  performance: {
    tasksCompleted: number
    averageTime: number
    successRate: number
  }
  position: { x: number; y: number }
  lastActivity: string
}

interface Task {
  id: string
  title: string
  assignedTo: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  progress: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  dependencies: string[]
  estimatedDuration: number
  actualDuration?: number
  createdAt: string
  updatedAt: string
}

interface Interaction {
  id: string
  fromAgent: string
  toAgent: string
  type: 'communication' | 'task_assignment' | 'data_transfer' | 'validation'
  message: string
  timestamp: string
  data?: any
}

interface ActivityEvent {
  id: string
  agentId: string
  type: 'task_started' | 'task_completed' | 'message_sent' | 'error' | 'milestone'
  description: string
  timestamp: string
  metadata?: any
}

interface TeamCollaborationVisualizationProps {
  teamId: string
  agents: Agent[]
  tasks: Task[]
  interactions: Interaction[]
  activities: ActivityEvent[]
  className?: string
  onAgentSelect?: (agentId: string) => void
  onTaskSelect?: (taskId: string) => void
  onInteractionSelect?: (interactionId: string) => void
  enableRealtime?: boolean
  showMetrics?: boolean
  autoLayout?: boolean
}

// Custom Node Components
const AgentNode: React.FC<{
  data: Agent & { onSelect?: (id: string) => void }
}> = ({ data }) => {
  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-gray-400',
    busy: 'bg-yellow-500',
    error: 'bg-red-500'
  }

  const typeIcons = {
    analyzer: Brain,
    generator: Zap,
    validator: CheckCircle2,
    coordinator: Network
  }

  const Icon = typeIcons[data.type]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => data.onSelect?.(data.id)}
          >
            <Card className="w-48 cursor-pointer border-2 hover:border-blue-500 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[data.status]} animate-pulse`} />
                    <Icon className="w-4 h-4" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {data.type}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-medium truncate">
                  {data.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{data.progress}%</span>
                  </div>
                  <Progress value={data.progress} className="h-1" />
                  {data.currentTask && (
                    <p className="text-xs text-muted-foreground truncate">
                      {data.currentTask}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            {data.status === 'busy' && (
              <motion.div
                className="absolute -inset-1 border-2 border-blue-500 rounded-lg"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{data.name}</p>
            <p className="text-xs">Tasks: {data.performance.tasksCompleted}</p>
            <p className="text-xs">Success Rate: {data.performance.successRate}%</p>
            <p className="text-xs">Last Activity: {data.lastActivity}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const ProgressRing: React.FC<{
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
}> = ({ progress, size = 60, strokeWidth = 4, className = '' }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className={`relative ${className}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-500 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

const ActivityFeed: React.FC<{
  activities: ActivityEvent[]
  agents: Agent[]
}> = ({ activities, agents }) => {
  const getAgentName = (agentId: string) => 
    agents.find(agent => agent.id === agentId)?.name || 'Unknown Agent'

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'task_started': return Play
      case 'task_completed': return CheckCircle2
      case 'message_sent': return MessageSquare
      case 'error': return AlertCircle
      case 'milestone': return Target
      default: return Activity
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'task_started': return 'text-blue-500'
      case 'task_completed': return 'text-green-500'
      case 'message_sent': return 'text-purple-500'
      case 'error': return 'text-red-500'
      case 'milestone': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        <AnimatePresence>
          {activities.slice(-50).reverse().map((activity, index) => {
            const Icon = getEventIcon(activity.type)
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Icon className={`w-4 h-4 mt-0.5 ${getEventColor(activity.type)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {getAgentName(activity.agentId)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
}

const MetricsPanel: React.FC<{
  agents: Agent[]
  tasks: Task[]
  interactions: Interaction[]
}> = ({ agents, tasks, interactions }) => {
  const metrics = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(task => task.status === 'completed').length
    const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length
    const activeAgents = agents.filter(agent => agent.status === 'active').length
    const averageProgress = agents.reduce((sum, agent) => sum + agent.progress, 0) / agents.length
    const recentInteractions = interactions.filter(
      interaction => new Date(interaction.timestamp) > new Date(Date.now() - 5 * 60 * 1000)
    ).length

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      activeAgents,
      averageProgress,
      recentInteractions,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    }
  }, [agents, tasks, interactions])

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Completed</span>
              <span className="font-medium">{metrics.completedTasks}/{metrics.totalTasks}</span>
            </div>
            <Progress value={metrics.completionRate} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>In Progress: {metrics.inProgressTasks}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Active</span>
              <span className="font-medium">{metrics.activeAgents}/{agents.length}</span>
            </div>
            <Progress value={metrics.averageProgress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Avg Progress: {Math.round(metrics.averageProgress)}%
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">
              {metrics.recentInteractions}
            </div>
            <div className="text-xs text-muted-foreground">
              Interactions (5min)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <ProgressRing progress={metrics.completionRate} size={50} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const TeamCollaborationVisualization: React.FC<TeamCollaborationVisualizationProps> = ({
  teamId,
  agents,
  tasks,
  interactions,
  activities,
  className = '',
  onAgentSelect,
  onTaskSelect,
  onInteractionSelect,
  enableRealtime = true,
  showMetrics = true,
  autoLayout = true
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Create custom node types
  const nodeTypes: NodeTypes = useMemo(() => ({
    agent: AgentNode as any
  }), [])

  // Convert agents to nodes
  useEffect(() => {
    const agentNodes: Node[] = agents.map((agent, index) => ({
      id: agent.id,
      type: 'agent',
      position: autoLayout 
        ? { 
            x: (index % 3) * 250 + 50, 
            y: Math.floor(index / 3) * 200 + 50 
          }
        : agent.position,
      data: {
        ...agent,
        onSelect: (agentId: string) => {
          setSelectedAgent(agentId)
          onAgentSelect?.(agentId)
        }
      },
      draggable: true
    }))

    setNodes(agentNodes)
  }, [agents, autoLayout, onAgentSelect, setNodes])

  // Create edges from interactions
  useEffect(() => {
    const interactionEdges: Edge[] = interactions
      .filter(interaction => 
        agents.some(agent => agent.id === interaction.fromAgent) &&
        agents.some(agent => agent.id === interaction.toAgent)
      )
      .map(interaction => ({
        id: interaction.id,
        source: interaction.fromAgent,
        target: interaction.toAgent,
        animated: true,
        style: { 
          stroke: interaction.type === 'task_assignment' ? '#3b82f6' : '#8b5cf6',
          strokeWidth: 2
        },
        label: interaction.type,
        labelStyle: { fontSize: '10px', fill: '#6b7280' }
      }))

    setEdges(interactionEdges)
  }, [interactions, agents, setEdges])

  // Real-time updates simulation
  useEffect(() => {
    if (!enableRealtime || !isPlaying) return

    const interval = setInterval(() => {
      // Simulate real-time updates
      setNodes(nodes => 
        nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            progress: Math.min(100, node.data.progress + Math.random() * 5),
            status: Math.random() > 0.9 ? 
              (['active', 'busy', 'idle'] as const)[Math.floor(Math.random() * 3)] :
              node.data.status
          }
        }))
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [enableRealtime, isPlaying, setNodes])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleReset = () => {
    setSelectedAgent(null)
    setNodes(nodes => 
      nodes.map((node, index) => ({
        ...node,
        position: autoLayout 
          ? { 
              x: (index % 3) * 250 + 50, 
              y: Math.floor(index / 3) * 200 + 50 
            }
          : node.position,
        data: {
          ...node.data,
          progress: 0,
          status: 'idle' as const
        }
      }))
    )
  }

  const selectedAgentData = selectedAgent 
    ? agents.find(agent => agent.id === selectedAgent)
    : null

  return (
    <TooltipProvider>
      <div className={`h-full flex ${className}`}>
        {/* Main Visualization */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-background"
          >
            <Background />
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                const status = (node as any).data?.status
                switch (status) {
                  case 'active': return '#22c55e'
                  case 'busy': return '#eab308'
                  case 'error': return '#ef4444'
                  default: return '#6b7280'
                }
              }}
              className="bg-background border"
            />
            
            {/* Control Panel */}
            <Panel position="top-right" className="bg-background border rounded-lg p-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
            </Panel>

            {/* Team Stats */}
            <Panel position="top-left" className="bg-background border rounded-lg p-3">
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Team {teamId}</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{agents.length} agents</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>{tasks.length} tasks</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>{interactions.length} interactions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    <span>{activities.length} events</span>
                  </div>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Side Panel */}
        <div className="w-96 border-l bg-background flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 m-0">
              {showMetrics && (
                <MetricsPanel 
                  agents={agents}
                  tasks={tasks}
                  interactions={interactions}
                />
              )}
            </TabsContent>

            <TabsContent value="activity" className="flex-1 m-0">
              <div className="h-full">
                <div className="p-4 border-b">
                  <h3 className="font-medium text-sm">Recent Activity</h3>
                </div>
                <ActivityFeed activities={activities} agents={agents} />
              </div>
            </TabsContent>

            <TabsContent value="details