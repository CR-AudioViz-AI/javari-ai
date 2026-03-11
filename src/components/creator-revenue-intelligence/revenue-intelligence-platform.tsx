'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

/**
 * Revenue data structure from different monetization channels
 */
interface RevenueData {
  id: string;
  creator_id: string;
  channel: string;
  platform: string;
  amount: number;
  currency: string;
  date: string;
  type: 'subscription' | 'donation' | 'merchandise' | 'sponsorship' | 'ad_revenue' | 'commission';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Monetization channel configuration
 */
interface MonetizationChannel {
  id: string;
  name: string;
  platform: string;
  type: string;
  status: 'active' | 'inactive' | 'pending';
  revenue_share: number;
  integration_status: 'connected' | 'disconnected' | 'error';
  last_sync: string;
  monthly_revenue: number;
  growth_rate: number;
}

/**
 * Market insight data
 */
interface MarketInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  impact_score: number;
  trend: 'up' | 'down' | 'stable';
  data: Record<string, any>;
  created_at: string;
}

/**
 * Competitive analysis data
 */
interface CompetitorData {
  id: string;
  name: string;
  platform: string;
  estimated_revenue: number;
  followers: number;
  engagement_rate: number;
  content_type: string;
  revenue_sources: string[];
  market_share: number;
}

/**
 * Revenue forecast data
 */
interface RevenueForecast {
  date: string;
  predicted_revenue: number;
  confidence_interval: [number, number];
  factors: string[];
}

/**
 * Optimization recommendation
 */
interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  potential_impact: number;
  effort_level: 'easy' | 'medium' | 'hard';
  implementation_time: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

/**
 * Dashboard configuration
 */
