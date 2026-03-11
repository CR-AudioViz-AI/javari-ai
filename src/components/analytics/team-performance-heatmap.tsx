```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, TrendingUp, TrendingDown, Users, Clock, Target } from 'lucide-react'
import { scaleLinear } from 'd3-scale'
import { interpolateRdYlGn, interpolateViridis } from 'd3-scale-chromatic'

interface TeamMember {
  id: string
  name: string
  role: string
  avatar?: string
  status: 'active' | 'busy' | 'away' | 'offline'
}

interface PerformanceMetric {
  id: string
  type: 'productivity' | 'collaboration' | 'quality' | 'velocity' | 'engagement'
  name: string
  value: number
  trend: 'up' | 'down' | 'stable'
  target: number
  unit: string
}

interface HeatMapData {
  memberId: string
  metricId: string
  value: number
  timestamp: Date
  bottleneck?: boolean
  collaborationScore?: number
}

interface CollaborationPattern {
  fromMember: string
  toMember: string
  strength: number
  type: 'mentoring' | 'peer_review' | 'knowledge_share' | 'project_collab'
}

interface BottleneckIndicator {
  memberId: string
  type: 'workload' | 'skill_gap' | 'communication' | 'resource'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: number
}

interface TimeRange {
  value: string
  label: string
  days: number
}

interface TeamPerformanceHeatMapProps {
  teamId: string
  refreshInterval?: number
  onCellClick?: (memberId: string, metricId: string, data: HeatMapData) => void
  onBottleneckClick?: (bottleneck: BottleneckIndicator) => void
  className?: string
}

const timeRanges: TimeRange[] = [
  { value: '1d', label: 'Last 24 Hours', days: 1 },
  { value: '3d', label: 'Last 3 Days', days: 3 },
  { value: '7d', label: 'Last Week', days: 7 },
  { value: '14d', label: 'Last 2 Weeks', days: 14 },
  { value: '30d', label: 'Last Month', days: 30 }
]

const mockMetrics: PerformanceMetric[] = [
  { id: 'productivity', type: 'productivity', name: 'Productivity', value: 85, trend: 'up', target: 80, unit: '%' },
  { id: 'collaboration', type: 'collaboration', name: 'Collaboration', value: 78, trend: 'stable', target: 75, unit: 'score' },
  { id: 'quality', type: 'quality', name: 'Code Quality', value: 92, trend: 'up', target: 90, unit: '%' },
  { id: 'velocity', type: 'velocity', name: 'Velocity', value: 67, trend: 'down', target: 70, unit: 'pts' },
  { id: 'engagement', type: 'engagement', name: 'Engagement', value: 88, trend: 'up', target: 85, unit: '%' }
]

const mockTeamMembers: TeamMember[] = [
  { id: 'member-1', name: 'Alice Johnson', role: 'Senior Developer', status: 'active' },
  { id: 'member-2', name: 'Bob Smith', role: 'UI/UX Designer', status: 'busy' },
  { id: 'member-3', name: 'Carol Davis', role: 'Product Manager', status: 'active' },
  { id: 'member-4', name: 'David Wilson', role: 'DevOps Engineer', status: 'away' },
  { id: 'member-5', name: 'Eva Martinez', role: 'QA Engineer', status: 'active' },
  { id: 'member-6', name: 'Frank Chen', role: 'Junior Developer', status: 'active' }
]

const HeatMapCell: React.FC<{
  data: HeatMapData
  metric: PerformanceMetric
  member: TeamMember
  colorScale: (value: number) => string
  onClick: () => void
}> = ({ data, metric, member, colorScale, onClick }) => {
  const normalizedValue = data.value / 100
  const cellColor = colorScale(normalizedValue)
  const textColor = normalizedValue > 0.5 ? '#ffffff' : '#000000'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="relative w-full h-12 rounded cursor-pointer border border-gray-200 dark:border-gray-700"
            style={{ backgroundColor: cellColor }}
            whileHover={{ scale: 1.05, zIndex: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center text-xs font-medium"
              style={{ color: textColor }}
            >
              {data.value.toFixed(0)}
            </div>
            
            {data.bottleneck && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <AlertTriangle className="w-2 h-2 text-white" />
              </motion.div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <MetricsTooltip data={data} metric={metric} member={member} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const MetricsTooltip: React.FC<{
  data: HeatMapData
  metric: PerformanceMetric
  member: TeamMember
}> = ({ data, metric, member }) => {
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Target

  return (
    <div className="space-y-2">
      <div className="font-semibold">{member.name}</div>
      <div className="text-sm text-muted-foreground">{member.role}</div>
      <div className="flex items-center gap-2">
        <span className="font-medium">{metric.name}:</span>
        <span>{data.value.toFixed(1)}{metric.unit}</span>
        <TrendIcon className={`w-3 h-3 ${
          metric.trend === 'up' ? 'text-green-500' : 
          metric.trend === 'down' ? 'text-red-500' : 'text-gray-500'
        }`} />
      </div>
      <div className="text-xs text-muted-foreground">
        Target: {metric.target}{metric.unit}
      </div>
      {data.collaborationScore && (
        <div className="flex items-center gap-1 text-xs">
          <Users className="w-3 h-3" />
          <span>Collaboration: {data.collaborationScore}/100</span>
        </div>
      )}
      {data.bottleneck && (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Bottleneck Detected
        </Badge>
      )}
    </div>
  )
}

const PerformanceLegend: React.FC<{
  colorScale: (value: number) => string
}> = ({ colorScale }) => {
  const legendSteps = Array.from({ length: 11 }, (_, i) => i / 10)

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Low</span>
      <div className="flex gap-1">
        {legendSteps.map((step, index) => (
          <div
            key={index}
            className="w-4 h-4 rounded-sm border border-gray-200 dark:border-gray-700"
            style={{ backgroundColor: colorScale(step) }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">High</span>
    </div>
  )
}

const TeamMemberCard: React.FC<{
  member: TeamMember
  isSelected?: boolean
  onClick?: () => void
}> = ({ member, isSelected, onClick }) => {
  const statusColors = {
    active: 'bg-green-500',
    busy: 'bg-yellow-500',
    away: 'bg-orange-500',
    offline: 'bg-gray-500'
  }

  return (
    <motion.div
      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted/50'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <div className="relative">
        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium">
            {member.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            statusColors[member.status]
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{member.name}</div>
        <div className="text-xs text-muted-foreground truncate">{member.role}</div>
      </div>
    </motion.div>
  )
}

const CollaborationIndicator: React.FC<{
  patterns: CollaborationPattern[]
  members: TeamMember[]
}> = ({ patterns, members }) => {
  const memberMap = useMemo(() => 
    Object.fromEntries(members.map(m => [m.id, m])), 
    [members]
  )

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Users className="w-4 h-4" />
        Collaboration Patterns
      </h4>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {patterns.slice(0, 5).map((pattern, index) => (
          <motion.div
            key={index}
            className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center gap-2">
              <span>{memberMap[pattern.fromMember]?.name}</span>
              <span className="text-muted-foreground">→</span>
              <span>{memberMap[pattern.toMember]?.name}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {pattern.type.replace('_', ' ')}
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const BottleneckAlert: React.FC<{
  bottlenecks: BottleneckIndicator[]
  members: TeamMember[]
  onClick: (bottleneck: BottleneckIndicator) => void
}> = ({ bottlenecks, members, onClick }) => {
  const memberMap = useMemo(() => 
    Object.fromEntries(members.map(m => [m.id, m])), 
    [members]
  )

  const severityColors = {
    low: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    medium: 'text-orange-600 bg-orange-50 border-orange-200',
    high: 'text-red-600 bg-red-50 border-red-200',
    critical: 'text-red-800 bg-red-100 border-red-300'
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Active Bottlenecks
      </h4>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {bottlenecks.map((bottleneck, index) => (
            <motion.div
              key={`${bottleneck.memberId}-${bottleneck.type}`}
              className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-opacity-80 ${
                severityColors[bottleneck.severity]
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onClick(bottleneck)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {memberMap[bottleneck.memberId]?.name}
                  </div>
                  <div className="text-xs mt-1">{bottleneck.description}</div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {bottleneck.type.replace('_', ' ')}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-medium">Impact: {bottleneck.impact}%</span>
                <Badge
                  variant={bottleneck.severity === 'critical' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {bottleneck.severity}
                </Badge>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

const TimeRangeSelector: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {timeRanges.map((range) => (
          <SelectItem key={range.value} value={range.value}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {range.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const TeamPerformanceHeatMap: React.FC<TeamPerformanceHeatMapProps> = ({
  teamId,
  refreshInterval = 30000,
  onCellClick,
  onBottleneckClick,
  className = ''
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d')
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([])
  const [collaborationPatterns, setCollaborationPatterns] = useState<CollaborationPattern[]>([])
  const [bottlenecks, setBottlenecks] = useState<BottleneckIndicator[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Mock data generation
  const generateMockHeatMapData = useCallback(() => {
    const data: HeatMapData[] = []
    
    mockTeamMembers.forEach(member => {
      mockMetrics.forEach(metric => {
        const baseValue = Math.random() * 40 + 60 // 60-100 range
        const hasBottleneck = Math.random() < 0.1 // 10% chance of bottleneck
        const collaborationScore = Math.random() * 30 + 70 // 70-100 range
        
        data.push({
          memberId: member.id,
          metricId: metric.id,
          value: baseValue,
          timestamp: new Date(),
          bottleneck: hasBottleneck,
          collaborationScore
        })
      })
    })
    
    return data
  }, [])

  const generateMockCollaborationPatterns = useCallback((): CollaborationPattern[] => {
    const patterns: CollaborationPattern[] = []
    const types: CollaborationPattern['type'][] = ['mentoring', 'peer_review', 'knowledge_share', 'project_collab']
    
    for (let i = 0; i < 8; i++) {
      const fromMember = mockTeamMembers[Math.floor(Math.random() * mockTeamMembers.length)]
      let toMember = mockTeamMembers[Math.floor(Math.random() * mockTeamMembers.length)]
      while (toMember.id === fromMember.id) {
        toMember = mockTeamMembers[Math.floor(Math.random() * mockTeamMembers.length)]
      }
      
      patterns.push({
        fromMember: fromMember.id,
        toMember: toMember.id,
        strength: Math.random() * 80 + 20,
        type: types[Math.floor(Math.random() * types.length)]
      })
    }
    
    return patterns
  }, [])

  const generateMockBottlenecks = useCallback((): BottleneckIndicator[] => {
    const bottlenecks: BottleneckIndicator[] = []
    const types: BottleneckIndicator['type'][] = ['workload', 'skill_gap', 'communication', 'resource']
    const severities: BottleneckIndicator['severity'][] = ['low', 'medium', 'high', 'critical']
    
    for (let i = 0; i < 3; i++) {
      const member = mockTeamMembers[Math.floor(Math.random() * mockTeamMembers.length)]
      const type = types[Math.floor(Math.random() * types.length)]
      const severity = severities[Math.floor(Math.random() * severities.length)]
      
      bottlenecks.push({
        memberId: member.id,
        type,
        severity,
        description: `${type.replace('_', ' ')} bottleneck affecting ${member.name}`,
        impact: Math.random() * 60 + 20
      })
    }
    
    return bottlenecks
  }, [])

  // Color scale for heat map
  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, 1])
      .range(['#ff4444', '#44ff44'])
      .interpolate(() => (t: number) => interpolateRdYlGn(t))
  }, [])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setHeatMapData(generateMockHeatMapData())
      setCollaborationPatterns(generateMockCollaborationPatterns())
      setBottlenecks(generateMockBottlenecks())
      setIsLoading(false)
    }

    loadData()
  }, [teamId, selectedTimeRange, generateMockHeatMapData, generateMockCollaborationPatterns, generateMockBottlenecks])

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(() => {
      setHeatMapData(generateMockHeatMapData())
      setCollaborationPatterns(generateMockCollaborationPatterns())
      setBottlenecks(generateMockBottlenecks())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, generateMockHeatMapData, generateMockCollaborationPatterns, generateMockBottlenecks])

  const handleCellClick = useCallback((member: TeamMember, metric: PerformanceMetric) => {
    const data = heatMapData.find(d => d.memberId === member.id && d.metricId === metric.id)
    if (data && onCellClick) {
      onCellClick(member.id, metric.id, data)
    }
  }, [heatMapData, onCellClick])

  const handleBottleneckClick = useCallback((bottleneck: BottleneckIndicator) => {
    if (onBottleneckClick) {
      onBottleneckClick(bottleneck)
    }
  }, [onBottleneckClick])

  const filteredMembers = selectedMember 
    ? mockTeamMembers.filter(m => m.id === selectedMember)
    : mockTeamMembers

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Team Performance Heat Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <motion.div
              className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </CardContent>
      </Card>
    )