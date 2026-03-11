```tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Download, 
  Settings, 
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  EyeOff,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Target,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

interface RevenueData {
  date: string;
  total: number;
  subscriptions: number;
  oneTime: number;
  commissions: number;
  sponsored: number;
}

interface ForecastData extends RevenueData {
  predicted: boolean;
  confidence: number;
}

interface RevenueStream {
  id: string;
  name: string;
  value: number;
  change: number;
  color: string;
  icon: React.ReactNode;
}

interface TimeRange {
  label: string;
  value: string;
  days: number;
}

interface LayoutConfig {
  showForecasting: boolean;
  showComparisons: boolean;
  chartType: 'line' | 'area' | 'bar';
  compactMode: boolean;
  realtimeUpdates: boolean;
}

interface RevenueVisualizationDashboardProps {
  userId?: string;
  initialData?: RevenueData[];
  onExport?: (data: RevenueData[], format: 'csv' | 'json') => void;
  className?: string;
}

const timeRanges: TimeRange[] = [
  { label: '7 Days', value: '7d', days: 7 },
  { label: '30 Days', value: '30d', days: 30 },
  { label: '90 Days', value: '90d', days: 90 },
  { label: '1 Year', value: '1y', days: 365 }
];

const chartColors = {
  total: '#8b5cf6',
  subscriptions: '#06b6d4',
  oneTime: '#10b981',
  commissions: '#f59e0b',
  sponsored: '#ef4444'
};

const generateMockData = (days: number): RevenueData[] => {
  const endDate = new Date();
  const startDate = subDays(endDate, days - 1);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  
  return dateRange.map((date, index) => {
    const baseRevenue = 1000 + Math.sin(index / 7) * 500 + Math.random() * 300;
    return {
      date: format(date, 'yyyy-MM-dd'),
      total: Math.round(baseRevenue),
      subscriptions: Math.round(baseRevenue * 0.6),
      oneTime: Math.round(baseRevenue * 0.2),
      commissions: Math.round(baseRevenue * 0.15),
      sponsored: Math.round(baseRevenue * 0.05)
    };
  });
};

const generateForecast = (historicalData: RevenueData[], days: number = 30): ForecastData[] => {
  const lastValue = historicalData[historicalData.length - 1]?.total || 0;
  const trend = historicalData.length > 1 
    ? (historicalData[historicalData.length - 1].total - historicalData[0].total) / historicalData.length
    : 0;
  
  const forecast: ForecastData[] = [];
  const lastDate = new Date(historicalData[historicalData.length - 1]?.date || new Date());
  
  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(forecastDate.getDate() + i);
    
    const predictedValue = lastValue + (trend * i) + (Math.random() - 0.5) * 200;
    const confidence = Math.max(0.1, 1 - (i / days) * 0.8);
    
    forecast.push({
      date: format(forecastDate, 'yyyy-MM-dd'),
      total: Math.round(Math.max(0, predictedValue)),
      subscriptions: Math.round(predictedValue * 0.6),
      oneTime: Math.round(predictedValue * 0.2),
      commissions: Math.round(predictedValue * 0.15),
      sponsored: Math.round(predictedValue * 0.05),
      predicted: true,
      confidence
    });
  }
  
  return forecast;
};

const RevenueMetricsCard: React.FC<{ 
  title: string; 
  value: number; 
  change: number; 
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">${value.toLocaleString()}</p>
            </div>
            <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: color }}>
              {icon}
            </div>
          </div>
          <div className="flex items-center mt-4">
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground ml-1">vs last period</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const RealtimeRevenueChart: React.FC<{
  data: (RevenueData | ForecastData)[];
  layoutConfig: LayoutConfig;
  onConfigChange: (config: Partial<LayoutConfig>) => void;
}> = ({ data, layoutConfig, onConfigChange }) => {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MMM dd')
    }));
  }, [data]);

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (layoutConfig.chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="total"
              stroke={chartColors.total}
              fill={chartColors.total}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="subscriptions"
              stroke={chartColors.subscriptions}
              fill={chartColors.subscriptions}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend />
            <Bar dataKey="total" fill={chartColors.total} />
          </BarChart>
        );
      
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="total"
              stroke={chartColors.total}
              strokeWidth={2}
              dot={{ fill: chartColors.total, strokeWidth: 2, r: 4 }}
            />
            {data.some(item => 'predicted' in item) && (
              <Line
                type="monotone"
                dataKey="total"
                stroke={chartColors.total}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Revenue Analytics
            {layoutConfig.realtimeUpdates && (
              <Badge variant="secondary" className="animate-pulse">
                <Zap className="w-3 h-3 mr-1" />
                Live
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={layoutConfig.chartType}
              onValueChange={(value: 'line' | 'area' | 'bar') => 
                onConfigChange({ chartType: value })
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="area">Area Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const RevenueStreamBreakdown: React.FC<{
  data: RevenueData[];
  compact?: boolean;
}> = ({ data, compact = false }) => {
  const latestData = data[data.length - 1] || {
    subscriptions: 0,
    oneTime: 0,
    commissions: 0,
    sponsored: 0
  };

  const pieData = [
    { name: 'Subscriptions', value: latestData.subscriptions, color: chartColors.subscriptions },
    { name: 'One-time', value: latestData.oneTime, color: chartColors.oneTime },
    { name: 'Commissions', value: latestData.commissions, color: chartColors.commissions },
    { name: 'Sponsored', value: latestData.sponsored, color: chartColors.sponsored }
  ].filter(item => item.value > 0);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pieData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.name}</span>
              </div>
              <span className="text-sm font-medium">${item.value.toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5" />
          Revenue Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const RevenueForecastingPanel: React.FC<{
  historicalData: RevenueData[];
  forecastData: ForecastData[];
}> = ({ historicalData, forecastData }) => {
  const totalForecast = forecastData.reduce((sum, item) => sum + item.total, 0);
  const avgConfidence = forecastData.reduce((sum, item) => sum + item.confidence, 0) / forecastData.length;
  
  const combinedData = [
    ...historicalData.slice(-30).map(item => ({ ...item, type: 'historical' })),
    ...forecastData.map(item => ({ ...item, type: 'forecast' }))
  ].map(item => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd')
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          30-Day Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Projected Revenue</p>
              <p className="text-2xl font-bold">${totalForecast.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{(avgConfidence * 100).toFixed(0)}%</p>
                <Badge variant={avgConfidence > 0.7 ? 'default' : avgConfidence > 0.4 ? 'secondary' : 'destructive'}>
                  {avgConfidence > 0.7 ? 'High' : avgConfidence > 0.4 ? 'Medium' : 'Low'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `$${value.toLocaleString()}`,
                    props.payload.type === 'forecast' ? 'Forecast' : 'Actual'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={chartColors.total}
                  strokeWidth={2}
                  strokeDasharray={(entry: any) => entry.type === 'forecast' ? '5 5' : '0'}
                  dot={{ fill: chartColors.total, strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const RevenueVisualizationDashboard: React.FC<RevenueVisualizationDashboardProps> = ({
  userId,
  initialData,
  onExport,
  className = ''
}) => {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    showForecasting: true,
    showComparisons: true,
    chartType: 'line',
    compactMode: false,
    realtimeUpdates: true
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedTimeRange = timeRanges.find(range => range.value === timeRange) || timeRanges[1];

  useEffect(() => {
    setIsLoading(true);
    // Simulate data loading
    setTimeout(() => {
      const mockData = initialData || generateMockData(selectedTimeRange.days);
      setRevenueData(mockData);
      
      if (layoutConfig.showForecasting) {
        setForecastData(generateForecast(mockData));
      }
      
      setIsLoading(false);
    }, 1000);
  }, [timeRange, initialData, selectedTimeRange.days, layoutConfig.showForecasting]);

  const handleConfigChange = (config: Partial<LayoutConfig>) => {
    setLayoutConfig(prev => ({ ...prev, ...config }));
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (onExport) {
      onExport(revenueData, format);
    }
  };

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.total, 0);
  const avgRevenue = totalRevenue / revenueData.length || 0;
  const revenueChange = revenueData.length > 1 
    ? ((revenueData[revenueData.length - 1]?.total - revenueData[0]?.total) / revenueData[0]?.total) * 100 
    : 0;

  const revenueStreams: RevenueStream[] = [
    {
      id: 'total',
      name: 'Total Revenue',
      value: totalRevenue,
      change: revenueChange,
      color: chartColors.total,
      icon: <DollarSign className="w-5 h-5" />
    },
    {
      id: 'subscriptions',
      name: 'Subscriptions',
      value: revenueData.reduce((sum, item) => sum + item.subscriptions, 0),
      change: revenueChange * 0.8,
      color: chartColors.subscriptions,
      icon: <RefreshCw className="w-5 h-5" />
    },
    {
      id: 'oneTime',
      name: 'One-time Sales',
      value: revenueData.reduce((sum, item) => sum + item.oneTime, 0),
      change: revenueChange * 1.2,
      color: chartColors.oneTime,
      icon: <Zap className="w-5