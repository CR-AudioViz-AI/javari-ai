```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  X, 
  Filter, 
  Download, 
  Search, 
  Star, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Zap,
  BarChart3,
  Heart,
  MessageSquare,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  avatar_url?: string
  category: string
  rating: number
  review_count: number
  price_tier: 'free' | 'basic' | 'pro' | 'enterprise'
  verified: boolean
  capabilities: Capability[]
  pricing: PricingTier[]
  reviews: Review[]
  metrics: PerformanceMetrics
  created_at: string
  updated_at: string
}

interface Capability {
  id: string
  name: string
  category: string
  proficiency_score: number
  supported: boolean
}

interface PricingTier {
  id: string
  name: string
  price: number
  billing_period: 'monthly' | 'yearly'
  features: string[]
  limits: Record<string, number>
}

interface Review {
  id: string
  user_name: string
  rating: number
  comment: string
  sentiment: 'positive' | 'neutral' | 'negative'
  created_at: string
}

interface PerformanceMetrics {
  response_time_ms: number
  accuracy_score: number
  uptime_percentage: number
  monthly_active_users: number
  success_rate: number
}

interface ComparisonFilters {
  category: string[]
  priceTier: string[]
  minRating: number
  capabilities: string[]
  verified: boolean
}

interface AgentComparisonToolProps {
  className?: string
  onAgentSelect?: (agents: Agent[]) => void
  maxAgents?: number
}

const defaultFilters: ComparisonFilters = {
  category: [],
  priceTier: [],
  minRating: 0,
  capabilities: [],
  verified: false
}

export default function AgentComparisonTool({ 
  className = '',
  onAgentSelect,
  maxAgents = 4
}: AgentComparisonToolProps) {
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
  const [filters, setFilters] = useState<ComparisonFilters>(defaultFilters)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'price' | 'popularity'>('rating')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Mock data for demonstration
  useEffect(() => {
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'DataAnalyzer Pro',
        description: 'Advanced data analysis and visualization agent with ML capabilities',
        avatar_url: '/agents/data-analyzer.png',
        category: 'Data Analysis',
        rating: 4.8,
        review_count: 124,
        price_tier: 'pro',
        verified: true,
        capabilities: [
          { id: '1', name: 'Data Processing', category: 'Core', proficiency_score: 95, supported: true },
          { id: '2', name: 'Machine Learning', category: 'Advanced', proficiency_score: 88, supported: true },
          { id: '3', name: 'Visualization', category: 'Core', proficiency_score: 92, supported: true },
          { id: '4', name: 'Real-time Analytics', category: 'Premium', proficiency_score: 85, supported: true }
        ],
        pricing: [
          {
            id: '1',
            name: 'Pro',
            price: 49,
            billing_period: 'monthly',
            features: ['Advanced Analytics', 'ML Models', 'API Access', '24/7 Support'],
            limits: { requests_per_month: 10000, storage_gb: 100 }
          }
        ],
        reviews: [
          {
            id: '1',
            user_name: 'Sarah Chen',
            rating: 5,
            comment: 'Incredible tool for data analysis. Saved us hours of work.',
            sentiment: 'positive',
            created_at: '2024-01-15'
          }
        ],
        metrics: {
          response_time_ms: 250,
          accuracy_score: 94,
          uptime_percentage: 99.9,
          monthly_active_users: 2400,
          success_rate: 96
        },
        created_at: '2024-01-01',
        updated_at: '2024-01-20'
      },
      {
        id: '2',
        name: 'ContentCraft AI',
        description: 'Creative content generation agent for marketing and social media',
        avatar_url: '/agents/content-craft.png',
        category: 'Content Creation',
        rating: 4.6,
        review_count: 89,
        price_tier: 'basic',
        verified: true,
        capabilities: [
          { id: '1', name: 'Text Generation', category: 'Core', proficiency_score: 90, supported: true },
          { id: '2', name: 'Image Creation', category: 'Advanced', proficiency_score: 78, supported: true },
          { id: '3', name: 'SEO Optimization', category: 'Marketing', proficiency_score: 85, supported: true }
        ],
        pricing: [
          {
            id: '1',
            name: 'Basic',
            price: 29,
            billing_period: 'monthly',
            features: ['Content Generation', 'Templates', 'Basic Analytics'],
            limits: { posts_per_month: 500, storage_gb: 10 }
          }
        ],
        reviews: [
          {
            id: '1',
            user_name: 'Mike Johnson',
            rating: 4,
            comment: 'Great for social media content, could use more templates.',
            sentiment: 'positive',
            created_at: '2024-01-10'
          }
        ],
        metrics: {
          response_time_ms: 180,
          accuracy_score: 87,
          uptime_percentage: 99.5,
          monthly_active_users: 1800,
          success_rate: 92
        },
        created_at: '2023-12-15',
        updated_at: '2024-01-18'
      }
    ]
    setAvailableAgents(mockAgents)
  }, [])

  const filteredAgents = useMemo(() => {
    return availableAgents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           agent.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filters.category.length === 0 || filters.category.includes(agent.category)
      const matchesPriceTier = filters.priceTier.length === 0 || filters.priceTier.includes(agent.price_tier)
      const matchesRating = agent.rating >= filters.minRating
      const matchesVerified = !filters.verified || agent.verified

      return matchesSearch && matchesCategory && matchesPriceTier && matchesRating && matchesVerified
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'rating':
          return b.rating - a.rating
        case 'popularity':
          return b.review_count - a.review_count
        case 'price':
          const priceA = a.pricing[0]?.price || 0
          const priceB = b.pricing[0]?.price || 0
          return priceA - priceB
        default:
          return 0
      }
    })
  }, [availableAgents, searchQuery, filters, sortBy])

  const handleAddAgent = (agent: Agent) => {
    if (selectedAgents.length < maxAgents && !selectedAgents.find(a => a.id === agent.id)) {
      const newAgents = [...selectedAgents, agent]
      setSelectedAgents(newAgents)
      onAgentSelect?.(newAgents)
      setIsModalOpen(false)
    }
  }

  const handleRemoveAgent = (agentId: string) => {
    const newAgents = selectedAgents.filter(agent => agent.id !== agentId)
    setSelectedAgents(newAgents)
    onAgentSelect?.(newAgents)
  }

  const handleExport = async (format: 'pdf' | 'json') => {
    setLoading(true)
    try {
      // Mock export functionality
      await new Promise(resolve => setTimeout(resolve, 1000))
      const data = {
        comparison: selectedAgents,
        exportedAt: new Date().toISOString(),
        format
      }
      console.log('Export data:', data)
    } finally {
      setLoading(false)
    }
  }

  const renderCapabilityMatrix = (agents: Agent[]) => (
    <div className="space-y-4">
      {agents.length > 0 && agents[0].capabilities.map(capability => (
        <div key={capability.id} className="space-y-2">
          <h4 className="font-medium text-sm">{capability.name}</h4>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
            {agents.map(agent => {
              const agentCapability = agent.capabilities.find(c => c.name === capability.name)
              return (
                <div key={`${agent.id}-${capability.id}`} className="flex items-center gap-2">
                  {agentCapability?.supported ? (
                    <div className="flex items-center gap-2 flex-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Progress value={agentCapability.proficiency_score} className="flex-1" />
                      <span className="text-sm text-muted-foreground">
                        {agentCapability.proficiency_score}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-muted-foreground">Not supported</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  const renderPricingBreakdown = (agents: Agent[]) => (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
      {agents.map(agent => (
        <Card key={agent.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{agent.pricing[0]?.name || 'Custom'}</CardTitle>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">${agent.pricing[0]?.price || 0}</span>
              <span className="text-muted-foreground">/{agent.pricing[0]?.billing_period || 'month'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Features</h5>
              {agent.pricing[0]?.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            {agent.pricing[0]?.limits && (
              <div className="space-y-2">
                <h5 className="font-medium text-sm">Limits</h5>
                {Object.entries(agent.pricing[0].limits).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="capitalize">{key.replace('_', ' ')}</span>
                    <span className="font-medium">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderPerformanceMetrics = (agents: Agent[]) => (
    <div className="space-y-6">
      {[
        { key: 'response_time_ms', label: 'Response Time', unit: 'ms', icon: Clock, lower_is_better: true },
        { key: 'accuracy_score', label: 'Accuracy Score', unit: '%', icon: TrendingUp },
        { key: 'uptime_percentage', label: 'Uptime', unit: '%', icon: Shield },
        { key: 'success_rate', label: 'Success Rate', unit: '%', icon: CheckCircle }
      ].map(metric => (
        <div key={metric.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <metric.icon className="h-4 w-4" />
            <h4 className="font-medium">{metric.label}</h4>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
            {agents.map(agent => {
              const value = agent.metrics[metric.key as keyof PerformanceMetrics] as number
              const displayValue = metric.unit === '%' ? value : value
              return (
                <div key={agent.id} className="text-center">
                  <div className="text-2xl font-bold">{displayValue}{metric.unit}</div>
                  <div className="text-sm text-muted-foreground">{agent.name}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Comparison</h2>
          <p className="text-muted-foreground">
            Compare up to {maxAgents} agents side by side
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="popularity">Popularity</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={selectedAgents.length === 0 || loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${maxAgents}, 1fr)` }}>
        {Array.from({ length: maxAgents }).map((_, index) => {
          const agent = selectedAgents[index]
          return (
            <Card key={index} className="min-h-32">
              {agent ? (
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={agent.avatar_url} alt={agent.name} />
                        <AvatarFallback>{agent.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-sm">{agent.name}</h3>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {agent.rating} ({agent.review_count})
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAgent(agent.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {agent.category}
                  </Badge>
                </CardContent>
              ) : (
                <CardContent className="p-4 flex items-center justify-center h-full">
                  <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Agent
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Select Agent to Compare</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Search and Filters */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                              placeholder="Search agents..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                          </Button>
                        </div>

                        {/* Agent List */}
                        <ScrollArea className="h-96">
                          <div className="space-y-2">
                            {filteredAgents.map(agent => (
                              <Card
                                key={agent.id}
                                className={`cursor-pointer transition-colors hover:bg-accent ${
                                  selectedAgents.find(a => a.id === agent.id) ? 'opacity-50' : ''
                                }`}
                                onClick={() => handleAddAgent(agent)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarImage src={agent.avatar_url} alt={agent.name} />
                                      <AvatarFallback>{agent.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold">{agent.name}</h3>
                                        {agent.verified && (
                                          <CheckCircle className="h-4 w-4 text-blue-600" />
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {agent.description}
                                      </p>
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                          <span className="text-xs">
                                            {agent.rating} ({agent.review_count})
                                          </span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                          {agent.category}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {agent.price_tier}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Comparison Content */}
      {selectedAgents.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space