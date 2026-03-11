```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Gift,
  ShoppingBag,
  Briefcase,
  Download,
  Calendar,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

// Types
interface RevenueStream {
  id: string;
  name: string;
  type: 'subscriptions' | 'tips' | 'merchandise' | 'brand_partnerships';
  amount: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface RevenueData {
  date: string;
  subscriptions: number;
  tips: number;
  merchandise: number;
  brand_partnerships: number;
  total: number;
}

interface StreamMetrics {
  type: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface MultiStreamRevenueVisualizationProps {
  creatorId: string;
  currency?: string;
  refreshInterval?: number;
  onExport?: (data: RevenueData[], format: 'csv' | 'pdf') => void;
  className?: string;
}

const STREAM_COLORS = {
  subscriptions: '#8B5CF6',
  tips: '#10B981',
  merchandise: '#F59E0B',
  brand_partnerships: '#EF4444'
};

const STREAM_ICONS = {
  subscriptions: Users,
  tips: Gift,
  merchandise: ShoppingBag,
  brand_partnerships: Briefcase
};

const TIME_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 3 months' },
  { value: '1y', label: 'Last year' }
];

// Sub-components
const TrendIndicator: React.FC<{ 
  trend: 'up' | 'down' | 'stable';
  value: number;
  className?: string;
}> = ({ trend, value, className = '' }) => {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : TrendingUp;
  const colorClass = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500';
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Icon className={`h-4 w-4 ${colorClass}`} />
      <span className={`text-sm font-medium ${colorClass}`}>
        {Math.abs(value).toFixed(1)}%
      </span>
    </div>
  );
};

const RevenueStreamCard: React.FC<{
  type: string;
  metrics: StreamMetrics;
  currency: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
}> = ({ type, metrics, currency, isVisible, onToggleVisibility }) => {
  const Icon = STREAM_ICONS[type as keyof typeof STREAM_ICONS];
  const color = STREAM_COLORS[type as keyof typeof STREAM_COLORS];
  
  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium capitalize">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            {type.replace('_', ' ')}
          </div>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleVisibility}
          className="h-6 w-6 p-0"
          aria-label={`${isVisible ? 'Hide' : 'Show'} ${type} data`}
        >
          {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {currency}{metrics.current.toLocaleString()}
        </div>
        <div className="flex items-center justify-between mt-2">
          <TrendIndicator 
            trend={metrics.trend} 
            value={metrics.changePercent}
          />
          <Badge variant={metrics.trend === 'up' ? 'default' : 'secondary'}>
            {currency}{Math.abs(metrics.change).toLocaleString()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

const RevenueChart: React.FC<{
  data: RevenueData[];
  timeRange: string;
  visibleStreams: Set<string>;
  currency: string;
}> = ({ data, timeRange, visibleStreams, currency }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{format(new Date(label), 'MMM dd, yyyy')}</p>
          {payload.map((entry: any) => (
            visibleStreams.has(entry.dataKey) && (
              <p key={entry.dataKey} className="text-sm" style={{ color: entry.color }}>
                {entry.dataKey.replace('_', ' ')}: {currency}{entry.value.toLocaleString()}
              </p>
            )
          ))}
          <p className="text-sm font-medium mt-1 pt-1 border-t">
            Total: {currency}{payload.find((p: any) => p.dataKey === 'total')?.value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            className="text-xs"
          />
          <YAxis 
            tickFormatter={(value) => `${currency}${(value / 1000).toFixed(0)}k`}
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {Object.entries(STREAM_COLORS).map(([stream, color]) => (
            visibleStreams.has(stream) && (
              <Area
                key={stream}
                type="monotone"
                dataKey={stream}
                stackId="1"
                stroke={color}
                fill={color}
                fillOpacity={0.6}
                name={stream.replace('_', ' ')}
              />
            )
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const StreamBreakdown: React.FC<{
  data: RevenueData[];
  visibleStreams: Set<string>;
  currency: string;
}> = ({ data, visibleStreams, currency }) => {
  const pieData = useMemo(() => {
    const totals = Object.keys(STREAM_COLORS).reduce((acc, stream) => {
      acc[stream] = data.reduce((sum, day) => sum + (day as any)[stream], 0);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(totals)
      .filter(([stream]) => visibleStreams.has(stream) && totals[stream] > 0)
      .map(([stream, value]) => ({
        name: stream.replace('_', ' '),
        value,
        color: STREAM_COLORS[stream as keyof typeof STREAM_COLORS]
      }));
  }, [data, visibleStreams]);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Hide labels for slices less than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Revenue']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const RevenueMetrics: React.FC<{
  data: RevenueData[];
  currency: string;
}> = ({ data, currency }) => {
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const totalRevenue = data.reduce((sum, day) => sum + day.total, 0);
    const averageDaily = totalRevenue / data.length;
    const highestDay = Math.max(...data.map(d => d.total));
    const lowestDay = Math.min(...data.map(d => d.total));

    return {
      total: totalRevenue,
      average: averageDaily,
      highest: highestDay,
      lowest: lowestDay
    };
  }, [data]);

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-primary">
          {currency}{metrics.total.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">Total Revenue</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-primary">
          {currency}{Math.round(metrics.average).toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">Daily Average</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">
          {currency}{metrics.highest.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">Best Day</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-600">
          {currency}{metrics.lowest.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">Lowest Day</div>
      </div>
    </div>
  );
};

const TimeRangeSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <Calendar className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        {TIME_RANGES.map((range) => (
          <SelectItem key={range.value} value={range.value}>
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Main component
export const MultiStreamRevenueVisualization: React.FC<MultiStreamRevenueVisualizationProps> = ({
  creatorId,
  currency = '$',
  refreshInterval = 30000,
  onExport,
  className = ''
}) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [streamMetrics, setStreamMetrics] = useState<Record<string, StreamMetrics>>({});
  const [visibleStreams, setVisibleStreams] = useState(new Set(Object.keys(STREAM_COLORS)));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data generation for demo purposes
  const generateMockData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const data: RevenueData[] = [];
    
    for (let i = days; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const subscriptions = Math.floor(Math.random() * 2000) + 500;
      const tips = Math.floor(Math.random() * 800) + 100;
      const merchandise = Math.floor(Math.random() * 1200) + 200;
      const brand_partnerships = Math.floor(Math.random() * 3000) + 1000;
      
      data.push({
        date,
        subscriptions,
        tips,
        merchandise,
        brand_partnerships,
        total: subscriptions + tips + merchandise + brand_partnerships
      });
    }
    
    return data;
  }, [timeRange]);

  const generateMockMetrics = useMemo(() => {
    const metrics: Record<string, StreamMetrics> = {};
    
    Object.keys(STREAM_COLORS).forEach(stream => {
      const current = revenueData.reduce((sum, day) => sum + (day as any)[stream], 0);
      const previous = current * (0.8 + Math.random() * 0.4); // Mock previous period
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;
      
      metrics[stream] = {
        type: stream,
        current,
        previous,
        change,
        changePercent,
        trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable'
      };
    });
    
    return metrics;
  }, [revenueData]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRevenueData(generateMockData);
        setStreamMetrics(generateMockMetrics);
      } catch (err) {
        setError('Failed to load revenue data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [timeRange, generateMockData, generateMockMetrics]);

  // Auto refresh
  useEffect(() => {
    if (!refreshInterval) return;
    
    const interval = setInterval(() => {
      setRevenueData(generateMockData);
      setStreamMetrics(generateMockMetrics);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, generateMockData, generateMockMetrics]);

  const toggleStreamVisibility = (stream: string) => {
    const newVisible = new Set(visibleStreams);
    if (newVisible.has(stream)) {
      newVisible.delete(stream);
    } else {
      newVisible.add(stream);
    }
    setVisibleStreams(newVisible);
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    onExport?.(revenueData, format);
  };

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-500">
          <p>Error loading revenue data: {error}</p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} role="main" aria-label="Multi-stream revenue dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
          <p className="text-muted-foreground">Track your income across all monetization streams</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          {onExport && (
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('csv')}
                aria-label="Export data as CSV"
              >
                <Download className="mr-1 h-3 w-3" />
                CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExport('pdf')}
                aria-label="Export data as PDF"
              >
                <Download className="mr-1 h-3 w-3" />
                PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Stream Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(streamMetrics).map(([stream, metrics]) => (
          <RevenueStreamCard
            key={stream}
            type={stream}
            metrics={metrics}
            currency={currency}
            isVisible={visibleStreams.has(stream)}
            onToggleVisibility={() => toggleStreamVisibility(stream)}
          />
        ))}
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <RevenueChart
              data={revenueData}
              timeRange={timeRange}
              visibleStreams={visibleStreams}
              currency={currency}
            />
          )}
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <StreamBreakdown
                data={revenueData}
                visibleStreams={visibleStreams}
                currency={currency}
              />
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <RevenueMetrics data={revenueData} currency={currency} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MultiStreamRevenueVisualization;
```