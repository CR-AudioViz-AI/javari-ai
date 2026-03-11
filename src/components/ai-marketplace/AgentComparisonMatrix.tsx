```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  Plus, 
  X, 
  Download, 
  Star, 
  TrendingUp, 
  Zap, 
  Clock, 
  DollarSign,
  Check,
  Minus
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface Agent {
  id: string
  name: string
  description: string
  category: string
  rating: number
  totalRatings: number
  logoUrl?: string
  developer: string
  version: string
  status: 'active' | 'beta' | 'deprecated'
}

interface AgentFeature {
  id: string
  agentId: string
  category: string
  name: string
  supported: boolean
  level?: 'basic' | 'advanced' | 'premium'
  description?: string
}

interface AgentPricing {
  id: string
  agentId: string
  tier: string
  price: number
  currency: string
  billing: 'monthly' | 'annually' | 'usage'
  features: string[]
  limits: Record<string, number | string>
  isPopular?: boolean
}

interface AgentMetrics {
  id: string
  agentId: string
  performance: number
  accuracy: number
  speed: number
  reliability: number
  costEfficiency: number
  responseTime: number
  uptime: number
  apiCalls: number
}

interface ComparisonFeature {
  category: string
  name: string
  description?: string
  agents: Record<string, {
    supported: boolean
    level?: string
    notes?: string
  }>
}

interface AgentComparisonMatrixProps {
  initialAgentIds?: string[]
  availableAgents?: Agent[]
  maxAgents?: number
  showFeatures?: boolean
  showPricing?: boolean
  showMetrics?: boolean
  allowExport?: boolean
  onAgentAdd?: (agentId: string) => void
  onAgentRemove?: (agentId: string) => void
  onExport?: (data: any) => void
}

// Mock data - replace with actual data fetching
const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'AudioMind Pro',
    description: 'Advanced AI agent for audio processing and analysis',
    category: 'Audio Processing',
    rating: 4.8,
    totalRatings: 156,
    developer: 'CR AudioViz',
    version: '2.1.0',
    status: 'active'
  },
  {
    id: '2',
    name: 'VoiceInsight AI',
    description: 'Speech recognition and voice analysis specialist',
    category: 'Voice Analysis',
    rating: 4.6,
    totalRatings: 203,
    developer: 'VoiceTech Labs',
    version: '1.8.5',
    status: 'active'
  },
  {
    id: '3',
    name: 'SoundWave Engine',
    description: 'Real-time audio processing and enhancement',
    category: 'Audio Processing',
    rating: 4.7,
    totalRatings: 89,
    developer: 'AudioFlow Inc',
    version: '3.0.2',
    status: 'beta'
  }
]

const mockFeatures: AgentFeature[] = [
  { id: '1', agentId: '1', category: 'Audio Processing', name: 'Noise Reduction', supported: true, level: 'advanced' },
  { id: '2', agentId: '1', category: 'Audio Processing', name: 'Audio Enhancement', supported: true, level: 'premium' },
  { id: '3', agentId: '1', category: 'Analysis', name: 'Spectral Analysis', supported: true, level: 'advanced' },
  { id: '4', agentId: '2', category: 'Audio Processing', name: 'Noise Reduction', supported: true, level: 'basic' },
  { id: '5', agentId: '2', category: 'Voice Analysis', name: 'Speech Recognition', supported: true, level: 'premium' },
  { id: '6', agentId: '3', category: 'Audio Processing', name: 'Real-time Processing', supported: true, level: 'advanced' }
]

const mockPricing: AgentPricing[] = [
  {
    id: '1',
    agentId: '1',
    tier: 'Pro',
    price: 49.99,
    currency: 'USD',
    billing: 'monthly',
    features: ['Advanced Processing', 'API Access', 'Custom Models'],
    limits: { apiCalls: 10000, storage: '100GB' },
    isPopular: true
  },
  {
    id: '2',
    agentId: '2',
    tier: 'Standard',
    price: 29.99,
    currency: 'USD',
    billing: 'monthly',
    features: ['Speech Recognition', 'Basic Analysis', 'API Access'],
    limits: { apiCalls: 5000, storage: '50GB' }
  }
]

const mockMetrics: AgentMetrics[] = [
  {
    id: '1',
    agentId: '1',
    performance: 95,
    accuracy: 97,
    speed: 88,
    reliability: 99,
    costEfficiency: 85,
    responseTime: 150,
    uptime: 99.9,
    apiCalls: 125000
  },
  {
    id: '2',
    agentId: '2',
    performance: 90,
    accuracy: 93,
    speed: 92,
    reliability: 96,
    costEfficiency: 78,
    responseTime: 120,
    uptime: 98.5,
    apiCalls: 98000
  }
]

export const AgentComparisonMatrix: React.FC<AgentComparisonMatrixProps> = ({
  initialAgentIds = [],
  availableAgents = mockAgents,
  maxAgents = 5,
  showFeatures = true,
  showPricing = true,
  showMetrics = true,
  allowExport = true,
  onAgentAdd,
  onAgentRemove,
  onExport
}) => {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(initialAgentIds)
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'pricing' | 'metrics'>('overview')

  const selectedAgents = availableAgents.filter(agent => selectedAgentIds.includes(agent.id))
  const availableToAdd = availableAgents.filter(agent => !selectedAgentIds.includes(agent.id))

  const handleAddAgent = (agentId: string) => {
    if (selectedAgentIds.length < maxAgents) {
      const newIds = [...selectedAgentIds, agentId]
      setSelectedAgentIds(newIds)
      onAgentAdd?.(agentId)
    }
  }

  const handleRemoveAgent = (agentId: string) => {
    const newIds = selectedAgentIds.filter(id => id !== agentId)
    setSelectedAgentIds(newIds)
    onAgentRemove?.(agentId)
  }

  const buildComparisonFeatures = (): ComparisonFeature[] => {
    const featureMap = new Map<string, ComparisonFeature>()
    
    mockFeatures.forEach(feature => {
      if (selectedAgentIds.includes(feature.agentId)) {
        const key = `${feature.category}-${feature.name}`
        if (!featureMap.has(key)) {
          featureMap.set(key, {
            category: feature.category,
            name: feature.name,
            description: feature.description,
            agents: {}
          })
        }
        
        const compFeature = featureMap.get(key)!
        compFeature.agents[feature.agentId] = {
          supported: feature.supported,
          level: feature.level
        }
      }
    })
    
    return Array.from(featureMap.values())
  }

  const getMetricsData = () => {
    return selectedAgents.map(agent => {
      const metrics = mockMetrics.find(m => m.agentId === agent.id)
      return {
        name: agent.name,
        performance: metrics?.performance || 0,
        accuracy: metrics?.accuracy || 0,
        speed: metrics?.speed || 0,
        reliability: metrics?.reliability || 0,
        costEfficiency: metrics?.costEfficiency || 0
      }
    })
  }

  const handleExport = () => {
    const exportData = {
      agents: selectedAgents,
      features: buildComparisonFeatures(),
      pricing: mockPricing.filter(p => selectedAgentIds.includes(p.agentId)),
      metrics: mockMetrics.filter(m => selectedAgentIds.includes(m.agentId)),
      exportedAt: new Date().toISOString()
    }
    onExport?.(exportData)
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {selectedAgents.map((agent) => (
          <Card key={agent.id} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={() => handleRemoveAgent(agent.id)}
            >
              <X className="h-3 w-3" />
            </Button>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {agent.name.charAt(0)}
                </div>
                <div>
                  <CardTitle className="text-sm">{agent.name}</CardTitle>
                  <Badge variant={agent.status === 'active' ? 'default' : agent.status === 'beta' ? 'secondary' : 'destructive'} className="text-xs">
                    {agent.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{agent.description}</p>
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium">{agent.rating}</span>
                <span className="text-xs text-muted-foreground">({agent.totalRatings})</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Version:</span>
                  <span>{agent.version}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Developer:</span>
                  <span className="truncate">{agent.developer}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {selectedAgents.length < maxAgents && (
          <Card className="border-dashed border-2 border-muted-foreground/25">
            <CardContent className="flex flex-col items-center justify-center h-full py-8">
              <Select onValueChange={handleAddAgent}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add agent" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  const renderFeaturesTab = () => {
    const features = buildComparisonFeatures()
    const categories = [...new Set(features.map(f => f.category))]

    return (
      <div className="space-y-6">
        {categories.map(category => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Feature</TableHead>
                    {selectedAgents.map(agent => (
                      <TableHead key={agent.id} className="text-center">
                        {agent.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.filter(f => f.category === category).map(feature => (
                    <TableRow key={`${feature.category}-${feature.name}`}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{feature.name}</div>
                          {feature.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {feature.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {selectedAgents.map(agent => {
                        const agentFeature = feature.agents[agent.id]
                        return (
                          <TableCell key={agent.id} className="text-center">
                            {agentFeature ? (
                              <div className="flex flex-col items-center space-y-1">
                                {agentFeature.supported ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                {agentFeature.level && (
                                  <Badge 
                                    variant={
                                      agentFeature.level === 'premium' ? 'default' :
                                      agentFeature.level === 'advanced' ? 'secondary' : 'outline'
                                    }
                                    className="text-xs"
                                  >
                                    {agentFeature.level}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderPricingTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {selectedAgents.map(agent => {
        const pricing = mockPricing.find(p => p.agentId === agent.id)
        return (
          <Card key={agent.id} className={pricing?.isPopular ? 'border-primary shadow-lg' : ''}>
            {pricing?.isPopular && (
              <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-medium">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {agent.name}
                <Badge variant="outline">{pricing?.tier || 'Free'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricing ? (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-bold flex items-center justify-center">
                      <DollarSign className="h-6 w-6" />
                      {pricing.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      per {pricing.billing === 'monthly' ? 'month' : pricing.billing === 'annually' ? 'year' : 'usage'}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Features Included:</h4>
                    <ul className="space-y-1">
                      {pricing.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center space-x-2 text-sm">
                          <Check className="h-3 w-3 text-green-600" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Limits:</h4>
                    <div className="space-y-1">
                      {Object.entries(pricing.limits).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p className="text-2xl font-bold">Free</p>
                  <p className="text-sm">Pricing information not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  const renderMetricsTab = () => {
    const metricsData = getMetricsData()
    const radarData = selectedAgents.map(agent => {
      const metrics = mockMetrics.find(m => m.agentId === agent.id)
      return {
        agent: agent.name,
        Performance: metrics?.performance || 0,
        Accuracy: metrics?.accuracy || 0,
        Speed: metrics?.speed || 0,
        Reliability: metrics?.reliability || 0,
        'Cost Efficiency': metrics?.costEfficiency || 0
      }
    })

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart className="h-5 w-5" />
                <span>Performance Comparison</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="performance" fill="#8884d8" name="Performance" />
                  <Bar dataKey="accuracy" fill="#82ca9d" name="Accuracy" />
                  <Bar dataKey="speed" fill="#ffc658" name="Speed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Overall Capabilities</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="agent" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={18} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  {selectedAgents.map((agent, index) => (
                    <Radar
                      key={agent.id}
                      name={agent.name}
                      dataKey="Performance"
                      stroke={`hsl(${index * 120}, 70%, 50%)`}
                      fill={`hsl(${index * 120}, 70%, 50%)`}
                      fillOpacity={0.1}
                    />
                  ))}
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {selectedAgents.map(agent => {
            const metrics = mockMetrics.find(m => m.agentId === agent.id)
            if (!metrics) return null

            return (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{agent.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Performance</span>
                      <span>{metrics.performance}%</span>
                    </div>
                    <Progress value={metrics.performance} className="h-1" />
                  </div>
                  
                  <div className="space-y-2">