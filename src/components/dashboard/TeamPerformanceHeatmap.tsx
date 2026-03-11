```tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface PerformanceMetric {
  agentId: string
  agentName: string
  utilization: number
  completionRate: number
  tasksCompleted: number
  tasksAssigned: number
  avgResponseTime: number
  bottleneckScore: number
  timestamp: Date
  department: string
  status: 'online' | 'busy' | 'offline'
}

interface HeatmapCellData {
  agentId: string
  agentName: string
  value: number
  normalizedValue: number
  department: string
  status: 'online' | 'busy' | 'offline'
  isBottleneck: boolean
}

interface TeamPerformanceHeatmapProps {
  teamId?: string
  department?: string
  refreshInterval?: number
  className?: string
  onAgentSelect?: (agentId: string) => void
  onBottleneckDetected?: (agentIds: string[]) => void
}

type MetricType = 'utilization' | 'completion' | 'bottlenecks'
type TimeRange = '1h' | '4h' | '24h'

// Mock data generator for demo
const generateMockData = (count: number): PerformanceMetric[] => {
  const departments = ['Support', 'Sales', 'Technical', 'Quality']
  const statuses: ('online' | 'busy' | 'offline')[] = ['online', 'busy', 'offline']
  
  return Array.from({ length: count }, (_, i) => ({
    agentId: `agent-${i + 1}`,
    agentName: `Agent ${String.fromCharCode(65 + i)}`,
    utilization: Math.random() * 100,
    completionRate: 70 + Math.random() * 30,
    tasksCompleted: Math.floor(Math.random() * 50),
    tasksAssigned: Math.floor(Math.random() * 60) + 10,
    avgResponseTime: Math.random() * 300 + 60,
    bottleneckScore: Math.random() * 10,
    timestamp: new Date(),
    department: departments[Math.floor(Math.random() * departments.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)]
  }))
}

// Heatmap Cell Component
const HeatmapCell: React.FC<{
  data: HeatmapCellData
  size: number
  onClick: () => void
  isSelected: boolean
}> = ({ data, size, onClick, isSelected }) => {
  const getColorIntensity = (value: number) => {
    if (value >= 0.8) return 'bg-green-500'
    if (value >= 0.6) return 'bg-green-400'
    if (value >= 0.4) return 'bg-yellow-400'
    if (value >= 0.2) return 'bg-orange-400'
    return 'bg-red-500'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'border-green-400'
      case 'busy': return 'border-yellow-400'
      case 'offline': return 'border-gray-400'
      default: return 'border-gray-300'
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'relative cursor-pointer transition-all duration-200 hover:scale-105 rounded-lg border-2',
              getColorIntensity(data.normalizedValue),
              getStatusColor(data.status),
              isSelected && 'ring-2 ring-blue-400 ring-offset-2',
              data.isBottleneck && 'ring-2 ring-red-400'
            )}
            style={{ width: size, height: size }}
            onClick={onClick}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-white drop-shadow-sm">
                {data.agentName.split(' ')[1]}
              </span>
            </div>
            
            {data.isBottleneck && (
              <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-600" />
            )}
            
            <div className={cn(
              'absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white',
              data.status === 'online' && 'bg-green-400',
              data.status === 'busy' && 'bg-yellow-400',
              data.status === 'offline' && 'bg-gray-400'
            )} />
          </div>
        </TooltipTrigger>
        <AgentTooltip data={data} />
      </Tooltip>
    </TooltipProvider>
  )
}

// Agent Tooltip Component
const AgentTooltip: React.FC<{ data: HeatmapCellData }> = ({ data }) => (
  <TooltipContent side="top" className="p-3 max-w-xs">
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span className="font-medium">{data.agentName}</span>
        <Badge variant={data.status === 'online' ? 'default' : 'secondary'}>
          {data.status}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        Department: {data.department}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Performance: {Math.round(data.value)}%</div>
        <div className="flex items-center gap-1">
          {data.isBottleneck ? (
            <>
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-red-500">Bottleneck</span>
            </>
          ) : (
            <>
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Optimal</span>
            </>
          )}
        </div>
      </div>
    </div>
  </TooltipContent>
)

// Performance Metrics Panel
const PerformanceMetricsPanel: React.FC<{
  selectedAgent: PerformanceMetric | null
  onClose: () => void
}> = ({ selectedAgent, onClose }) => {
  if (!selectedAgent) return null

  return (
    <Card className="w-80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{selectedAgent.agentName}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={selectedAgent.status === 'online' ? 'default' : 'secondary'}>
            {selectedAgent.status}
          </Badge>
          <span className="text-sm text-muted-foreground">{selectedAgent.department}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Utilization</div>
            <div className="text-2xl font-bold">{Math.round(selectedAgent.utilization)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Completion Rate</div>
            <div className="text-2xl font-bold">{Math.round(selectedAgent.completionRate)}%</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tasks Completed</span>
            <span className="font-medium">{selectedAgent.tasksCompleted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tasks Assigned</span>
            <span className="font-medium">{selectedAgent.tasksAssigned}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Avg Response Time</span>
            <span className="font-medium">{Math.round(selectedAgent.avgResponseTime)}s</span>
          </div>
        </div>
        
        {selectedAgent.bottleneckScore > 7 && (
          <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">Performance bottleneck detected</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Heatmap Legend
const HeatmapLegend: React.FC<{ metricType: MetricType }> = ({ metricType }) => {
  const getMetricLabel = () => {
    switch (metricType) {
      case 'utilization': return 'Utilization Rate'
      case 'completion': return 'Completion Rate'
      case 'bottlenecks': return 'Bottleneck Risk'
      default: return 'Performance'
    }
  }

  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500']
  const labels = ['Low', 'Below Avg', 'Average', 'Above Avg', 'High']

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">{getMetricLabel()}</span>
      <div className="flex items-center gap-1">
        {colors.map((color, index) => (
          <div key={index} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded', color)} />
            {index === 0 && <span className="text-xs text-muted-foreground">{labels[0]}</span>}
            {index === colors.length - 1 && <span className="text-xs text-muted-foreground">{labels[4]}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Bottleneck Indicator
const BottleneckIndicator: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
      <AlertTriangle className="h-4 w-4 text-red-500" />
      <span className="text-sm font-medium text-red-700">
        {count} bottleneck{count !== 1 ? 's' : ''} detected
      </span>
    </div>
  )
}

// Main Component
const TeamPerformanceHeatmap: React.FC<TeamPerformanceHeatmapProps> = ({
  teamId,
  department,
  refreshInterval = 30000,
  className,
  onAgentSelect,
  onBottleneckDetected
}) => {
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([])
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('utilization')
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const [selectedAgent, setSelectedAgent] = useState<PerformanceMetric | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Mock data loading effect
  useEffect(() => {
    const loadData = () => {
      setIsLoading(true)
      setTimeout(() => {
        setPerformanceData(generateMockData(24))
        setIsLoading(false)
      }, 1000)
    }

    loadData()
    const interval = setInterval(loadData, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  // Process heatmap data
  const heatmapData = useMemo(() => {
    if (!performanceData.length) return []

    const getMetricValue = (metric: PerformanceMetric): number => {
      switch (selectedMetric) {
        case 'utilization': return metric.utilization
        case 'completion': return metric.completionRate
        case 'bottlenecks': return 100 - metric.bottleneckScore * 10
        default: return metric.utilization
      }
    }

    const values = performanceData.map(getMetricValue)
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)

    return performanceData.map((metric): HeatmapCellData => {
      const value = getMetricValue(metric)
      const normalizedValue = maxValue === minValue ? 0.5 : 
        (value - minValue) / (maxValue - minValue)

      return {
        agentId: metric.agentId,
        agentName: metric.agentName,
        value,
        normalizedValue,
        department: metric.department,
        status: metric.status,
        isBottleneck: metric.bottleneckScore > 7
      }
    })
  }, [performanceData, selectedMetric])

  // Handle cell selection
  const handleCellClick = useCallback((agentId: string) => {
    const agent = performanceData.find(a => a.agentId === agentId)
    setSelectedAgent(agent || null)
    onAgentSelect?.(agentId)
  }, [performanceData, onAgentSelect])

  // Calculate grid layout
  const gridSize = Math.ceil(Math.sqrt(heatmapData.length))
  const cellSize = Math.max(40, Math.min(60, 400 / gridSize))

  // Count bottlenecks
  const bottleneckCount = heatmapData.filter(d => d.isBottleneck).length

  // Notify about bottlenecks
  useEffect(() => {
    const bottleneckIds = heatmapData.filter(d => d.isBottleneck).map(d => d.agentId)
    if (bottleneckIds.length > 0) {
      onBottleneckDetected?.(bottleneckIds)
    }
  }, [heatmapData, onBottleneckDetected])

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 animate-spin" />
            <span>Loading team performance data...</span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Team Performance Heatmap
            </CardTitle>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={selectedMetric} onValueChange={(value: MetricType) => setSelectedMetric(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utilization">Utilization</SelectItem>
                  <SelectItem value="completion">Completion Rate</SelectItem>
                  <SelectItem value="bottlenecks">Bottlenecks</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="4h">4h</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <BottleneckIndicator count={bottleneckCount} />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <HeatmapLegend metricType={selectedMetric} />
          
          <div className="flex gap-4">
            <div
              className="grid gap-2 justify-center"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${Math.ceil(heatmapData.length / gridSize)}, ${cellSize}px)`
              }}
            >
              {heatmapData.map((data) => (
                <HeatmapCell
                  key={data.agentId}
                  data={data}
                  size={cellSize}
                  onClick={() => handleCellClick(data.agentId)}
                  isSelected={selectedAgent?.agentId === data.agentId}
                />
              ))}
            </div>
            
            <PerformanceMetricsPanel
              selectedAgent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TeamPerformanceHeatmap
```