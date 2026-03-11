'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Calendar, Clock, Plus, Filter, Search, BarChart3, Lightbulb, Upload, Zap, Target, Settings, TrendingUp, Users, Play, Instagram, Youtube, Twitter, Calendar as CalendarIcon, Edit3, Trash2, Copy, Share2, Eye, MessageSquare, Heart, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface ContentItem {
  id: string
  title: string
  description: string
  type: 'video' | 'post' | 'story' | 'reel' | 'short'
  platforms: Platform[]
  scheduledDate: Date
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  thumbnailUrl?: string
  estimatedEngagement: number
  tags: string[]
  aiSuggested: boolean
}

interface Platform {
  id: string
  name: string
  icon: React.ComponentType<any>
  color: string
  connected: boolean
  lastSync?: Date
}

interface AISuggestion {
  id: string
  type: 'topic' | 'timing' | 'platform' | 'content'
  title: string
  description: string
  confidence: number
  reason: string
  suggestedDate?: Date
  platforms?: string[]
}

interface CalendarDay {
  date: Date
  isToday: boolean
  isThisMonth: boolean
  content: ContentItem[]
}

interface EngagementMetrics {
  date: string
  views: number
  likes: number
  comments: number
  shares: number
  engagement: number
}

interface CreatorContentCalendarProps {
  className?: string
}

const PLATFORMS: Platform[] = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000', connected: true, lastSync: new Date() },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F', connected: true, lastSync: new Date() },
  { id: 'tiktok', name: 'TikTok', icon: Play, color: '#000000', connected: false },
  { id: 'twitter', name: 'Twitter', icon: Twitter, color: '#1DA1F2', connected: true, lastSync: new Date() }
]

const CONTENT_TYPES = [
  { value: 'video', label: 'Video', color: 'bg-red-500' },
  { value: 'post', label: 'Post', color: 'bg-blue-500' },
  { value: 'story', label: 'Story', color: 'bg-purple-500' },
  { value: 'reel', label: 'Reel', color: 'bg-pink-500' },
  { value: 'short', label: 'Short', color: 'bg-green-500' }
]

const mockEngagementData: EngagementMetrics[] = [
  { date: '2024-01-01', views: 12500, likes: 850, comments: 120, shares: 45, engagement: 8.1 },
  { date: '2024-01-02', views: 15200, likes: 1200, comments: 180, shares: 67, engagement: 9.5 },
  { date: '2024-01-03', views: 9800, likes: 650, comments: 95, shares: 32, engagement: 7.9 },
  { date: '2024-01-04', views: 18500, likes: 1450, comments: 220, shares: 89, engagement: 9.8 },
  { date: '2024-01-05', views: 11200, likes: 780, comments: 110, shares: 41, engagement: 8.3 }
]

const mockAISuggestions: AISuggestion[] = [
  {
    id: '1',
    type: 'topic',
    title: 'Trending Audio Analysis',
    description: 'Create content about the latest trending audio formats like Dolby Atmos',
    confidence: 92,
    reason: 'High search volume and engagement in your niche',
    suggestedDate: new Date('2024-01-15')
  },
  {
    id: '2',
    type: 'timing',
    title: 'Optimal Posting Time',
    description: 'Post on Tuesday at 2 PM for 35% higher engagement',
    confidence: 87,
    reason: 'Based on your audience activity patterns'
  },
  {
    id: '3',
    type: 'platform',
    title: 'YouTube Shorts Opportunity',
    description: 'Your audio content performs 3x better in short format',
    confidence: 94,
    reason: 'Similar creators see higher reach with shorts',
    platforms: ['youtube']
  }
]

