```tsx
"use client";

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Target, 
  Info,
  Zap,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRevenueForecasting } from '@/hooks/useRevenueForecasting';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface RevenueDataPoint {
  date: string;
  actual?: number;
  predicted: number;
  confidence_lower: number;
  confidence_upper: number;
  seasonal_factor: number;
  trend_factor: number;
}

interface ForecastMetrics {
  current_revenue: number;
  predicted_next_month: number;
  growth_rate: number;
  confidence_score: number;
  seasonal_impact: number;
  trend_strength: 'strong_up' | 'moderate_up' | 'stable' | 'moderate_down' | 'strong_down';
}

interface RevenueForecastingWidgetProps {
  creatorId?: string;
  className?: string;
  timeframe?: '30d' | '90d' | '180d' | '365d';
  showConfidenceInterval?: boolean;
  showSeasonality?: boolean;
  onForecastUpdate?: (metrics: ForecastMetrics) => void;
}

type TimeframeOption = {
  value: '30d' | '90d' | '180d' | '365d';
  label: string;
  days: number;
};

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { value: '30d', label: '30 Days', days: 30 },
  { value: '90d', label: '90 Days', days: 90 },
  { value: '180d', label: '6 Months', days: 180 },
  { value: '365d', label: '1 Year', days: 365 },
];

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, change, icon, description, trend }) => {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(val);
    }
    return val;
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up': return 'text-green-600 dark:text-green-400';
      case 'down': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3" />;
      case 'down': return <TrendingDown className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{title}</span>
            {description && (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{description}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          {change !== undefined && (
            <div className={cn("flex items-center space-x-1 text-sm", getTrendColor(trend))}>
              {getTrendIcon(trend)}
              <span>{Math.abs(change).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const TrendIndicator: React.FC<{
  strength: ForecastMetrics['trend_strength'];
  className?: string;
}> = ({ strength, className }) => {
  const getTrendConfig = (strength: ForecastMetrics['trend_strength']) => {
    switch (strength) {
      case 'strong_up':
        return { color: 'bg-green-500', label: 'Strong Growth', icon: TrendingUp };
      case 'moderate_up':
        return { color: 'bg-green-400', label: 'Moderate Growth', icon: TrendingUp };
      case 'stable':
        return { color: 'bg-gray-400', label: 'Stable', icon: BarChart3 };
      case 'moderate_down':
        return { color: 'bg-red-400', label: 'Moderate Decline', icon: TrendingDown };
      case 'strong_down':
        return { color: 'bg-red-500', label: 'Strong Decline', icon: TrendingDown };
    }
  };

  const config = getTrendConfig(strength);
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className={cn("h-2 w-2 rounded-full", config.color)} />
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
};

const PredictionTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-sm font-medium">{format(new Date(label || ''), 'MMM dd, yyyy')}</p>
      <div className="mt-2 space-y-1">
        {data.actual && (
          <div className="flex items-center justify-between space-x-4">
            <span className="text-sm text-muted-foreground">Actual:</span>
            <span className="text-sm font-medium">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.actual)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between space-x-4">
          <span className="text-sm text-muted-foreground">Predicted:</span>
          <span className="text-sm font-medium">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.predicted)}
          </span>
        </div>
        <div className="flex items-center justify-between space-x-4 text-xs text-muted-foreground">
          <span>Range:</span>
          <span>
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(data.confidence_lower)}
            {' - '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(data.confidence_upper)}
          </span>
        </div>
      </div>
    </div>
  );
};

const ForecastChart: React.FC<{
  data: RevenueDataPoint[];
  showConfidenceInterval: boolean;
  showSeasonality: boolean;
}> = ({ data, showConfidenceInterval, showSeasonality }) => {
  const splitIndex = data.findIndex(point => !point.actual);
  const historicalData = data.slice(0, splitIndex);
  const forecastData = data.slice(splitIndex - 1);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tickFormatter={(value) => format(new Date(value), 'MMM dd')}
          className="text-muted-foreground"
        />
        <YAxis 
          tickFormatter={(value) => 
            new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              notation: 'compact'
            }).format(value)
          }
          className="text-muted-foreground"
        />
        <Tooltip content={<PredictionTooltip />} />
        
        {showConfidenceInterval && (
          <Area
            dataKey="confidence_upper"
            stroke="none"
            fill="hsl(var(--primary))"
            fillOpacity={0.1}
            stackId="confidence"
          />
        )}
        
        {showConfidenceInterval && (
          <Area
            dataKey="confidence_lower"
            stroke="none"
            fill="hsl(var(--background))"
            fillOpacity={1}
            stackId="confidence"
          />
        )}

        <Line
          dataKey="actual"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
          connectNulls={false}
        />

        <Line
          dataKey="predicted"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
        />

        {showSeasonality && (
          <Line
            dataKey="seasonal_factor"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeOpacity={0.6}
            dot={false}
            yAxisId="seasonal"
          />
        )}

        <ReferenceLine 
          x={data[splitIndex - 1]?.date} 
          stroke="hsl(var(--border))" 
          strokeDasharray="2 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const RevenueForecastingWidget: React.FC<RevenueForecastingWidgetProps> = ({
  creatorId,
  className,
  timeframe = '90d',
  showConfidenceInterval = true,
  showSeasonality = false,
  onForecastUpdate,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption['value']>(timeframe);
  const [confidenceVisible, setConfidenceVisible] = useState(showConfidenceInterval);
  const [seasonalityVisible, setSeasonalityVisible] = useState(showSeasonality);

  const { 
    forecastData, 
    metrics, 
    isLoading, 
    error,
    refreshForecast 
  } = useRevenueForecasting({
    creatorId,
    timeframe: selectedTimeframe,
    includeConfidenceInterval: confidenceVisible,
    includeSeasonality: seasonalityVisible,
  });

  React.useEffect(() => {
    if (metrics && onForecastUpdate) {
      onForecastUpdate(metrics);
    }
  }, [metrics, onForecastUpdate]);

  const selectedOption = TIMEFRAME_OPTIONS.find(option => option.value === selectedTimeframe);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load revenue forecast</p>
            <Button variant="outline" size="sm" onClick={refreshForecast} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Revenue Forecasting</span>
            </CardTitle>
            <CardDescription>
              AI-powered revenue predictions based on trends and engagement patterns
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedTimeframe} onValueChange={(value: TimeframeOption['value']) => setSelectedTimeframe(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfidenceVisible(!confidenceVisible)}
              className={cn(confidenceVisible && "bg-primary/10")}
            >
              Confidence
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeasonalityVisible(!seasonalityVisible)}
              className={cn(seasonalityVisible && "bg-primary/10")}
            >
              Seasonality
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[400px] w-full" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <ForecastChart
                data={forecastData}
                showConfidenceInterval={confidenceVisible}
                showSeasonality={seasonalityVisible}
              />
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Current Revenue"
                  value={metrics?.current_revenue || 0}
                  icon={<DollarSign className="h-4 w-4" />}
                  description="Revenue from the last 30 days"
                />
                <MetricCard
                  title="Next Month Prediction"
                  value={metrics?.predicted_next_month || 0}
                  change={metrics?.growth_rate}
                  trend={
                    (metrics?.growth_rate || 0) > 5 ? 'up' :
                    (metrics?.growth_rate || 0) < -5 ? 'down' : 'stable'
                  }
                  icon={<Target className="h-4 w-4" />}
                  description="AI-predicted revenue for next month"
                />
                <MetricCard
                  title="Confidence Score"
                  value={`${((metrics?.confidence_score || 0) * 100).toFixed(0)}%`}
                  icon={<BarChart3 className="h-4 w-4" />}
                  description="Model prediction confidence"
                />
                <div className="flex flex-col space-y-2">
                  <div className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Trend Analysis</span>
                  </div>
                  {metrics && (
                    <TrendIndicator strength={metrics.trend_strength} />
                  )}
                  {metrics?.seasonal_impact && (
                    <Badge variant="outline" className="w-fit">
                      Seasonal Impact: {(metrics.seasonal_impact * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueForecastingWidget;
```