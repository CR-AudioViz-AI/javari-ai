```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Heart,
  Target,
  Download,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

interface MetricData {
  date: string;
  value: number;
  previousValue?: number;
}

interface EarningsData extends MetricData {
  subscriptions: number;
  merchandise: number;
  sponsorships: number;
  tips: number;
}

interface AudienceData extends MetricData {
  followers: number;
  subscribers: number;
  views: number;
  reach: number;
}

interface EngagementData extends MetricData {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
}

interface ConversionData {
  stage: string;
  value: number;
  fill: string;
}

interface PerformanceMetrics {
  totalEarnings: number;
  earningsChange: number;
  totalAudience: number;
  audienceChange: number;
  avgEngagementRate: number;
  engagementChange: number;
  conversionRate: number;
  conversionChange: number;
  earningsData: EarningsData[];
  audienceData: AudienceData[];
  engagementData: EngagementData[];
  conversionFunnel: ConversionData[];
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface CreatorPerformanceMetricsWidgetProps {
  creatorId?: string;
  className?: string;
  onExportData?: () => void;
  refreshInterval?: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  format?: 'currency' | 'number' | 'percentage';
  loading?: boolean;
}

interface TrendIndicatorProps {
  value: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  disabled?: boolean;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: number) => string;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  value,
  showIcon = true,
  size = 'md',
}) => {
  const isPositive = value >= 0;
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };
  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <div
      className={`flex items-center gap-1 ${
        isPositive ? 'text-green-600' : 'text-red-600'
      } ${sizeClasses[size]}`}
    >
      {showIcon && (
        <>
          {isPositive ? (
            <TrendingUp size={iconSizes[size]} aria-hidden="true" />
          ) : (
            <TrendingDown size={iconSizes[size]} aria-hidden="true" />
          )}
        </>
      )}
      <span>
        {isPositive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
      <span className="sr-only">
        {isPositive ? 'increased' : 'decreased'} by {Math.abs(value).toFixed(1)} percent
      </span>
    </div>
  );
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  format = 'number',
  loading = false,
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="h-4 w-4 text-muted-foreground" aria-hidden="true">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              formatValue(value)
            )}
          </div>
          <div className="flex items-center pt-1">
            {loading ? (
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <TrendIndicator value={change} size="sm" />
            )}
            <p className="text-xs text-muted-foreground ml-2">from last period</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const timeRangeOptions = [
    { value: '7d' as const, label: 'Last 7 days' },
    { value: '30d' as const, label: 'Last 30 days' },
    { value: '90d' as const, label: 'Last 90 days' },
    { value: '1y' as const, label: 'Last year' },
  ];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[150px]">
        <SelectValue placeholder="Select time range" />
      </SelectTrigger>
      <SelectContent>
        {timeRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const CustomTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  formatter,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.dataKey}:</span>
            <span className="font-medium">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CreatorPerformanceMetricsWidget({
  creatorId,
  className,
  onExportData,
  refreshInterval = 300000, // 5 minutes
}: CreatorPerformanceMetricsWidgetProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Mock data generation - replace with actual API calls
  const generateMockData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const earningsData: EarningsData[] = [];
    const audienceData: AudienceData[] = [];
    const engagementData: EngagementData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'MMM dd');
      const baseEarnings = 1000 + Math.random() * 500;
      const baseAudience = 10000 + Math.random() * 2000;
      const baseEngagement = 3 + Math.random() * 2;

      earningsData.push({
        date,
        value: baseEarnings,
        subscriptions: baseEarnings * 0.4,
        merchandise: baseEarnings * 0.2,
        sponsorships: baseEarnings * 0.3,
        tips: baseEarnings * 0.1,
      });

      audienceData.push({
        date,
        value: baseAudience,
        followers: baseAudience * 0.8,
        subscribers: baseAudience * 0.6,
        views: baseAudience * 5,
        reach: baseAudience * 3,
      });

      engagementData.push({
        date,
        value: baseEngagement,
        likes: baseEngagement * 100,
        comments: baseEngagement * 20,
        shares: baseEngagement * 10,
        saves: baseEngagement * 5,
        engagementRate: baseEngagement,
      });
    }

    const conversionFunnel: ConversionData[] = [
      { stage: 'Visitors', value: 10000, fill: '#8884d8' },
      { stage: 'Interested', value: 5000, fill: '#83a6ed' },
      { stage: 'Leads', value: 2000, fill: '#8dd1e1' },
      { stage: 'Customers', value: 500, fill: '#82ca9d' },
    ];

    return {
      totalEarnings: earningsData.reduce((sum, item) => sum + item.value, 0),
      earningsChange: 12.5,
      totalAudience: audienceData[audienceData.length - 1]?.value || 0,
      audienceChange: 8.3,
      avgEngagementRate: engagementData.reduce((sum, item) => sum + item.value, 0) / engagementData.length,
      engagementChange: -2.1,
      conversionRate: 5.0,
      conversionChange: 15.7,
      earningsData,
      audienceData,
      engagementData,
      conversionFunnel,
    };
  }, [timeRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics(generateMockData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, generateMockData]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  const handleExport = () => {
    if (onExportData) {
      onExportData();
    } else {
      // Default export functionality
      const data = {
        metrics,
        timeRange,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-metrics-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!metrics) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Performance Metrics</h2>
          <div className="flex items-center gap-2">
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            <div className="h-10 w-10 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} role="region" aria-label="Creator Performance Metrics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Metrics</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            disabled={loading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={fetchMetrics}
            disabled={loading}
            aria-label="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={loading}
            aria-label="Export metrics data"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Earnings"
          value={metrics.totalEarnings}
          change={metrics.earningsChange}
          icon={<DollarSign className="h-4 w-4" />}
          format="currency"
          loading={loading}
        />
        <MetricCard
          title="Total Audience"
          value={metrics.totalAudience}
          change={metrics.audienceChange}
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <MetricCard
          title="Engagement Rate"
          value={metrics.avgEngagementRate}
          change={metrics.engagementChange}
          icon={<Heart className="h-4 w-4" />}
          format="percentage"
          loading={loading}
        />
        <MetricCard
          title="Conversion Rate"
          value={metrics.conversionRate}
          change={metrics.conversionChange}
          icon={<Target className="h-4 w-4" />}
          format="percentage"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Earnings Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Earnings Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.earningsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    content={<CustomTooltip formatter={(value) => `$${value}`} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="subscriptions"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                  />
                  <Area
                    type="monotone"
                    dataKey="sponsorships"
                    stackId="1"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                  />
                  <Area
                    type="monotone"
                    dataKey="merchandise"
                    stackId="1"
                    stroke="#ffc658"
                    fill="#ffc658"
                  />
                  <Area
                    type="monotone"
                    dataKey="tips"
                    stackId="1"
                    stroke="#ff7300"
                    fill="#ff7300"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Audience Growth Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Audience Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.audienceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(1)}K`} />
                  <Tooltip
                    content={<CustomTooltip formatter={(value) => value.toLocaleString()} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="subscribers"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Engagement Rate Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Engagement Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.engagementData.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="likes" fill="#8884d8" />
                  <Bar dataKey="comments" fill="#82ca9d" />
                  <Bar dataKey="shares" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conversion Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Conversion Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>