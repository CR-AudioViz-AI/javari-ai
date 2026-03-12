```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  MessageSquare,
  Users,
  GitBranch,
  Clock,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  Download,
  Filter,
  Maximize2,
  Activity,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Network
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  role: 'coordinator' | 'analyzer' | 'executor' | 'validator'
  status: 'active' | 'idle' | 'processing' | 'offline'
  position: { x: number; y: number }
  messageCount: number
  efficiency: number
  lastActivity: Date
}

interface Message {
  id: string
  fromAgentId: string
  toAgentId: string
  type: 'task' | 'query' | 'response' | 'decision' | 'handoff'
  content: string
  timestamp: Date
  status: 'sent' | 'delivered' | 'processed' | 'acknowledged'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface DecisionPoint {
  id: string
  agentId: string
  type: 'routing' | 'validation' | 'escalation' | 'completion'
  status: 'pending' | 'resolved' | 'escalated'
  timestamp: Date
  options: string[]
  selectedOption?: string
  impactScore: number
}

interface EfficiencyMetric {
  metric: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
  unit: string
}

interface TeamCommunicationFlowVisualizerProps {
  teamId: string
  realTimeEnabled?: boolean
  showMetrics?: boolean
  showTimeline?: boolean
  onExportData?: (data: any) => void
  className?: string
}

const ROLE_COLORS = {
  coordinator: '#3B82F6',
  analyzer: '#10B981',
  executor: '#F59E0B',
  validator: '#EF4444'
}

const STATUS_COLORS = {
  active: '#10B981',
  idle: '#6B7280',
  processing: '#F59E0B',
  offline: '#EF4444'
}

const MESSAGE_TYPE_COLORS = {
  task: '#3B82F6',
  query: '#8B5CF6',
  response: '#10B981',
  decision: '#F59E0B',
  handoff: '#EF4444'
}

export default function TeamCommunicationFlowVisualizer({
  teamId,
  realTimeEnabled = true,
  showMetrics = true,
  showTimeline = true,
  onExportData,
  className = ''
}: TeamCommunicationFlowVisualizerProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [decisionPoints, setDecisionPoints] = useState<DecisionPoint[]>([])
  const [isPlaying, setIsPlaying] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | 'all'>('1h')
  const [filterType, setFilterType] = useState<string>('all')
  const [isFullScreen, setIsFullScreen] = useState(false)

  // Mock data initialization
  useEffect(() => {
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Coordinator Alpha',
        role: 'coordinator',
        status: 'active',
        position: { x: 200, y: 150 },
        messageCount: 45,
        efficiency: 0.92,
        lastActivity: new Date()
      },
      {
        id: 'agent-2',
        name: 'Analyzer Beta',
        role: 'analyzer',
        status: 'processing',
        position: { x: 100, y: 300 },
        messageCount: 32,
        efficiency: 0.88,
        lastActivity: new Date(Date.now() - 300000)
      },
      {
        id: 'agent-3',
        name: 'Executor Gamma',
        role: 'executor',
        status: 'active',
        position: { x: 300, y: 300 },
        messageCount: 28,
        efficiency: 0.95,
        lastActivity: new Date(Date.now() - 120000)
      },
      {
        id: 'agent-4',
        name: 'Validator Delta',
        role: 'validator',
        status: 'idle',
        position: { x: 200, y: 450 },
        messageCount: 18,
        efficiency: 0.91,
        lastActivity: new Date(Date.now() - 600000)
      }
    ]

    const mockMessages: Message[] = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      fromAgentId: mockAgents[Math.floor(Math.random() * mockAgents.length)].id,
      toAgentId: mockAgents[Math.floor(Math.random() * mockAgents.length)].id,
      type: ['task', 'query', 'response', 'decision', 'handoff'][Math.floor(Math.random() * 5)] as Message['type'],
      content: `Message ${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      status: ['sent', 'delivered', 'processed', 'acknowledged'][Math.floor(Math.random() * 4)] as Message['status'],
      priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as Message['priority']
    }))

    const mockDecisionPoints: DecisionPoint[] = Array.from({ length: 10 }, (_, i) => ({
      id: `decision-${i}`,
      agentId: mockAgents[Math.floor(Math.random() * mockAgents.length)].id,
      type: ['routing', 'validation', 'escalation', 'completion'][Math.floor(Math.random() * 4)] as DecisionPoint['type'],
      status: ['pending', 'resolved', 'escalated'][Math.floor(Math.random() * 3)] as DecisionPoint['status'],
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      options: [`Option A-${i}`, `Option B-${i}`, `Option C-${i}`],
      selectedOption: Math.random() > 0.3 ? `Option A-${i}` : undefined,
      impactScore: Math.random() * 100
    }))

    setAgents(mockAgents)
    setMessages(mockMessages)
    setDecisionPoints(mockDecisionPoints)
  }, [teamId])

  // Real-time updates simulation
  useEffect(() => {
    if (!realTimeEnabled || !isPlaying) return

    const interval = setInterval(() => {
      // Simulate new messages
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        fromAgentId: agents[Math.floor(Math.random() * agents.length)]?.id || 'agent-1',
        toAgentId: agents[Math.floor(Math.random() * agents.length)]?.id || 'agent-2',
        type: ['task', 'query', 'response', 'decision', 'handoff'][Math.floor(Math.random() * 5)] as Message['type'],
        content: `Real-time message ${Date.now()}`,
        timestamp: new Date(),
        status: 'sent',
        priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as Message['priority']
      }

      setMessages(prev => [newMessage, ...prev.slice(0, 99)])

      // Update agent activity
      setAgents(prev => prev.map(agent => ({
        ...agent,
        messageCount: agent.messageCount + (Math.random() > 0.7 ? 1 : 0),
        efficiency: Math.max(0, Math.min(1, agent.efficiency + (Math.random() - 0.5) * 0.02))
      })))
    }, 3000)

    return () => clearInterval(interval)
  }, [realTimeEnabled, isPlaying, agents])

  const efficiencyMetrics = useMemo((): EfficiencyMetric[] => [
    {
      metric: 'Average Response Time',
      value: 2.4,
      change: -0.3,
      trend: 'up',
      unit: 's'
    },
    {
      metric: 'Message Success Rate',
      value: 94.2,
      change: 1.5,
      trend: 'up',
      unit: '%'
    },
    {
      metric: 'Decision Accuracy',
      value: 91.8,
      change: -0.8,
      trend: 'down',
      unit: '%'
    },
    {
      metric: 'Team Collaboration Score',
      value: 87.5,
      change: 2.1,
      trend: 'up',
      unit: '/100'
    }
  ], [messages, decisionPoints])

  const messageFlowData = useMemo(() => {
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      messages: messages.filter(m => {
        const msgHour = new Date(m.timestamp).getHours()
        return msgHour === i
      }).length
    }))
    return hourlyData
  }, [messages])

  const agentPerformanceData = useMemo(() => 
    agents.map(agent => ({
      name: agent.name.split(' ')[1],
      messages: agent.messageCount,
      efficiency: Math.round(agent.efficiency * 100)
    }))
  , [agents])

  const communicationTypeData = useMemo(() => {
    const typeCount = messages.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(typeCount).map(([type, count]) => ({
      name: type,
      value: count,
      color: MESSAGE_TYPE_COLORS[type as keyof typeof MESSAGE_TYPE_COLORS]
    }))
  }, [messages])

  const handleExportData = useCallback(() => {
    const exportData = {
      agents,
      messages: messages.slice(0, 100),
      decisionPoints,
      metrics: efficiencyMetrics,
      timestamp: new Date().toISOString()
    }
    onExportData?.(exportData)
  }, [agents, messages, decisionPoints, efficiencyMetrics, onExportData])

  const filteredMessages = useMemo(() => {
    let filtered = messages

    if (filterType !== 'all') {
      filtered = filtered.filter(msg => msg.type === filterType)
    }

    if (selectedAgent) {
      filtered = filtered.filter(msg => 
        msg.fromAgentId === selectedAgent || msg.toAgentId === selectedAgent
      )
    }

    const now = new Date()
    const timeLimit = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      'all': Infinity
    }[timeRange]

    if (timeLimit !== Infinity) {
      filtered = filtered.filter(msg => 
        now.getTime() - msg.timestamp.getTime() < timeLimit
      )
    }

    return filtered.slice(0, 50)
  }, [messages, filterType, selectedAgent, timeRange])

  return (
    <div className={`w-full h-full flex flex-col space-y-6 p-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Network className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Team Communication Flow</h2>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>{agents.filter(a => a.status === 'active').length} Active</span>
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center space-x-1"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessages([])
              setDecisionPoints([])
            }}
            className="flex items-center space-x-1"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="flex items-center space-x-1"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullScreen(!isFullScreen)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1">
        {/* Communication Flow Visualization */}
        <Card className="col-span-8 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center space-x-2">
              <GitBranch className="h-5 w-5" />
              <span>Agent Communication Graph</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="all">All Types</option>
                <option value="task">Tasks</option>
                <option value="query">Queries</option>
                <option value="response">Responses</option>
                <option value="decision">Decisions</option>
                <option value="handoff">Handoffs</option>
              </select>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1">
            <div className="relative w-full h-full min-h-[400px] bg-gray-50 rounded-lg overflow-hidden">
              <svg width="100%" height="100%" className="absolute inset-0">
                {/* Connection lines between agents */}
                {agents.map(fromAgent => 
                  agents.map(toAgent => {
                    if (fromAgent.id === toAgent.id) return null
                    
                    const connections = filteredMessages.filter(msg => 
                      msg.fromAgentId === fromAgent.id && msg.toAgentId === toAgent.id
                    )
                    
                    if (connections.length === 0) return null
                    
                    return (
                      <motion.line
                        key={`${fromAgent.id}-${toAgent.id}`}
                        x1={fromAgent.position.x}
                        y1={fromAgent.position.y}
                        x2={toAgent.position.x}
                        y2={toAgent.position.y}
                        stroke="#E5E7EB"
                        strokeWidth={Math.min(connections.length / 2, 5)}
                        strokeDasharray="4,4"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1 }}
                      />
                    )
                  })
                )}
                
                {/* Animated message flows */}
                <AnimatePresence>
                  {filteredMessages.slice(0, 10).map(message => {
                    const fromAgent = agents.find(a => a.id === message.fromAgentId)
                    const toAgent = agents.find(a => a.id === message.toAgentId)
                    
                    if (!fromAgent || !toAgent) return null
                    
                    return (
                      <motion.circle
                        key={message.id}
                        r="4"
                        fill={MESSAGE_TYPE_COLORS[message.type]}
                        initial={{
                          cx: fromAgent.position.x,
                          cy: fromAgent.position.y
                        }}
                        animate={{
                          cx: toAgent.position.x,
                          cy: toAgent.position.y
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 2,
                          ease: "linear"
                        }}
                      />
                    )
                  })}
                </AnimatePresence>
              </svg>
              
              {/* Agent nodes */}
              {agents.map(agent => (
                <motion.div
                  key={agent.id}
                  className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${
                    selectedAgent === agent.id ? 'z-20' : 'z-10'
                  }`}
                  style={{
                    left: agent.position.x,
                    top: agent.position.y
                  }}
                  onClick={() => setSelectedAgent(
                    selectedAgent === agent.id ? null : agent.id
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div
                    className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center text-white font-semibold text-xs shadow-lg ${
                      selectedAgent === agent.id ? 'ring-4 ring-blue-300' : ''
                    }`}
                    style={{
                      backgroundColor: ROLE_COLORS[agent.role],
                      borderColor: STATUS_COLORS[agent.status]
                    }}
                  >
                    <span>{agent.name.split(' ')[0]}</span>
                    <span className="text-xs opacity-80">{agent.role[0].toUpperCase()}</span>
                  </div>
                  
                  {/* Agent status indicator */}
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: STATUS_COLORS[agent.status] }}
                  />
                  
                  {/* Message count badge */}
                  <Badge
                    variant="secondary"
                    className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs"
                  >
                    {agent.messageCount}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="col-span-4 space-y-6">
          {/* Efficiency Metrics */}
          {showMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Efficiency Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {efficiencyMetrics.map(metric => (
                  <div key={metric.metric} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{metric.metric}</span>
                      <div className="flex items-center space-x-1">
                        <span className="font-bold">
                          {metric.value}{metric.unit}
                        </span>
                        <Badge
                          variant={metric.trend === 'up' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {metric.change > 0 ? '+' : ''}{metric.change}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={metric.value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Message Timeline */}
          {showTimeline && (
            <Card className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Message Timeline</span>
                </CardTitle>
                
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="1h">Last Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="all">All Time</option>
                </select>
              </CardHeader>
              
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">