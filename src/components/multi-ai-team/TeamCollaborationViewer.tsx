```tsx
'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scrollarea'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  MessageCircle, 
  Zap, 
  Network, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Users,
  TrendingUp,
  Pause,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface Agent {
  id: string
  name: string
  type: 'coordinator' | 'analyzer' | 'executor' | 'validator'
  status: 'active' | 'idle' | 'processing' | 'error'
  currentTask?: string
  performance: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Communication {
  id: string
  fromAgentId: string
  toAgentId: string
  message: string
  type: 'request' | 'response' | 'notification' | 'decision'
  timestamp: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, any>
}

interface DecisionNode {
  id: string
  agentId: string
  decision: string
  options: string[]
  selectedOption?: string
  confidence: number
  timestamp: Date
  parentId?: string
  children: string[]
}

interface CollaborationMetrics {
  totalMessages: number
  activeAgents: number
  completedTasks: number
  avgResponseTime: number
  successRate: number
  currentThroughput: number
}

interface TeamCollaborationViewerProps {
  className?: string
  teamId?: string
  autoRefresh?: boolean
  refreshInterval?: number
  onAgentSelect?: (agent: Agent) => void
  onCommunicationClick?: (communication: Communication) => void
  enableRealtimeUpdates?: boolean
  maxMessages?: number
}

// Agent type configurations
const AGENT_CONFIG = {
  coordinator: { color: '#3B82F6', icon: Users, shape: 'circle' },
  analyzer: { color: '#10B981', icon: Brain, shape: 'square' },
  executor: { color: '#F59E0B', icon: Zap, shape: 'triangle' },
  validator: { color: '#EF4444', icon: CheckCircle, shape: 'diamond' }
} as const

const STATUS_CONFIG = {
  active: { color: '#10B981', label: 'Active' },
  idle: { color: '#6B7280', label: 'Idle' },
  processing: { color: '#F59E0B', label: 'Processing' },
  error: { color: '#EF4444', label: 'Error' }
} as const

const PRIORITY_CONFIG = {
  low: { color: '#6B7280', opacity: 0.6 },
  medium: { color: '#F59E0B', opacity: 0.7 },
  high: { color: '#EF4444', opacity: 0.8 },
  critical: { color: '#DC2626', opacity: 1.0 }
} as const

// Sub-components
const AgentNodeVisualization: React.FC<{
  agents: Agent[]
  communications: Communication[]
  onAgentClick: (agent: Agent) => void
  dimensions: { width: number; height: number }
}> = ({ agents, communications, onAgentClick, dimensions }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<Agent, undefined> | null>(null)

  useEffect(() => {
    if (!svgRef.current || !agents.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions

    // Create force simulation
    simulationRef.current = d3.forceSimulation(agents)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))

    // Create links from communications
    const links = communications.map(comm => ({
      source: agents.find(a => a.id === comm.fromAgentId)!,
      target: agents.find(a => a.id === comm.toAgentId)!,
      communication: comm
    })).filter(link => link.source && link.target)

    simulationRef.current.force('link', d3.forceLink(links).distance(100))

    // Draw links
    const linkElements = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => PRIORITY_CONFIG[d.communication.priority].color)
      .attr('stroke-width', d => d.communication.priority === 'critical' ? 3 : 2)
      .attr('stroke-opacity', d => PRIORITY_CONFIG[d.communication.priority].opacity)
      .attr('marker-end', 'url(#arrowhead)')

    // Define arrowhead marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666')

    // Draw nodes
    const nodeElements = svg.append('g')
      .selectAll('g')
      .data(agents)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, Agent>()
        .on('start', (event, d) => {
          if (!event.active && simulationRef.current) {
            simulationRef.current.alphaTarget(0.3).restart()
          }
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active && simulationRef.current) {
            simulationRef.current.alphaTarget(0)
          }
          d.fx = null
          d.fy = null
        })
      )
      .on('click', (event, d) => onAgentClick(d))

    // Add node shapes based on agent type
    nodeElements.each(function(d) {
      const node = d3.select(this)
      const config = AGENT_CONFIG[d.type]
      
      if (config.shape === 'circle') {
        node.append('circle')
          .attr('r', 25)
          .attr('fill', config.color)
          .attr('stroke', STATUS_CONFIG[d.status].color)
          .attr('stroke-width', 3)
      } else if (config.shape === 'square') {
        node.append('rect')
          .attr('width', 50)
          .attr('height', 50)
          .attr('x', -25)
          .attr('y', -25)
          .attr('fill', config.color)
          .attr('stroke', STATUS_CONFIG[d.status].color)
          .attr('stroke-width', 3)
      }
      
      // Add agent name
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 5)
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(d.name.substring(0, 6))
    })

    // Update positions on simulation tick
    simulationRef.current.on('tick', () => {
      linkElements
        .attr('x1', d => (d.source as Agent).x!)
        .attr('y1', d => (d.source as Agent).y!)
        .attr('x2', d => (d.target as Agent).x!)
        .attr('y2', d => (d.target as Agent).y!)

      nodeElements
        .attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [agents, communications, dimensions, onAgentClick])

  return (
    <svg
      ref={svgRef}
      width={dimensions.width}
      height={dimensions.height}
      className="border rounded-lg bg-slate-50 dark:bg-slate-900"
    />
  )
}

const MessageFlowStream: React.FC<{
  communications: Communication[]
  agents: Agent[]
  maxMessages: number
}> = ({ communications, agents, maxMessages }) => {
  const getAgentName = (agentId: string) => 
    agents.find(a => a.id === agentId)?.name || 'Unknown Agent'

  const sortedMessages = useMemo(() => 
    [...communications]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxMessages),
    [communications, maxMessages]
  )

  return (
    <ScrollArea className="h-96">
      <div className="space-y-2 p-2">
        <AnimatePresence>
          {sortedMessages.map((comm) => (
            <motion.div
              key={comm.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "p-3 rounded-lg border-l-4",
                comm.priority === 'critical' && "bg-red-50 border-red-500 dark:bg-red-950",
                comm.priority === 'high' && "bg-orange-50 border-orange-500 dark:bg-orange-950",
                comm.priority === 'medium' && "bg-yellow-50 border-yellow-500 dark:bg-yellow-950",
                comm.priority === 'low' && "bg-gray-50 border-gray-500 dark:bg-gray-950"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {getAgentName(comm.fromAgentId)}
                  </Badge>
                  <MessageCircle className="w-3 h-3" />
                  <Badge variant="outline" className="text-xs">
                    {getAgentName(comm.toAgentId)}
                  </Badge>
                </div>
                <div className="flex items-center space-x-1">
                  <Badge 
                    variant={comm.priority === 'critical' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {comm.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {comm.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-foreground truncate">{comm.message}</p>
              <div className="flex items-center mt-1 space-x-2">
                <Badge variant="outline" className="text-xs">
                  {comm.type}
                </Badge>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
}

const DecisionTreePanel: React.FC<{
  decisions: DecisionNode[]
  agents: Agent[]
}> = ({ decisions, agents }) => {
  const getAgentName = (agentId: string) => 
    agents.find(a => a.id === agentId)?.name || 'Unknown Agent'

  const rootDecisions = decisions.filter(d => !d.parentId)

  const renderDecisionNode = (decision: DecisionNode, level = 0) => {
    const children = decisions.filter(d => d.parentId === decision.id)
    
    return (
      <div key={decision.id} className={cn("mb-2", level > 0 && "ml-4")}>
        <div className="flex items-center space-x-2 p-2 rounded border">
          <div className="flex items-center space-x-2 flex-1">
            <Badge variant="outline" className="text-xs">
              {getAgentName(decision.agentId)}
            </Badge>
            <span className="text-sm font-medium">{decision.decision}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={decision.confidence > 0.8 ? 'default' : 'secondary'}
              className="text-xs"
            >
              {Math.round(decision.confidence * 100)}%
            </Badge>
            {decision.selectedOption && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
          </div>
        </div>
        {decision.selectedOption && (
          <div className="ml-4 mt-1">
            <Badge variant="secondary" className="text-xs">
              Selected: {decision.selectedOption}
            </Badge>
          </div>
        )}
        {children.map(child => renderDecisionNode(child, level + 1))}
      </div>
    )
  }

  return (
    <ScrollArea className="h-96">
      <div className="p-2">
        {rootDecisions.length > 0 ? (
          rootDecisions.map(decision => renderDecisionNode(decision))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>No decisions recorded yet</p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

const AgentStatusCard: React.FC<{
  agent: Agent
  onClick: () => void
}> = ({ agent, onClick }) => {
  const config = AGENT_CONFIG[agent.type]
  const statusConfig = STATUS_CONFIG[agent.status]
  const IconComponent = config.icon

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconComponent 
              className="w-5 h-5" 
              style={{ color: config.color }} 
            />
            <CardTitle className="text-sm">{agent.name}</CardTitle>
          </div>
          <Badge 
            variant={agent.status === 'error' ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Performance</span>
            <span>{Math.round(agent.performance * 100)}%</span>
          </div>
          <Progress value={agent.performance * 100} className="h-1" />
          {agent.currentTask && (
            <p className="text-xs text-muted-foreground truncate">
              {agent.currentTask}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

const CollaborationMetrics: React.FC<{
  metrics: CollaborationMetrics
}> = ({ metrics }) => {
  const metricItems = [
    { 
      label: 'Active Agents', 
      value: metrics.activeAgents, 
      icon: Users,
      color: 'text-blue-600'
    },
    { 
      label: 'Total Messages', 
      value: metrics.totalMessages, 
      icon: MessageCircle,
      color: 'text-green-600'
    },
    { 
      label: 'Completed Tasks', 
      value: metrics.completedTasks, 
      icon: CheckCircle,
      color: 'text-purple-600'
    },
    { 
      label: 'Success Rate', 
      value: `${Math.round(metrics.successRate * 100)}%`, 
      icon: TrendingUp,
      color: 'text-emerald-600'
    },
    { 
      label: 'Avg Response Time', 
      value: `${metrics.avgResponseTime}ms`, 
      icon: Clock,
      color: 'text-orange-600'
    },
    { 
      label: 'Throughput', 
      value: `${metrics.currentThroughput}/min`, 
      icon: Activity,
      color: 'text-red-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {metricItems.map((item) => {
        const IconComponent = item.icon
        return (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <IconComponent className={cn("w-4 h-4", item.color)} />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold">{item.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

const ProgressIndicatorGrid: React.FC<{
  agents: Agent[]
}> = ({ agents }) => {
  const overallProgress = agents.reduce((sum, agent) => sum + agent.performance, 0) / agents.length

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Overall Team Progress</span>
          <span className="text-sm">{Math.round(overallProgress * 100)}%</span>
        </div>
        <Progress value={overallProgress * 100} className="h-2" />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {agents.map(agent => (
          <div key={agent.id} className="flex items-center space-x-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              agent.status === 'active' && "bg-green-500",
              agent.status === 'processing' && "bg-yellow-500",
              agent.status === 'idle' && "bg-gray-400",
              agent.status === 'error' && "bg-red-500"
            )} />
            <span className="text-xs flex-1 truncate">{agent.name}</span>
            <span className="text-xs">{Math.round(agent.performance * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main Component
const TeamCollaborationViewer: React.FC<TeamCollaborationViewerProps> = ({
  className,
  teamId = 'default',
  autoRefresh = true,
  refreshInterval = 1000,
  onAgentSelect,
  onCommunicationClick,
  enableRealtimeUpdates = true,
  maxMessages = 50
}) => {
  // State
  const [agents, setAgents] = useState<Agent[]>([])
  const [communications, setCommunications] = useState<Communication[]>([])
  const [decisions, setDecisions] = useState<DecisionNode[]>([])
  const [metrics, setMetrics] = useState<CollaborationMetrics>({
    totalMessages: 0,
    activeAgents: 0,
    completedTasks: 0,
    avgResponseTime: 0,
    successRate: 0,
    currentThroughput: 0
  })
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const wsRef = useRef<WebSocket | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mock data for demonstration
  const generateMockData = useCallback(() => {
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Coordinator Alpha',
        type: 'coordinator',
        status: 'active',
        currentTask: 'Managing workflow distribution',
        performance: 0.92
      },
      {
        id: 'agent-2',
        name: 'Analyzer Beta',
        type: 'analyzer',
        status: 'processing',
        currentTask: 'Analyzing data patterns',
        performance: 0.87
      },
      {
        id: 'agent-3',
        name: 'Executor Gamma',
        type: 'executor',
        status: 'active',
        currentTask: 'Executing optimization tasks',
        performance: 0.94
      },
      {
        id: 'agent-4',
        name: 'Validator Delta',
        type: 'validator',
        status: 'idle',
        currentTask: undefined,
        performance: 0.89
      }
    ]

    const mockCommunications: Communication[] = [
      {
        id: 'comm-1',
        fromAgentId: 'agent-1',
        toAgentId: 'agent-2',
        message: 'Request data analysis for workflow optimization',
        type: 'request',
        timestamp: new Date(Date.now() - 30000),
        priority: 'high'
      },
      {
        id: 'comm-2',
        fromAgentId: 'agent-2',
        toAgentId: 'agent-1',
        message: 'Analysis complete, recommending parallel processing',
        type: 'response',
        timestamp: new Date(Date.now() - 15000),
        priority: 'medium'