interface DashboardConfig {
  timeRange: '7d' | '30d' | '90d' | '1y' | 'all';
  currency: string;
  channels: string[];
  compareMode: boolean;
  autoRefresh: boolean;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Revenue Intelligence Dashboard Component
 * Main dashboard showing revenue overview and key metrics
 */
const RevenueIntelligenceDashboard: React.FC<{
  revenueData: RevenueData[];
  totalRevenue: number;
  monthlyGrowth: number;
  channelCount: number;
  onTimeRangeChange: (range: string) => void;
}> = ({ revenueData, totalRevenue, monthlyGrowth, channelCount, onTimeRangeChange }) => {
  const revenueByMonth = useMemo(() => {
    const monthlyData = revenueData.reduce((acc, item) => {
      const month = new Date(item.date).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthlyData).map(([month, revenue]) => ({
      month,
      revenue,
      formattedMonth: new Date(month + '-01').toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      })
    }));
  }, [revenueData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Revenue Intelligence</h2>
          <p className="text-muted-foreground">
            Comprehensive analytics across all your monetization channels
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select onValueChange={onTimeRangeChange} defaultValue="30d">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {monthlyGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              {Math.abs(monthlyGrowth)}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channelCount}</div>
            <p className="text-xs text-muted-foreground">
              Across {new Set(revenueData.map(r => r.platform)).size} platforms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Monthly Revenue</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Math.round(totalRevenue / Math.max(revenueByMonth.length, 1)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {revenueByMonth.length} months of data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Velocity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Math.round(totalRevenue / 30).toLocaleString()}/day
            </div>
            <p className="text-xs text-muted-foreground">
              Current daily average
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedMonth" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#8884d8" 
                fill="#8884d8" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Monetization Channels Overview Component
 * Shows performance of different revenue channels
 */
const MonetizationChannelsOverview: React.FC<{
  channels: MonetizationChannel[];
  onChannelToggle: (channelId: string) => void;
}> = ({ channels, onChannelToggle }) => {
  const channelColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'
  ];

  const pieData = channels.map((channel, index) => ({
    name: channel.name,
    value: channel.monthly_revenue,
    color: channelColors[index % channelColors.length]
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Monetization Channels</h3>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync All
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="font-medium">{channel.name}</div>
                    <Badge variant={channel.status === 'active' ? 'default' : 'secondary'}>
                      {channel.status}
                    </Badge>
                    <Badge 
                      variant={channel.integration_status === 'connected' ? 'default' : 'destructive'}
                    >
                      {channel.integration_status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${channel.monthly_revenue.toLocaleString()}</div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {channel.growth_rate >= 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                      {Math.abs(channel.growth_rate)}%
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Revenue Share</span>
                    <span>{channel.revenue_share}%</span>
                  </div>
                  <Progress value={channel.revenue_share} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Last sync: {new Date(channel.last_sync).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Revenue Forecasting Component
 * Shows AI-powered revenue predictions
 */
const RevenueForecasting: React.FC<{
  historicalData: RevenueData[];
  forecasts: RevenueForecast[];
}> = ({ historicalData, forecasts }) => {
  const combinedData = useMemo(() => {
    const historical = historicalData.reduce((acc, item) => {
      const month = new Date(item.date).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    const historicalEntries = Object.entries(historical).map(([month, revenue]) => ({
      month,
      actual: revenue,
      predicted: null,
      confidence_low: null,
      confidence_high: null,
      type: 'historical' as const
    }));

    const forecastEntries = forecasts.map(forecast => ({
      month: forecast.date.substring(0, 7),
      actual: null,
      predicted: forecast.predicted_revenue,
      confidence_low: forecast.confidence_interval[0],
      confidence_high: forecast.confidence_interval[1],
      type: 'forecast' as const
    }));

    return [...historicalEntries, ...forecastEntries].sort((a, b) => 
      a.month.localeCompare(b.month)
    );
  }, [historicalData, forecasts]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold">Revenue Forecasting</h3>
        <p className="text-muted-foreground">AI-powered predictions based on historical trends</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>6-Month Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickFormatter={(value) => new Date(value + '-01').toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: '2-digit' 
                })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value ? `$${Number(value).toLocaleString()}` : 'N/A', 
                  name
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="confidence_high"
                stackId="confidence"
                stroke="none"
                fill="#e3f2fd"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="confidence_low"
                stackId="confidence"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2196f3"
                strokeWidth={3}
                dot={{ r: 4 }}
                name="Actual Revenue"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#ff9800"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="Predicted Revenue"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {forecasts.slice(0, 3).map((forecast, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {new Date(forecast.date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${Math.round(forecast.predicted_revenue).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Range: ${Math.round(forecast.confidence_interval[0]).toLocaleString()} - 
                ${Math.round(forecast.confidence_interval[1]).toLocaleString()}
              </div>
              <div className="mt-2">
                <div className="text-xs font-medium mb-1">Key Factors:</div>
                {forecast.factors.slice(0, 2).map((factor, i) => (
                  <Badge key={i} variant="outline" className="text-xs mr-1 mb-1">
                    {factor}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/**
 * Competitive Analysis Component
 * Shows competitor benchmarking and market positioning
 */
const CompetitiveAnalysis: React.FC<{
  competitors: CompetitorData[];
  userRevenue: number;
}> = ({ competitors, userRevenue }) => {
  const sortedCompetitors = [...competitors].sort((a, b) => b.estimated_revenue - a.estimated_revenue);
  const userRank = sortedCompetitors.filter(c => c.estimated_revenue > userRevenue).length + 1;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold">Competitive Analysis</h3>
        <p className="text-muted-foreground">
          See how you stack up against similar creators in your niche
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'You', revenue: userRevenue, isUser: true },
                ...sortedCompetitors.slice(0, 5).map(c => ({ 
                  name: c.name, 
                  revenue: c.estimated_revenue, 
                  isUser: false 
                }))
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Bar dataKey="revenue" fill={(entry) => entry.isUser ? '#ff9800' : '#8884d8'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold">#{userRank}</div>
                <p className="text-muted-foreground">Your current ranking</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Market Position</span>
                  <span>{Math.round((1 - (userRank - 1) / sortedCompetitors.length) * 100)}%</span>
                </div>
                <Progress 
                  value={Math.round((1 - (userRank - 1) / sortedCompetitors.length) * 100)} 
                  className="h-2" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">
                    ${Math.round(userRevenue - sortedCompetitors[Math.min(userRank, sortedCompetitors.length - 1)]?.estimated_revenue