```tsx
"use client"

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  Users, 
  GitBranch, 
  Clock, 
  Filter, 
  Play, 
  Pause, 
  RotateCcw,
  Eye,
  EyeOff,
  Zap,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface TeamMember {
  id: string
  name: string
  avatar?: string
  role: string
  status: 'online' | 'away' | 'offline'
  activeTask?: string
}

interface ActivityEvent {
  id: string
  type: 'task_update' | 'message' | 'file_upload' | 'collaboration' | 'status_change'
  userId: string
  userName: string
  timestamp: Date
  description: string
  metadata?: Record<string, any>
  severity?: 'low' | 'medium' | 'high'
}

interface TaskNode {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'review' | 'completed'
  assigneeId?: string
  progress: number
  dependencies: string[]
  collaborators: string[]
}

interface CollaborationEdge {
  source: string
  target: string
  strength: number
  lastInteraction: Date
  type: 'direct' | 'task_based' | 'communication'
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  type: 'member' | 'task'
  data: TeamMember | TaskNode
  radius: number
  color: string
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: NetworkNode
  target: NetworkNode
  strength: number
  type: string
}

interface ViewMode {
  network: boolean
  timeline: boolean
  heatmap: boolean
  tasks: boolean
}

interface FilterOptions {
  members: string[]
  activityTypes: string[]
  timeRange: number
  minCollaboration: number
}

interface RealTimeActivityVisualizationProps {
  teamId: string
  className?: string
  height?: number
  autoRefresh?: boolean
  showControls?: boolean
  defaultViewMode?: Partial<ViewMode>
  onActivitySelect?: (activity: ActivityEvent) => void
  onMemberSelect?: (member: TeamMember) => void
}

// WebSocket hook
const useWebSocket = (url: string, teamId: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const ws = new WebSocket(`${url}?teamId=${teamId}`)
    
    ws.onopen = () => {
      setConnectionStatus('connected')
      setSocket(ws)
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      setData(message)
    }
    
    ws.onclose = () => {
      setConnectionStatus('disconnected')
      setSocket(null)
    }
    
    ws.onerror = () => {
      setConnectionStatus('disconnected')
    }

    return () => {
      ws.close()
    }
  }, [url, teamId])

  return { socket, connectionStatus, data }
}

// Network Graph Component
const NetworkGraph: React.FC<{
  nodes: NetworkNode[]
  links: NetworkLink[]
  width: number
  height: number
  onNodeClick: (node: NetworkNode) => void
}> = ({ nodes, links, width, height, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', (d) => Math.sqrt(d.strength) * 2)
      .attr('stroke-opacity', 0.6)

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))
      .on('click', (event, d) => onNodeClick(d))

    const labels = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.type === 'member' ? (d.data as TeamMember).name : (d.data as TaskNode).title)
      .attr('font-size', 12)
      .attr('fill', '#334155')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y + d.radius + 15)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, links, width, height, onNodeClick])

  return <svg ref={svgRef} width={width} height={height} />
}

// Activity Timeline Component
const ActivityTimeline: React.FC<{
  activities: ActivityEvent[]
  onActivityClick: (activity: ActivityEvent) => void
}> = ({ activities, onActivityClick }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_update': return <CheckCircle2 className="h-4 w-4" />
      case 'message': return <MessageSquare className="h-4 w-4" />
      case 'file_upload': return <FileText className="h-4 w-4" />
      case 'collaboration': return <Users className="h-4 w-4" />
      case 'status_change': return <Activity className="h-4 w-4" />
      default: return <Circle className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
            onClick={() => onActivityClick(activity)}
          >
            <div className={cn("p-2 rounded-full", getSeverityColor(activity.severity))}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{activity.userName}</span>
                <Badge variant="outline" className="text-xs">
                  {activity.type.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {activity.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// Member Activity Node Component
const MemberActivityNode: React.FC<{
  member: TeamMember
  activityCount: number
  onClick: (member: TeamMember) => void
}> = ({ member, activityCount, onClick }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
      onClick={() => onClick(member)}
    >
      <div className="relative">
        <Avatar>
          <AvatarImage src={member.avatar} alt={member.name} />
          <AvatarFallback>{member.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className={cn("absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white", getStatusColor(member.status))} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{member.name}</span>
          <Badge variant="secondary" className="text-xs">{member.role}</Badge>
        </div>
        {member.activeTask && (
          <p className="text-xs text-muted-foreground truncate">{member.activeTask}</p>
        )}
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-primary">{activityCount}</div>
        <div className="text-xs text-muted-foreground">activities</div>
      </div>
    </div>
  )
}

// Task Flow Chart Component
const TaskFlowChart: React.FC<{
  tasks: TaskNode[]
  onTaskClick: (task: TaskNode) => void
}> = ({ tasks, onTaskClick }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'review': return 'bg-yellow-500'
      case 'todo': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="space-y-3 p-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-4 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
          onClick={() => onTaskClick(task)}
        >
          <div className="flex items-start justify-between mb-3">
            <h4 className="font-medium text-sm">{task.title}</h4>
            <Badge className={cn("text-white", getStatusColor(task.status))}>
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
          <Progress value={task.progress} className="h-2 mb-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{task.progress}% complete</span>
            <span>{task.collaborators.length} collaborators</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Collaboration Heatmap Component
const CollaborationHeatmap: React.FC<{
  data: Array<{ member1: string; member2: string; intensity: number }>
  members: TeamMember[]
}> = ({ data, members }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || members.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 50, right: 50, bottom: 50, left: 50 }
    const width = 400 - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom
    const cellSize = Math.min(width, height) / members.length

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(data, d => d.intensity) || 1])

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create grid
    members.forEach((member1, i) => {
      members.forEach((member2, j) => {
        const collaboration = data.find(d => 
          (d.member1 === member1.id && d.member2 === member2.id) ||
          (d.member1 === member2.id && d.member2 === member1.id)
        )
        
        g.append('rect')
          .attr('x', j * cellSize)
          .attr('y', i * cellSize)
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('fill', colorScale(collaboration?.intensity || 0))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
      })
    })

    // Add labels
    g.selectAll('.row-label')
      .data(members)
      .enter()
      .append('text')
      .attr('class', 'row-label')
      .attr('x', -5)
      .attr('y', (d, i) => i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .text(d => d.name)

    g.selectAll('.col-label')
      .data(members)
      .enter()
      .append('text')
      .attr('class', 'col-label')
      .attr('x', (d, i) => i * cellSize + cellSize / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'text-after-edge')
      .attr('font-size', 10)
      .text(d => d.name)

  }, [data, members])

  return <svg ref={svgRef} width={400} height={400} />
}

// Activity Controls Component
const ActivityControls: React.FC<{
  isPlaying: boolean
  onPlayPause: () => void
  onReset: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: Partial<ViewMode>) => void
  filters: FilterOptions
  onFiltersChange: (filters: Partial<FilterOptions>) => void
  members: TeamMember[]
}> = ({ isPlaying, onPlayPause, onReset, viewMode, onViewModeChange, filters, onFiltersChange, members }) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPlayPause}
          className="flex items-center gap-2"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">View Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(viewMode).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <Switch
                id={key}
                checked={value}
                onCheckedChange={(checked) => onViewModeChange({ [key]: checked })}
              />
              <Label htmlFor={key} className="text-sm capitalize">
                {key}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Filters</Label>
        
        <div className="space-y-2">
          <Label htmlFor="timeRange" className="text-xs">Time Range (hours)</Label>
          <Slider
            id="timeRange"
            min={1}
            max={24}
            step={1}
            value={[filters.timeRange]}
            onValueChange={([value]) => onFiltersChange({ timeRange: value })}
          />
          <div className="text-xs text-muted-foreground text-center">
            {filters.timeRange} hours
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="collaboration" className="text-xs">Min Collaboration</Label>
          <Slider
            id="collaboration"
            min={0}
            max={10}
            step={1}
            value={[filters.minCollaboration]}
            onValueChange={([value]) => onFiltersChange({ minCollaboration: value })}
          />
          <div className="text-xs text-muted-foreground text-center">
            {filters.minCollaboration} interactions
          </div>
        </div>
      </div>
    </div>
  )
}

// Legend Panel Component
const LegendPanel: React.FC = () => {
  const legendItems = [
    { color: 'bg-green-500', label: 'Online', type: 'status' },
    { color: 'bg-yellow-500', label: 'Away', type: 'status' },
    { color: 'bg-gray-400', label: 'Offline', type: 'status' },
    { color: 'bg-blue-500', label: 'In Progress', type: 'task' },
    { color: 'bg-green-500', label: 'Completed', type: 'task' },
    { color: 'bg-red-50 text-red-600', label: 'High Priority', type: 'activity' },
    { color: 'bg-yellow-50 text-yellow-600', label: 'Medium Priority', type: 'activity' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Legend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", item.color)} />
              <span className="text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Main Component
export const RealTimeActivityVisualization: React.FC<RealTimeActivityVisualizationProps> = ({
  teamId,
  className,
  height = 600,
  autoRefresh = true,
  showControls = true,
  defaultViewMode = { network: true, timeline: true, heatmap: false, tasks: true },
  onActivitySelect,
  onMemberSelect
}) => {
  // State
  const [isPlaying, setIsPlaying] = useState(autoRefresh)
  const [viewMode, setViewMode] = useState<ViewMode>({
    network: true,
    timeline: true,
    heatmap: false,
    tasks: true,
    ...defaultViewMode
  })
  const [filters, setFilters] = useState<FilterOptions>({
    members: [],
    activityTypes: [],
    timeRange: 8,