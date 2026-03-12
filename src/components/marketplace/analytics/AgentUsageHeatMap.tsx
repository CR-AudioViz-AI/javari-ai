```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Activity, Globe, TrendingUp, Users, Zap, Info } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import 'leaflet/dist/leaflet.css'

interface UsageDataPoint {
  id: string
  latitude: number
  longitude: number
  intensity: number
  region: string
  country: string
  agentCount: number
  totalExecutions: number
  successRate: number
  avgResponseTime: number
  timestamp: string
}

interface RegionMetrics {
  region: string
  totalAgents: number
  totalExecutions: number
  averageSuccessRate: number
  averageResponseTime: number
  activeUsers: number
  growthRate: number
}

interface AgentUsageHeatMapProps {
  className?: string
  height?: number
  autoRefresh?: boolean
  refreshInterval?: number
  showControls?: boolean
  defaultTimeRange?: '1h' | '24h' | '7d' | '30d'
  onRegionSelect?: (region: RegionMetrics | null) => void
}

interface HeatMapControlsProps {
  timeRange: string
  onTimeRangeChange: (value: string) => void
  showRealTime: boolean
  onShowRealTimeChange: (value: boolean) => void
  intensityMetric: string
  onIntensityMetricChange: (value: string) => void
  selectedRegion: RegionMetrics | null
}

interface MetricsLegendProps {
  intensityMetric: string
  maxIntensity: number
  minIntensity: number
}

interface RegionTooltipProps {
  data: UsageDataPoint
  visible: boolean
  position: { x: number; y: number }
}

interface UsageMetricsOverlayProps {
  metrics: RegionMetrics[]
  selectedRegion: RegionMetrics | null
}

const HeatMapControls: React.FC<HeatMapControlsProps> = ({
  timeRange,
  onTimeRangeChange,
  showRealTime,
  onShowRealTimeChange,
  intensityMetric,
  onIntensityMetricChange,
  selectedRegion
}) => {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 border-b">
      <div className="flex items-center space-x-2">
        <Label htmlFor="time-range">Time Range</Label>
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger id="time-range" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Label htmlFor="intensity-metric">Intensity</Label>
        <Select value={intensityMetric} onValueChange={onIntensityMetricChange}>
          <SelectTrigger id="intensity-metric" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="executions">Executions</SelectItem>
            <SelectItem value="agents">Agent Count</SelectItem>
            <SelectItem value="success_rate">Success Rate</SelectItem>
            <SelectItem value="response_time">Response Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="real-time"
          checked={showRealTime}
          onCheckedChange={onShowRealTimeChange}
        />
        <Label htmlFor="real-time">Real-time Updates</Label>
        {showRealTime && (
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
        )}
      </div>

      {selectedRegion && (
        <Badge variant="outline" className="ml-auto">
          Selected: {selectedRegion.region}
        </Badge>
      )}
    </div>
  )
}

const MetricsLegend: React.FC<MetricsLegendProps> = ({
  intensityMetric,
  maxIntensity,
  minIntensity
}) => {
  const getMetricLabel = (metric: string) => {
    const labels = {
      executions: 'Executions',
      agents: 'Agents',
      success_rate: 'Success Rate (%)',
      response_time: 'Response Time (ms)'
    }
    return labels[metric as keyof typeof labels] || metric
  }

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'success_rate':
        return `${value.toFixed(1)}%`
      case 'response_time':
        return `${value.toFixed(0)}ms`
      default:
        return value.toLocaleString()
    }
  }

  return (
    <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg z-[1000]">
      <div className="text-sm font-medium mb-2">{getMetricLabel(intensityMetric)}</div>
      <div className="flex items-center space-x-2">
        <span className="text-xs text-muted-foreground">
          {formatValue(minIntensity, intensityMetric)}
        </span>
        <div className="w-20 h-3 bg-gradient-to-r from-blue-200 via-yellow-400 to-red-600 rounded" />
        <span className="text-xs text-muted-foreground">
          {formatValue(maxIntensity, intensityMetric)}
        </span>
      </div>
    </div>
  )
}

const RegionTooltip: React.FC<RegionTooltipProps> = ({ data, visible, position }) => {
  if (!visible) return null

  return (
    <div
      className="absolute z-[1001] bg-background border rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="font-medium mb-1">{data.region}, {data.country}</div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <div>Agents: {data.agentCount.toLocaleString()}</div>
        <div>Executions: {data.totalExecutions.toLocaleString()}</div>
        <div>Success Rate: {data.successRate.toFixed(1)}%</div>
        <div>Avg Response: {data.avgResponseTime.toFixed(0)}ms</div>
      </div>
    </div>
  )
}

const UsageMetricsOverlay: React.FC<UsageMetricsOverlayProps> = ({
  metrics,
  selectedRegion
}) => {
  const totalMetrics = useMemo(() => {
    if (selectedRegion) {
      return {
        totalAgents: selectedRegion.totalAgents,
        totalExecutions: selectedRegion.totalExecutions,
        averageSuccessRate: selectedRegion.averageSuccessRate,
        averageResponseTime: selectedRegion.averageResponseTime,
        activeUsers: selectedRegion.activeUsers,
        growthRate: selectedRegion.growthRate
      }
    }

    return metrics.reduce((acc, metric) => ({
      totalAgents: acc.totalAgents + metric.totalAgents,
      totalExecutions: acc.totalExecutions + metric.totalExecutions,
      averageSuccessRate: acc.averageSuccessRate + metric.averageSuccessRate / metrics.length,
      averageResponseTime: acc.averageResponseTime + metric.averageResponseTime / metrics.length,
      activeUsers: acc.activeUsers + metric.activeUsers,
      growthRate: acc.growthRate + metric.growthRate / metrics.length
    }), {
      totalAgents: 0,
      totalExecutions: 0,
      averageSuccessRate: 0,
      averageResponseTime: 0,
      activeUsers: 0,
      growthRate: 0
    })
  }, [metrics, selectedRegion])

  return (
    <div className="absolute top-4 left-4 space-y-2 z-[1000]">
      <div className="grid grid-cols-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="bg-background/95 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">
                        {totalMetrics.totalAgents.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Active Agents</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total number of active AI agents</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="bg-background/95 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <div>
                      <div className="text-sm font-medium">
                        {totalMetrics.totalExecutions.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Executions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total number of agent executions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="bg-background/95 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                    <div>
                      <div className="text-sm font-medium">
                        {totalMetrics.averageSuccessRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Success Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average success rate across all executions</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="bg-background/95 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="text-sm font-medium">
                        {totalMetrics.activeUsers.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Active Users</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Number of active users in the selected region</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {selectedRegion && (
        <Card className="bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedRegion.region} Region Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Avg Response Time:</span>
                <span>{selectedRegion.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Growth Rate:</span>
                <span className={selectedRegion.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {selectedRegion.growthRate >= 0 ? '+' : ''}{selectedRegion.growthRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const LoadingHeatMap: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Globe className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading heat map data...</p>
        </div>
      </div>
    </div>
  )
}

const AgentUsageHeatMap: React.FC<AgentUsageHeatMapProps> = ({
  className,
  height = 600,
  autoRefresh = true,
  refreshInterval = 30000,
  showControls = true,
  defaultTimeRange = '24h',
  onRegionSelect
}) => {
  const [usageData, setUsageData] = useState<UsageDataPoint[]>([])
  const [metrics, setMetrics] = useState<RegionMetrics[]>([])
  const [selectedRegion, setSelectedRegion] = useState<RegionMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(defaultTimeRange)
  const [showRealTime, setShowRealTime] = useState(autoRefresh)
  const [intensityMetric, setIntensityMetric] = useState('executions')
  const [tooltip, setTooltip] = useState<{
    data: UsageDataPoint
    visible: boolean
    position: { x: number; y: number }
  }>({
    data: {} as UsageDataPoint,
    visible: false,
    position: { x: 0, y: 0 }
  })

  const supabase = createClientComponentClient()

  const fetchUsageData = useCallback(async () => {
    try {
      setError(null)
      
      const hoursMap = {
        '1h': 1,
        '24h': 24,
        '7d': 168,
        '30d': 720
      }
      
      const hours = hoursMap[timeRange as keyof typeof hoursMap]
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      const { data: rawData, error: fetchError } = await supabase
        .from('marketplace_analytics')
        .select(`
          id,
          region,
          country,
          latitude,
          longitude,
          agent_count,
          total_executions,
          success_rate,
          avg_response_time,
          active_users,
          growth_rate,
          created_at
        `)
        .gte('created_at', startTime)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Process and aggregate data
      const processedData: UsageDataPoint[] = []
      const regionMetrics: { [key: string]: RegionMetrics } = {}

      rawData?.forEach((item) => {
        const intensity = calculateIntensity(item, intensityMetric)
        
        processedData.push({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          intensity,
          region: item.region,
          country: item.country,
          agentCount: item.agent_count,
          totalExecutions: item.total_executions,
          successRate: item.success_rate,
          avgResponseTime: item.avg_response_time,
          timestamp: item.created_at
        })

        // Aggregate region metrics
        if (!regionMetrics[item.region]) {
          regionMetrics[item.region] = {
            region: item.region,
            totalAgents: 0,
            totalExecutions: 0,
            averageSuccessRate: 0,
            averageResponseTime: 0,
            activeUsers: 0,
            growthRate: 0
          }
        }

        const region = regionMetrics[item.region]
        region.totalAgents += item.agent_count
        region.totalExecutions += item.total_executions
        region.averageSuccessRate += item.success_rate
        region.averageResponseTime += item.avg_response_time
        region.activeUsers += item.active_users
        region.growthRate += item.growth_rate
      })

      // Average the accumulated values
      Object.values(regionMetrics).forEach(region => {
        const count = rawData?.filter(item => item.region === region.region).length || 1
        region.averageSuccessRate /= count
        region.averageResponseTime /= count
        region.growthRate /= count
      })

      setUsageData(processedData)
      setMetrics(Object.values(regionMetrics))
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data')
      setLoading(false)
    }
  }, [timeRange, intensityMetric, supabase])

  const calculateIntensity = (item: any, metric: string): number => {
    switch (metric) {
      case 'executions':
        return Math.min(item.total_executions / 1000, 1) // Normalize to 0-1
      case 'agents':
        return Math.min(item.agent_count / 100, 1)
      case 'success_rate':
        return item.success_rate / 100
      case 'response_time':
        return Math.max(0, 1 - (item.avg_response_time / 5000)) // Inverse: lower time = higher intensity
      default:
        return Math.min(item.total_executions / 1000, 1)
    }
  }

  const heatmapPoints = useMemo(() => {
    return usageData.map(point => [
      point.latitude,
      point.longitude,
      point.intensity
    ])
  }, [usageData])

  const { maxIntensity, minIntensity } = useMemo(() => {
    if (usageData.length === 0) return { maxIntensity: 1, minIntensity: 0 }
    
    const intensities = usageData.map(d => d.intensity)
    return {
      maxIntensity: Math.max(...intensities),
      minIntensity: Math.min(...intensities)
    }
  }, [usageData])

  useEffect(() => {
    fetchUsageData()
  }, [fetchUsageData])

  useEffect(() => {
    if (!showRealTime) return

    const interval = setInterval(fetchUsageData, refreshInterval)
    return () => clearInterval(interval)
  }, [showRealTime, refreshInterval, fetchUsageData])

  useEffect(() => {
    if (!showRealTime) return

    const channel = supabase
      .channel('agent_usage_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'marketplace_analytics'
        },
        () => {
          fetchUsageData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showRealTime, supabase, fetchUsageData])

  const handleRegionClick = useCallback((region: RegionMetrics) => {
    const newSelection = selectedRegion?.region === region.region ? null : region
    setSelectedRegion(newSelection)
    onRegionSelect?.(newSelection)
  }, [selectedRegion, onRegionSelect])

  if (loading) {
    return (
      <Card className={className}>
        <LoadingHeatMap />
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center space-y-2">
            <Info className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Error loading heat map data</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {showControls && (
        <HeatMapControls
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showRealTime={showRealTime}
          onShowRealTimeChange={setShowRealTime}