export default function CreatorContentCalendar({ className }: CreatorContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>(mockAISuggestions)
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [isBatchScheduleOpen, setIsBatchScheduleOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month')
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [engagementData, setEngagementData] = useState<EngagementMetrics[]>(mockEngagementData)

  // Generate calendar days for the current month
  const generateCalendarDays = useCallback((): CalendarDay[] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const today = new Date()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days: CalendarDay[] = []
    const currentDay = new Date(startDate)
    
    for (let i = 0; i < 42; i++) {
      const dayContent = contentItems.filter(item => 
        item.scheduledDate.toDateString() === currentDay.toDateString()
      )
      
      days.push({
        date: new Date(currentDay),
        isToday: currentDay.toDateString() === today.toDateString(),
        isThisMonth: currentDay.getMonth() === month,
        content: dayContent
      })
      
      currentDay.setDate(currentDay.getDate() + 1)
    }
    
    return days
  }, [currentDate, contentItems])

  const calendarDays = generateCalendarDays()

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result
    
    if (source.droppableId === destination.droppableId) return

    const contentItem = contentItems.find(item => item.id === draggableId)
    if (!contentItem) return

    const targetDate = new Date(destination.droppableId)
    
    setContentItems(prev => 
      prev.map(item => 
        item.id === draggableId 
          ? { ...item, scheduledDate: targetDate }
          : item
      )
    )
  }, [contentItems])

  const createQuickContent = useCallback((data: Partial<ContentItem>) => {
    const newContent: ContentItem = {
      id: Date.now().toString(),
      title: data.title || '',
      description: data.description || '',
      type: data.type || 'post',
      platforms: data.platforms || [],
      scheduledDate: data.scheduledDate || new Date(),
      status: 'draft',
      estimatedEngagement: Math.floor(Math.random() * 100),
      tags: data.tags || [],
      aiSuggested: false
    }
    
    setContentItems(prev => [...prev, newContent])
    setIsQuickCreateOpen(false)
  }, [])

  const getOptimalPostingTimes = useCallback(() => {
    return [
      { day: 'Monday', time: '9:00 AM', engagement: 78 },
      { day: 'Tuesday', time: '2:00 PM', engagement: 92 },
      { day: 'Wednesday', time: '11:00 AM', engagement: 85 },
      { day: 'Thursday', time: '3:00 PM', engagement: 89 },
      { day: 'Friday', time: '1:00 PM', engagement: 94 },
      { day: 'Saturday', time: '10:00 AM', engagement: 82 },
      { day: 'Sunday', time: '7:00 PM', engagement: 88 }
    ]
  }, [])

  const getContentMetrics = useCallback(() => {
    const total = contentItems.length
    const published = contentItems.filter(item => item.status === 'published').length
    const scheduled = contentItems.filter(item => item.status === 'scheduled').length
    const drafts = contentItems.filter(item => item.status === 'draft').length
    
    return { total, published, scheduled, drafts }
  }, [contentItems])

  const metrics = getContentMetrics()
  const optimalTimes = getOptimalPostingTimes()

  return (
    <div className={`flex flex-col space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">Plan, schedule, and optimize your content strategy</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsBatchScheduleOpen(true)}
            className="hidden sm:flex"
          >
            <Zap className="h-4 w-4 mr-2" />
            Batch Schedule
          </Button>
          <Button onClick={() => setIsQuickCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Content
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.published}</div>
            <p className="text-xs text-muted-foreground">+8% engagement rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.scheduled}</div>
            <p className="text-xs text-muted-foreground">Next: Today 2:00 PM</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.drafts}</div>
            <p className="text-xs text-muted-foreground">Ready to schedule</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <CardTitle>
                    {currentDate.toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                    >
                      →
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      {PLATFORMS.map(platform => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="month">Month</TabsTrigger>
                      <TabsTrigger value="week">Week</TabsTrigger>
                      <TabsTrigger value="list">List</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div
                      key={day}
                      className="bg-background p-3 text-sm font-medium text-center"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {calendarDays.map((day) => (
                    <Droppable
                      key={day.date.toISOString()}
                      droppableId={day.date.toISOString()}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`
                            bg-background min-h-24 p-2 transition-colors
                            ${day.isToday ? 'bg-primary/5 border-primary' : ''}
                            ${!day.isThisMonth ? 'text-muted-foreground' : ''}
                            ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}
                            hover:bg-accent/50 cursor-pointer
                          `}
                          onClick={() => setSelectedDate(day.date)}
                        >
                          <div className="text-sm font-medium mb-1">
                            {day.date.getDate()}
                          </div>
                          
                          <div className="space-y-1">
                            {day.content.map((content, index) => (
                              <Draggable
                                key={content.id}
                                draggableId={content.id}
                                index={index}
                              >
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`
                                      text-xs p-1 rounded text-white truncate cursor-move
                                      ${CONTENT_TYPES.find(t => t.value === content.type)?.color || 'bg-gray-500'}
                                    `}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedContent(content)
                                    }}
                                  >
                                    {content.title}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </div>
                          
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </DragDropContext>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="h-4 w-4 mr-2" />
                AI Suggestions
              </CardTitle>
              <CardDescription>Optimize your content strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiSuggestions.map(suggestion => (
                <div key={suggestion.id} className="p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.type}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.confidence}% confident
                    </div>
                  </div>
                  <h4 className="text-sm font-medium mb-1">{suggestion.title}</h4>
                  <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                  <p className="text-xs text-blue-600 mt-1">{suggestion.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Platform Status */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PLATFORMS.map(platform => {
                const Icon = platform.icon
                return (
                  <div key={platform.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" style={{ color: platform.color }} />
                      <span className="text-sm">{platform.name}</span>
                    </div>
                    <Badge variant={platform.connected ? "default" : "secondary"}>
                      {platform.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                )
              })}
              <Button variant="outline" size="sm" className="w-full mt-2">
                <Settings className="h-4 w-4 mr-2" />
                Manage Platforms
              </Button>
            </CardContent>
          </Card>

          {/* Optimal Posting Times */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Optimal Times
              </CardTitle>
              <CardDescription>Best times to post for engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {optimalTimes.slice(0, 3).map(time => (
                  <div key={time.