```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Heart,
  Activity,
  Download,
  RefreshCw,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Zap
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommunityMetric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'number' | 'percentage' | 'currency';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  target?: number;
}

interface EngagementData {
  date: string;
  posts: number;
  comments: number;
  likes: number;
  shares: number;
  activeUsers: number;
}

interface GrowthData {
  date: string;
  newMembers: number;
  totalMembers: number;
  retention: number;
  churnRate: number;
}

interface HealthIndicator {
  id: string;
  name: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  description: string;
}

interface TopContributor {
  id: string;
  name: string;
  avatar: string;
  posts: number;
  engagement: number;
  reputation: number;
  badge: string;
}

interface ActivityPattern {
  hour: number;
  day: number;
  intensity: number;
}

interface ActionableInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'success';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
  priority: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

interface CommunityHealthDashboardProps {
  className?: string;
  communityId?: string;
  refreshInterval?: number;
  onMetricClick?: (metric: CommunityMetric) => void;
  onInsightAction?: (insight: ActionableInsight) => void;
  onExport?: (format: 'pdf' | 'csv') => void;
}

const CommunityHealthDashboard: React.FC<CommunityHealthDashboardProps> = ({
  className,
  communityId = 'default',
  refreshInterval = 300000, // 5 minutes
  onMetricClick,
  onInsightAction,
  onExport
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  // Mock data - replace with actual API calls
  const [metrics, setMetrics] = useState<CommunityMetric[]>([
    {
      id: 'total-members',
      name: 'Total Members',
      value: 12847,
      previousValue: 12156,
      change: 5.7,
      changeType: 'increase',
      format: 'number',
      icon: Users,
      color: 'hsl(var(--primary))',
      target: 15000
    },
    {
      id: 'active-members',
      name: 'Active Members (30d)',
      value: 8934,
      previousValue: 9234,
      change: -3.2,
      changeType: 'decrease',
      format: 'number',
      icon: Activity,
      color: 'hsl(var(--success))',
      target: 10000
    },
    {
      id: 'engagement-rate',
      name: 'Engagement Rate',
      value: 68.5,
      previousValue: 65.2,
      change: 5.1,
      changeType: 'increase',
      format: 'percentage',
      icon: Heart,
      color: 'hsl(var(--warning))',
      target: 75
    },
    {
      id: 'posts-per-day',
      name: 'Posts per Day',
      value: 234,
      previousValue: 198,
      change: 18.2,
      changeType: 'increase',
      format: 'number',
      icon: MessageSquare,
      color: 'hsl(var(--info))'
    }
  ]);

  const [engagementData, setEngagementData] = useState<EngagementData[]>([
    { date: '2024-01-01', posts: 45, comments: 123, likes: 567, shares: 23, activeUsers: 890 },
    { date: '2024-01-02', posts: 52, comments: 156, likes: 634, shares: 31, activeUsers: 945 },
    { date: '2024-01-03', posts: 48, comments: 134, likes: 598, shares: 27, activeUsers: 912 },
    { date: '2024-01-04', posts: 61, comments: 189, likes: 723, shares: 42, activeUsers: 1034 },
    { date: '2024-01-05', posts: 55, comments: 167, likes: 678, shares: 36, activeUsers: 987 }
  ]);

  const [healthIndicators, setHealthIndicators] = useState<HealthIndicator[]>([
    {
      id: 'community-health',
      name: 'Overall Health',
      value: 85,
      threshold: 70,
      status: 'healthy',
      description: 'Community is thriving with good engagement'
    },
    {
      id: 'moderation-load',
      name: 'Moderation Load',
      value: 45,
      threshold: 60,
      status: 'healthy',
      description: 'Moderation workload is manageable'
    },
    {
      id: 'response-time',
      name: 'Response Time',
      value: 78,
      threshold: 80,
      status: 'warning',
      description: 'Response times are slightly elevated'
    }
  ]);

  const [topContributors, setTopContributors] = useState<TopContributor[]>([
    {
      id: '1',
      name: 'Sarah Johnson',
      avatar: '/avatars/sarah.jpg',
      posts: 145,
      engagement: 92.5,
      reputation: 4850,
      badge: 'Community Champion'
    },
    {
      id: '2',
      name: 'Mike Chen',
      avatar: '/avatars/mike.jpg',
      posts: 128,
      engagement: 87.3,
      reputation: 4200,
      badge: 'Expert Contributor'
    },
    {
      id: '3',
      name: 'Emily Davis',
      avatar: '/avatars/emily.jpg',
      posts: 112,
      engagement: 89.1,
      reputation: 3950,
      badge: 'Helpful Member'
    }
  ]);

  const [insights, setInsights] = useState<ActionableInsight[]>([
    {
      id: '1',
      type: 'opportunity',
      title: 'Engagement Peak Opportunity',
      description: 'User activity peaks at 2-4 PM. Consider scheduling important announcements during this window.',
      impact: 'high',
      action: 'Schedule Content',
      priority: 1
    },
    {
      id: '2',
      type: 'warning',
      title: 'Declining Weekend Activity',
      description: 'Weekend engagement has dropped 15% over the past month. Consider weekend-specific content.',
      impact: 'medium',
      action: 'Plan Weekend Events',
      priority: 2
    },
    {
      id: '3',
      type: 'success',
      title: 'New Member Integration Success',
      description: 'New member retention has improved by 23% with the welcome program.',
      impact: 'high',
      action: 'Expand Program',
      priority: 3
    }
  ]);

  const generateActivityHeatmap = useCallback((): ActivityPattern[] => {
    const patterns: ActivityPattern[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        patterns.push({
          day,
          hour,
          intensity: Math.random() * 100
        });
      }
    }
    return patterns;
  }, []);

  const [activityPatterns, setActivityPatterns] = useState<ActivityPattern[]>([]);

  useEffect(() => {
    setActivityPatterns(generateActivityHeatmap());
  }, [generateActivityHeatmap]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshData, refreshInterval]);

  const formatValue = (value: number, format: CommunityMetric['format']) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  };

  const getStatusColor = (status: HealthIndicator['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getInsightIcon = (type: ActionableInsight['type']) => {
    switch (type) {
      case 'opportunity':
        return Target;
      case 'warning':
        return AlertTriangle;
      case 'success':
        return CheckCircle;
      default:
        return Activity;
    }
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    onExport?.(format);
  };

  if (isLoading && metrics.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Community Health Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor engagement, growth, and community vitals in real-time
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{
                  from: dateRange.from,
                  to: dateRange.to
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedSegment} onValueChange={setSelectedSegment}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="new">New Members</SelectItem>
              <SelectItem value="active">Active Members</SelectItem>
              <SelectItem value="inactive">Inactive Members</SelectItem>
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        Last updated: {format(lastUpdated, 'PPp')}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const IconComponent = metric.icon;
          const isPositiveChange = metric.changeType === 'increase';
          const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

          return (
            <Card
              key={metric.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => onMetricClick?.(metric)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.name}
                </CardTitle>
                <IconComponent
                  className="h-4 w-4"
                  style={{ color: metric.color }}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatValue(metric.value, metric.format)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendIcon
                    className={cn(
                      'h-3 w-3',
                      isPositiveChange ? 'text-green-600' : 'text-red-600'
                    )}
                  />
                  <span
                    className={cn(
                      isPositiveChange ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {Math.abs(metric.change).toFixed(1)}%
                  </span>
                  <span>from last period</span>
                </div>
                {metric.target && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress to target</span>
                      <span>{((metric.value / metric.target) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={(metric.value / metric.target) * 100}
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Engagement Trends */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Engagement Trends
            </CardTitle>
            <CardDescription>
              Daily engagement metrics over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'PPP')}
                />
                <Line
                  type="monotone"
                  dataKey="posts"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Posts"
                />
                <Line
                  type="monotone"
                  dataKey="comments"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  name="Comments"
                />
                <Line
                  type="monotone"
                  dataKey="likes"
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  name="Likes"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Health Indicators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Health Indicators
            </CardTitle>
            <CardDescription>
              Key community health metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthIndicators.map((indicator) => (
              <div key={indicator.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{indicator.name}</span>
                  <Badge
                    variant={indicator.status === 'healthy' ? 'default' : 
                            indicator.status === 'warning' ? 'secondary' : 'destructive'}
                  >
                    {indicator.value}%
                  </Badge>
                </div>
                <Progress
                  value={indicator.value}
                  className="h-2"
                />
                <p className={cn(
                  'text-xs',
                  getStatusColor(indicator.status)
                )}>
                  {indicator.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Contributors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Contributors
            </CardTitle>
            <CardDescription>
              Most active community members this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topContributors.map((contributor, index) => (
                <div key={contributor.id} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contributor.avatar} alt={contributor.name} />
                    <AvatarFallback>
                      {contributor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contributor.name}</span>
                      <Badge variant="outline" className="text-xs">