```tsx
'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { 
  AlertTriangle,
  Activity,
  Server,
  Database,
  Globe,
  Cpu,
  MemoryStick,
  Network,
  Plus,
  Minus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Target,
  Settings
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Types
interface TopologyNode {
  id: string
  name: string
  type: 'service' | 'database' | 'load_balancer' | 'gateway'
  status: 'healthy' | 'warning' | 'critical' | 'scaling'
  replicas: number
  maxReplicas: number
  minReplicas: number
  cpuUsage: number
  memoryUsage: number
  networkUsage: number
  requestsPerSecond: number
  responseTime: number
  errorRate: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface TopologyLink {
  source: string | TopologyNode
  target: string | TopologyNode
  bandwidth: number
  latency: number
  errorCount: number
  requestCount: number
}

interface ScalingEvent {
  id: string
  serviceId: string
  action: 'scale_up' | 'scale_down' | 'auto_scale'
  fromReplicas: number
  toReplicas: number
  reason: string
  timestamp: string
  duration?: number
  success: boolean
}

interface Bottleneck {
  id: string
  nodeId: string
  type: 'cpu' | 'memory' | 'network' | 'requests'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  recommendations: string[]
  detectedAt: string
}

interface LoadMetric {
  timestamp: string
  cpu: number
  memory: number
  network: number
  requests: number
}

interface ScalingTopologyVisualizerProps {
  className?: string
  height?: number
  width?: number
  autoRefresh?: boolean
  refreshInterval?: number
  enableManualScaling?: boolean
  onNodeClick?: (node: TopologyNode) => void
  onScalingAction?: (serviceId: string, action: string, replicas: number) => void
}

const ScalingTopologyVisualizer: React.FC<ScalingTopologyVisualizerProps> = ({
  className = '',
  height = 800,
  width = 1200,
  autoRefresh = true,
  refreshInterval = 5000,
  enableManualScaling = true,
  onNodeClick,
  onScalingAction
}) => {
  // State
  const [nodes, setNodes] = useState<TopologyNode[]>([])
  const [links, setLinks] = useState<TopologyLink[]>([])
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)
  const [scalingEvents, setScalingEvents] = useState<ScalingEvent[]>([])
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [loadMetrics, setLoadMetrics] = useState<LoadMetric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBottlenecks, setShowBottlenecks] = useState(true)
  const [simulationRunning, setSimulationRunning] = useState(false)

  // Refs
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<TopologyNode, TopologyLink> | null>(null)
  const supabaseRef = useRef(createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ))

  // Node type configurations
  const nodeConfig = useMemo(() => ({
    service: { color: '#3b82f6', icon: Server, radius: 20 },
    database: { color: '#ef4444', icon: Database, radius: 25 },
    load_balancer: { color: '#10b981', icon: Network, radius: 18 },
    gateway: { color: '#f59e0b', icon: Globe, radius: 22 }
  }), [])

  // Status colors
  const statusColors = useMemo(() => ({
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    scaling: '#8b5cf6'
  }), [])

  // Initialize D3 simulation
  const initializeSimulation = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const simulation = d3.forceSimulation<TopologyNode, TopologyLink>(nodes)
      .force('link', d3.forceLink<TopologyNode, TopologyLink>(links)
        .id(d => d.id)
        .distance(150)
        .strength(0.1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))

    simulationRef.current = simulation

    const linkSelection = svg.select('.links')
      .selectAll('line')
      .data(links, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}`)

    linkSelection.enter()
      .append('line')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', d => Math.max(1, Math.min(5, d.bandwidth / 100)))
      .attr('stroke-opacity', 0.6)
      .merge(linkSelection as any)

    linkSelection.exit().remove()

    const nodeSelection = svg.select('.nodes')
      .selectAll('g')
      .data(nodes, (d: any) => d.id)

    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, TopologyNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded) as any)

    nodeEnter.append('circle')
      .attr('r', d => nodeConfig[d.type].radius)
      .attr('fill', d => statusColors[d.status])
      .attr('stroke', d => nodeConfig[d.type].color)
      .attr('stroke-width', 2)

    nodeEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .text(d => d.name.substring(0, 8))

    nodeEnter.on('click', (event, d) => {
      setSelectedNode(d)
      onNodeClick?.(d)
    })

    nodeSelection.select('circle')
      .transition()
      .duration(300)
      .attr('fill', d => statusColors[d.status])
      .attr('r', d => nodeConfig[d.type].radius + (d.status === 'scaling' ? 5 : 0))

    nodeSelection.exit().remove()

    simulation.on('tick', () => {
      svg.select('.links')
        .selectAll('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      svg.select('.nodes')
        .selectAll('g')
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    setSimulationRunning(true)

    function dragStarted(event: d3.D3DragEvent<SVGGElement, TopologyNode, TopologyNode>) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart()
      }
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, TopologyNode, TopologyNode>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragEnded(event: d3.D3DragEvent<SVGGElement, TopologyNode, TopologyNode>) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0)
      }
      event.subject.fx = null
      event.subject.fy = null
    }
  }, [nodes, links, width, height, nodeConfig, statusColors, onNodeClick])

  // Fetch topology data
  const fetchTopologyData = useCallback(async () => {
    try {
      setError(null)
      const supabase = supabaseRef.current

      // Fetch nodes
      const { data: nodeData, error: nodeError } = await supabase
        .from('platform_topology')
        .select('*')

      if (nodeError) throw nodeError

      // Fetch links
      const { data: linkData, error: linkError } = await supabase
        .from('topology_links')
        .select('*')

      if (linkError) throw linkError

      // Fetch recent scaling events
      const { data: eventsData, error: eventsError } = await supabase
        .from('scaling_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50)

      if (eventsError) throw eventsError

      // Detect bottlenecks
      const { data: bottleneckData, error: bottleneckError } = await supabase
        .rpc('detect_bottlenecks')

      if (bottleneckError) throw bottleneckError

      setNodes(nodeData || [])
      setLinks(linkData || [])
      setScalingEvents(eventsData || [])
      setBottlenecks(bottleneckData || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch topology data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Manual scaling action
  const handleScalingAction = useCallback(async (
    serviceId: string, 
    action: 'scale_up' | 'scale_down', 
    replicas: number
  ) => {
    try {
      const supabase = supabaseRef.current
      
      const { error } = await supabase.rpc('trigger_scaling', {
        service_id: serviceId,
        action,
        target_replicas: replicas
      })

      if (error) throw error

      onScalingAction?.(serviceId, action, replicas)
      
      // Refresh data after scaling action
      await fetchTopologyData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform scaling action')
    }
  }, [fetchTopologyData, onScalingAction])

  // Setup real-time subscriptions
  useEffect(() => {
    const supabase = supabaseRef.current

    const topologySubscription = supabase
      .channel('topology_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'platform_topology' },
        (payload) => {
          fetchTopologyData()
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scaling_events' },
        (payload) => {
          setScalingEvents(prev => [payload.new as ScalingEvent, ...prev.slice(0, 49)])
        }
      )
      .subscribe()

    return () => {
      topologySubscription.unsubscribe()
    }
  }, [fetchTopologyData])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTopologyData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, fetchTopologyData])

  // Initialize data and simulation
  useEffect(() => {
    fetchTopologyData()
  }, [fetchTopologyData])

  useEffect(() => {
    if (nodes.length > 0) {
      initializeSimulation()
    }
  }, [nodes, links, initializeSimulation])

  // Generate mock load metrics
  useEffect(() => {
    const generateMetrics = () => {
      const now = new Date()
      const metrics: LoadMetric[] = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(now.getTime() - (19 - i) * 30000).toISOString(),
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 1000,
        requests: Math.random() * 500
      }))
      setLoadMetrics(metrics)
    }

    generateMetrics()
    const interval = setInterval(generateMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  // Render legend
  const renderLegend = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm">Topology Legend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(nodeConfig).map(([type, config]) => {
          const Icon = config.icon
          return (
            <div key={type} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full border-2"
                style={{ 
                  backgroundColor: config.color,
                  borderColor: config.color
                }}
              />
              <Icon className="w-4 h-4" />
              <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
            </div>
          )
        })}
        <Separator />
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm capitalize">{status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )

  // Render node details
  const renderNodeDetails = () => {
    if (!selectedNode) return null

    const recentEvents = scalingEvents.filter(e => e.serviceId === selectedNode.id)
    const nodeBottlenecks = bottlenecks.filter(b => b.nodeId === selectedNode.id)

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(nodeConfig[selectedNode.type].icon, { className: "w-5 h-5" })}
            {selectedNode.name}
            <Badge variant={selectedNode.status === 'healthy' ? 'default' : 'destructive'}>
              {selectedNode.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="scaling">Scaling</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    <span className="text-sm">CPU Usage</span>
                  </div>
                  <Progress value={selectedNode.cpuUsage} className="h-2" />
                  <span className="text-xs text-muted-foreground">
                    {selectedNode.cpuUsage.toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4" />
                    <span className="text-sm">Memory Usage</span>
                  </div>
                  <Progress value={selectedNode.memoryUsage} className="h-2" />
                  <span className="text-xs text-muted-foreground">
                    {selectedNode.memoryUsage.toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm">Requests/sec</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {selectedNode.requestsPerSecond.toFixed(0)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Response Time</span>
                  </div>
                  <div className="text-lg font-semibold">
                    {selectedNode.responseTime.toFixed(0)}ms
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scaling" className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Replicas</span>
                <Badge variant="outline">{selectedNode.replicas}</Badge>
              </div>

              <div className="space-y-2">
                <span className="text-sm">Replica Range</span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Min: {selectedNode.minReplicas}</span>
                  <span>Max: {selectedNode.maxReplicas}</span>
                </div>
              </div>

              {enableManualScaling && (
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScalingAction(
                        selectedNode.id, 
                        'scale_down', 
                        Math.max(selectedNode.minReplicas, selectedNode.replicas - 1)
                      )}
                      disabled={selectedNode.replicas <= selectedNode.minReplicas}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScalingAction(
                        selectedNode.id,
                        'scale_up',
                        Math.min(selectedNode.maxReplicas, selectedNode.replicas + 1)
                      )}
                      disabled={selectedNode.replicas >= selectedNode.maxReplicas}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-sm font-medium">Recent Events</span>
                <ScrollArea className="h-32">
                  {recentEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="flex items-center gap-2 py-1">
                      {event.action === 'scale_up' ? 
                        <TrendingUp className="w-3 h-3 text-green-500" /> :
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      }
                      <span className="text-xs">
                        {event.fromReplicas} → {event.toReplicas}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-3">
              {nodeBottlenecks.length > 0 ? (
                nodeBottlenecks.map(bottleneck => (
                  <Alert key={bottleneck.id} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="font-medium">{bottleneck.message}</div>
                        <div className="text-sm">
                          Severity: <Badge variant="destructive">{bottleneck.severity}</Badge>
                        </div>
                        {bottleneck.recommendations.length > 0 && (
                          <ul className="text-sm list-disc list-inside mt-2">
                            {bottleneck.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))