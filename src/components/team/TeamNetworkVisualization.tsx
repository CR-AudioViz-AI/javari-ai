'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Network, 
  Users, 
  AlertTriangle, 
  Download, 
  Filter, 
  Activity,
  Zap,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  role: string
  department: string
  avatar?: string
  status: 'active' | 'busy' | 'away' | 'offline'
  skills: string[]
  workload: number
}

interface Communication {
  id: string
  from_member_id: string
  to_member_id: string
  frequency: number
  last_interaction: string
  type: 'email' | 'slack' | 'meeting' | 'task'
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface WorkflowDependency {
  id: string
  from_member_id: string
  to_member_id: string
  task_type: string
  dependency_strength: number
  bottleneck_risk: 'low' | 'medium' | 'high'
  avg_completion_time: number
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  member: TeamMember
  centrality: {
    degree: number
    betweenness: number
    closeness: number
    eigenvector: number
  }
  connections: number
  isBottleneck: boolean
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode
  target: string | NetworkNode
  communication?: Communication
  workflow?: WorkflowDependency
  strength: number
  type: 'communication' | 'workflow' | 'both'
  color: string
  width: number
}

interface NetworkMetrics {
  density: number
  clustering: number
  averagePathLength: number
  centralNodes: string[]
  bottlenecks: string[]
  isolatedNodes: string[]
}

interface BottleneckAlert {
  id: string
  member_id: string
  member_name: string
  severity: 'low' | 'medium' | 'high'
  type: 'communication' | 'workflow' | 'workload'
  message: string
  impact: number
  suggestions: string[]
}

interface FilterOptions {
  departments: string[]
  roles: string[]
  showCommunication: boolean
  showWorkflow: boolean
  minConnectionStrength: number
  highlightBottlenecks: boolean
}

interface TeamNetworkVisualizationProps {
  teamId: string
  width?: number
  height?: number
  className?: string
  onNodeSelect?: (member: TeamMember) => void
  onBottleneckDetected?: (alerts: BottleneckAlert[]) => void
  realTimeEnabled?: boolean
}

const TeamNetworkVisualization: React.FC<TeamNetworkVisualizationProps> = ({
  teamId,
  width = 800,
  height = 600,
  className,
  onNodeSelect,
  onBottleneckDetected,
  realTimeEnabled = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null)
  
  const [nodes, setNodes] = useState<NetworkNode[]>([])
  const [links, setLinks] = useState<NetworkLink[]>([])
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    density: 0,
    clustering: 0,
    averagePathLength: 0,
    centralNodes: [],
    bottlenecks: [],
    isolatedNodes: []
  })
  const [alerts, setAlerts] = useState<BottleneckAlert[]>([])
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    departments: [],
    roles: [],
    showCommunication: true,
    showWorkflow: true,
    minConnectionStrength: 0,
    highlightBottlenecks: true
  })
  const [isLoading, setIsLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

  // Mock data for demonstration
  const mockTeamMembers: TeamMember[] = useMemo(() => [
    {
      id: '1',
      name: 'Alice Johnson',
      role: 'Engineering Manager',
      department: 'Engineering',
      status: 'active',
      skills: ['Leadership', 'React', 'Node.js'],
      workload: 0.85
    },
    {
      id: '2',
      name: 'Bob Smith',
      role: 'Senior Developer',
      department: 'Engineering',
      status: 'busy',
      skills: ['React', 'TypeScript', 'GraphQL'],
      workload: 0.95
    },
    {
      id: '3',
      name: 'Carol Davis',
      role: 'UX Designer',
      department: 'Design',
      status: 'active',
      skills: ['Figma', 'User Research', 'Prototyping'],
      workload: 0.7
    },
    {
      id: '4',
      name: 'David Wilson',
      role: 'Product Manager',
      department: 'Product',
      status: 'away',
      skills: ['Strategy', 'Analytics', 'Roadmapping'],
      workload: 0.8
    },
    {
      id: '5',
      name: 'Eva Brown',
      role: 'DevOps Engineer',
      department: 'Engineering',
      status: 'active',
      skills: ['AWS', 'Docker', 'Kubernetes'],
      workload: 0.9
    }
  ], [])

  const mockCommunications: Communication[] = useMemo(() => [
    {
      id: '1',
      from_member_id: '1',
      to_member_id: '2',
      frequency: 15,
      last_interaction: '2024-01-15T10:30:00Z',
      type: 'slack',
      sentiment: 'positive'
    },
    {
      id: '2',
      from_member_id: '1',
      to_member_id: '4',
      frequency: 8,
      last_interaction: '2024-01-15T09:15:00Z',
      type: 'meeting',
      sentiment: 'neutral'
    },
    {
      id: '3',
      from_member_id: '2',
      to_member_id: '5',
      frequency: 12,
      last_interaction: '2024-01-15T11:45:00Z',
      type: 'task',
      sentiment: 'positive'
    },
    {
      id: '4',
      from_member_id: '3',
      to_member_id: '4',
      frequency: 6,
      last_interaction: '2024-01-15T08:30:00Z',
      type: 'email',
      sentiment: 'positive'
    }
  ], [])

  const mockWorkflowDependencies: WorkflowDependency[] = useMemo(() => [
    {
      id: '1',
      from_member_id: '4',
      to_member_id: '3',
      task_type: 'design_review',
      dependency_strength: 0.8,
      bottleneck_risk: 'medium',
      avg_completion_time: 2.5
    },
    {
      id: '2',
      from_member_id: '3',
      to_member_id: '2',
      task_type: 'implementation',
      dependency_strength: 0.9,
      bottleneck_risk: 'high',
      avg_completion_time: 5.2
    },
    {
      id: '3',
      from_member_id: '2',
      to_member_id: '5',
      task_type: 'deployment',
      dependency_strength: 0.7,
      bottleneck_risk: 'low',
      avg_completion_time: 1.8
    }
  ], [])

  // Calculate network centrality metrics
  const calculateCentrality = useCallback((nodes: NetworkNode[], links: NetworkLink[]): NetworkNode[] => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const adjacencyList = new Map<string, string[]>()
    
    // Build adjacency list
    nodes.forEach(node => adjacencyList.set(node.id, []))
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      adjacencyList.get(sourceId)?.push(targetId)
      adjacencyList.get(targetId)?.push(sourceId)
    })

    return nodes.map(node => {
      const neighbors = adjacencyList.get(node.id) || []
      const degree = neighbors.length
      
      // Simple centrality calculations (in real app, use proper algorithms)
      const centrality = {
        degree: degree / (nodes.length - 1),
        betweenness: Math.random() * 0.5, // Placeholder
        closeness: Math.random() * 0.8, // Placeholder
        eigenvector: Math.random() * 0.6 // Placeholder
      }

      const isBottleneck = node.member.workload > 0.9 || 
        links.some(l => 
          ((typeof l.source === 'string' ? l.source : l.source.id) === node.id || 
           (typeof l.target === 'string' ? l.target : l.target.id) === node.id) &&
          l.workflow?.bottleneck_risk === 'high'
        )

      return {
        ...node,
        centrality,
        connections: degree,
        isBottleneck
      }
    })
  }, [])

  // Generate network data
  const generateNetworkData = useCallback(() => {
    const networkNodes: NetworkNode[] = mockTeamMembers.map(member => ({
      id: member.id,
      member,
      centrality: { degree: 0, betweenness: 0, closeness: 0, eigenvector: 0 },
      connections: 0,
      isBottleneck: false
    }))

    const networkLinks: NetworkLink[] = []

    // Add communication links
    if (filters.showCommunication) {
      mockCommunications.forEach(comm => {
        if (comm.frequency >= filters.minConnectionStrength) {
          networkLinks.push({
            source: comm.from_member_id,
            target: comm.to_member_id,
            communication: comm,
            strength: comm.frequency / 20,
            type: 'communication',
            color: comm.sentiment === 'positive' ? '#22c55e' : 
                   comm.sentiment === 'negative' ? '#ef4444' : '#6b7280',
            width: Math.max(1, comm.frequency / 5)
          })
        }
      })
    }

    // Add workflow links
    if (filters.showWorkflow) {
      mockWorkflowDependencies.forEach(dep => {
        if (dep.dependency_strength >= filters.minConnectionStrength) {
          const existing = networkLinks.find(l => 
            (typeof l.source === 'string' ? l.source : l.source.id) === dep.from_member_id &&
            (typeof l.target === 'string' ? l.target : l.target.id) === dep.to_member_id
          )

          if (existing) {
            existing.workflow = dep
            existing.type = 'both'
            existing.strength = Math.max(existing.strength, dep.dependency_strength)
          } else {
            networkLinks.push({
              source: dep.from_member_id,
              target: dep.to_member_id,
              workflow: dep,
              strength: dep.dependency_strength,
              type: 'workflow',
              color: dep.bottleneck_risk === 'high' ? '#ef4444' : 
                     dep.bottleneck_risk === 'medium' ? '#f59e0b' : '#3b82f6',
              width: Math.max(2, dep.dependency_strength * 4)
            })
          }
        }
      })
    }

    const calculatedNodes = calculateCentrality(networkNodes, networkLinks)
    
    setNodes(calculatedNodes)
    setLinks(networkLinks)

    // Calculate metrics
    const density = networkLinks.length / (networkNodes.length * (networkNodes.length - 1) / 2)
    const bottlenecks = calculatedNodes.filter(n => n.isBottleneck).map(n => n.id)
    
    setMetrics({
      density,
      clustering: Math.random() * 0.7 + 0.2, // Placeholder
      averagePathLength: Math.random() * 3 + 1.5, // Placeholder
      centralNodes: calculatedNodes
        .sort((a, b) => b.centrality.degree - a.centrality.degree)
        .slice(0, 3)
        .map(n => n.id),
      bottlenecks,
      isolatedNodes: calculatedNodes.filter(n => n.connections === 0).map(n => n.id)
    })

    // Generate alerts
    const newAlerts: BottleneckAlert[] = calculatedNodes
      .filter(n => n.isBottleneck)
      .map(n => ({
        id: `alert-${n.id}`,
        member_id: n.id,
        member_name: n.member.name,
        severity: n.member.workload > 0.95 ? 'high' : 'medium' as const,
        type: 'workload' as const,
        message: `${n.member.name} has high workload (${Math.round(n.member.workload * 100)}%)`,
        impact: n.centrality.degree * n.member.workload,
        suggestions: [
          'Redistribute tasks to team members with lower workload',
          'Consider hiring additional resources',
          'Review and optimize current workflows'
        ]
      }))

    setAlerts(newAlerts)
    onBottleneckDetected?.(newAlerts)
  }, [mockTeamMembers, mockCommunications, mockWorkflowDependencies, filters, calculateCentrality, onBottleneckDetected])

  // Initialize D3 force simulation
  const initializeSimulation = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create simulation
    const simulation = d3.forceSimulation<NetworkNode>(nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(links)
        .id(d => d.id)
        .strength(d => d.strength)
        .distance(d => 100 / (d.strength + 0.1)))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    simulationRef.current = simulation

    // Create links
    const link = container.selectAll('.link')
      .data(links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.width)
      .attr('stroke-opacity', 0.6)

    // Create nodes
    const node = container.selectAll('.node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')

    // Node circles
    node.append('circle')
      .attr('r', d => 15 + d.connections * 2)
      .attr('fill', d => {
        if (filters.highlightBottlenecks && d.isBottleneck) return '#ef4444'
        switch (d.member.status) {
          case 'active': return '#22c55e'
          case 'busy': return '#f59e0b'
          case 'away': return '#6b7280'
          default: return '#9ca3af'
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Node labels
    node.append('text')
      .attr('dy', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#374151')
      .text(d => d.member.name.split(' ')[0])

    // Bottleneck indicators
    node.filter(d => d.isBottleneck && filters.highlightBottlenecks)
      .append('circle')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')

    // Node interactions
    node
      .on('click', (event, d) => {
        setSelectedNode(d)
        onNodeSelect?.(d.member)
      })
      .on('mouseover', function(event, d) {
        d3.select(this).select('circle').attr('stroke-width', 4)
        
        // Highlight connected links
        link
          .attr('stroke-opacity', l => 
            (typeof l.source === 'object' && l.source.id === d.id) ||
            (typeof l.target === 'object' && l.target.id === d.id) ? 1 : 0.2)
      })
      .on('mouseout', function(event, d) {
        d3.select(this).select('circle').attr('stroke-width', 2)
        link.attr('stroke-opacity', 0.6)
      })

    // Add drag behavior
    const drag = d3.drag<SVGGElement, NetworkNode>()
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
      })

    node.call(drag)

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NetworkNode).x || 0)
        .attr('y1', d => (d.source as NetworkNode).y || 0)
        .attr('x2', d => (d.target as NetworkNode).x || 0)
        .attr('y2', d => (d.target as NetworkNode).y || 0)

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
    })

    setIsLoading(false)
  }, [nodes, links, width, height, filters.highlightBottlenecks, onNodeSelect])

  // Export network data
  const exportNetworkData = useCallback(() => {
    const data = {
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.member.name,
        role: n.member.role,
        department: n.member.department,
        centrality: n.centrality,
        connections: n.connections,
        isBottleneck: n.isBottleneck
      })),
      links: links.map(l => ({
        source: typeof l.source === 'string' ? l.source : l.source.id,
        target: typeof l.target === 'string' ? l.target : l.target.id,
        strength: l.strength,
        type: l.type
      })),
      metrics,
      timestamp: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-network-${teamId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, links, metrics, teamId])

  // Initialize data and simulation
  useEffect(() => {
    generateNetworkData()
  }, [generateNetworkData])

  useEffect(() => {
    if (nodes.length > 0) {
      initializeSimulation()
    }
  }, [nodes, links, initializeSimulation])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!realTimeEnabled) return

    const ws = new WebSocket(`ws://localhost:3000/api/team-network/realtime?teamId=${teamId}`)
    
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'network_update') {
        generateNetworkData()
      }
    }

    return () => ws.close()
  }, [teamId, realTimeEnabled, generateNetworkData])

  const departments = useMemo(() => 
    Array.from(new Set(mockTeamMembers.map(m => m.department))), 
    [mockTeamMembers]
  )
  
  const roles = useMemo(() => 
    Array.from(new Set(mockTeamMembers.map(m => m.role))), 
    [mockTeamMembers]
  )

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", className)}>
        {/* Header */}
        <div className