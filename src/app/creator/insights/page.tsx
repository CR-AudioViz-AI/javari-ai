'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Play,
  Eye,
  Heart,
  Share,
  Download,
  Calendar as CalendarIcon,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Clock,
  Star
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'

interface DateRange {
  from: Date
  to: Date
}

interface RevenueMetrics {
  totalRevenue: number
  monthlyGrowth: number
  averageRPM: number
  projectedRevenue: number
  revenueBySource: { source: string; amount: number; percentage: number }[]
}

interface AudienceMetrics {
  totalSubscribers: number
  subscriberGrowth: number
  avgViewDuration: number
  retentionRate: number
  demographics: { age: string; percentage: number }[]
  geoData: { country: string; percentage: number }[]
}

interface ContentMetrics {
  id: string
  title: string
  views: number
  engagement: number
  revenue: number
  publishedAt: string
  duration: number
  type: 'video' | 'audio' | 'playlist'
}

interface MonetizationRecommendation {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  category: 'content' | 'audience' | 'monetization' | 'optimization'
}

interface PerformanceData {
  date: string
  revenue: number
  views: number
  subscribers: number
  engagement: number
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1']

export default function CreatorInsightsPage() {
  const { toast } = useToast()
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d')
  const [isLoading, setIsLoading] = useState(true)
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null)
  const [audienceMetrics, setAudienceMetrics] = useState<AudienceMetrics | null>(null)
  const [contentMetrics, setContentMetrics] = useState<ContentMetrics[]>([])
  const [recommendations, setRecommendations] = useState<MonetizationRecommendation[]>([])
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])

  useEffect(() => {
    fetchAnalyticsData()
  }, [dateRange, selectedPeriod])

  const fetchAnalyticsData = async () => {
    setIsLoading(true)
    try {
      // Simulate API calls - replace with actual Supabase queries
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setRevenueMetrics({
        totalRevenue: 12450.75,
        monthlyGrowth: 18.5,
        averageRPM: 2.34,
        projectedRevenue: 15600,
        revenueBySource: [
          { source: 'Ad Revenue', amount: 8500, percentage: 68 },
          { source: 'Sponsorships', amount: 2800, percentage: 23 },
          { source: 'Merchandise', amount: 750, percentage: 6 },
          { source: 'Donations', amount: 400, percentage: 3 }
        ]
      })

      setAudienceMetrics({
        totalSubscribers: 45680,
        subscriberGrowth: 12.3,
        avgViewDuration: 4.2,
        retentionRate: 78.5,
        demographics: [
          { age: '18-24', percentage: 35 },
          { age: '25-34', percentage: 40 },
          { age: '35-44', percentage: 20 },
          { age: '45+', percentage: 5 }
        ],
        geoData: [
          { country: 'United States', percentage: 45 },
          { country: 'United Kingdom', percentage: 18 },
          { country: 'Canada', percentage: 12 },
          { country: 'Australia', percentage: 8 },
          { country: 'Others', percentage: 17 }
        ]
      })

      setContentMetrics([
        {
          id: '1',
          title: 'Top 10 Ambient Tracks for Focus',
          views: 45600,
          engagement: 8.7,
          revenue: 234.50,
          publishedAt: '2024-01-15',
          duration: 3600,
          type: 'playlist'
        },
        {
          id: '2', 
          title: 'Meditation Soundscape - Ocean Waves',
          views: 32400,
          engagement: 9.2,
          revenue: 189.30,
          publishedAt: '2024-01-20',
          duration: 2400,
          type: 'audio'
        },
        {
          id: '3',
          title: 'Behind the Scenes: Studio Setup',
          views: 28900,
          engagement: 7.8,
          revenue: 156.80,
          publishedAt: '2024-01-25',
          duration: 480,
          type: 'video'
        }
      ])

      setRecommendations([
        {
          id: '1',
          title: 'Optimize Upload Schedule',
          description: 'Data shows 23% higher engagement when posting on Tuesday-Thursday between 2-4 PM',
          impact: 'high',
          effort: 'low',
          category: 'optimization'
        },
        {
          id: '2',
          title: 'Create Extended Playlist Series',
          description: 'Playlists generate 40% more revenue per view than individual tracks',
          impact: 'high',
          effort: 'medium',
          category: 'content'
        },
        {
          id: '3',
          title: 'Target 25-34 Demographic',
          description: 'This age group shows highest engagement but lowest reach in your content',
          impact: 'medium',
          effort: 'medium',
          category: 'audience'
        }
      ])

      setPerformanceData([
        { date: '2024-01-01', revenue: 380, views: 12400, subscribers: 42100, engagement: 7.2 },
        { date: '2024-01-08', revenue: 420, views: 13200, subscribers: 42800, engagement: 7.8 },
        { date: '2024-01-15', revenue: 390, views: 11900, subscribers: 43500, engagement: 8.1 },
        { date: '2024-01-22', revenue: 450, views: 14600, subscribers: 44200, engagement: 8.4 },
        { date: '2024-01-29', revenue: 480, views: 15800, subscribers: 45680, engagement: 8.7 }
      ])

    } catch (error) {
      toast({
        title: 'Error loading analytics',
        description: 'Failed to fetch performance data. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportData = async () => {
    try {
      toast({
        title: 'Exporting data...',
        description: 'Preparing your analytics report'
      })
      
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast({
        title: 'Export completed',
        description: 'Analytics report has been downloaded'
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Unable to export data. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Creator Insights</h1>
              <p className="text-muted-foreground">Loading your performance analytics...</p>
            </div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-4 w-4 bg-muted rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-32 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Creator Insights</h1>
            <p className="text-muted-foreground">
              Track your performance and grow your audience
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 3 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={(range) => range && setDateRange(range as DateRange)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            
            <Button onClick={handleExportData} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Revenue Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueMetrics && formatCurrency(revenueMetrics.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="inline-flex items-center text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{revenueMetrics?.monthlyGrowth}%
                </span>
                {' '}from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {audienceMetrics && formatNumber(audienceMetrics.totalSubscribers)}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="inline-flex items-center text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{audienceMetrics?.subscriberGrowth}%
                </span>
                {' '}growth rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. View Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {audienceMetrics?.avgViewDuration}m
              </div>
              <p className="text-xs text-muted-foreground">
                {audienceMetrics?.retentionRate}% retention rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue RPM</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueMetrics && formatCurrency(revenueMetrics.averageRPM)}
              </div>
              <p className="text-xs text-muted-foreground">
                Revenue per mille views
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="recommendations">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Performance Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>
                  Track your key metrics over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'MMM dd')} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return [formatCurrency(value), 'Revenue']
                        if (name === 'views') return [formatNumber(value), 'Views']
                        if (name === 'subscribers') return [formatNumber(value), 'Subscribers']
                        return [value.toFixed(1), 'Engagement Rate']
                      }}
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="revenue" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                    <Area yAxisId="right" type="monotone" dataKey="views" stackId="2" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueMetrics?.revenueBySource.map((source, index) => (
                      <div key={source.source} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{source.source}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(source.amount)}</div>
                          <div className="text-xs text-muted-foreground">{source.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contentMetrics.slice(0, 3).map((content) => (
                      <div key={content.id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{content.title}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {formatNumber(content.views)}
                            </span>
                            <span>{content.engagement}% engagement</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(content.revenue)}</div>
                          <Badge variant={content.type === 'playlist' ? 'default' : 'secondary'}>
                            {content.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={revenueMetrics?.revenueBySource}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="amount"
                        nameKey="source"
                        label={({ name, percentage