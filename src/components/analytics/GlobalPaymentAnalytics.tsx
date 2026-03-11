```tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

import {
  LineChart,
  BarChart,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  Line,
  Bar,
} from 'recharts';

import {
  TrendingUp,
  TrendingDown,
  Globe,
  CreditCard,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';

interface PaymentMetrics {
  totalVolume: number;
  totalTransactions: number;
  successRate: number;
  averageValue: number;
  growth: number;
  currency: string;
}

interface CountryMetrics {
  country: string;
  countryCode: string;
  volume: number;
  transactions: number;
  successRate: number;
  growth: number;
}

interface PaymentMethodMetrics {
  method: string;
  volume: number;
  transactions: number;
  successRate: number;
  marketShare: number;
  color: string;
}

interface TimeSeriesData {
  date: string;
  volume: number;
  transactions: number;
  successRate: number;
}

interface RealtimeUpdate {
  type: 'transaction' | 'refund' | 'failure';
  amount: number;
  country: string;
  method: string;
  timestamp: string;
}

interface PaymentStore {
  selectedPeriod: string;
  selectedCountry: string;
  selectedMethod: string;
  isRealtime: boolean;
  realtimeUpdates: RealtimeUpdate[];
  setSelectedPeriod: (period: string) => void;
  setSelectedCountry: (country: string) => void;
  setSelectedMethod: (method: string) => void;
  setIsRealtime: (enabled: boolean) => void;
  addRealtimeUpdate: (update: RealtimeUpdate) => void;
  clearRealtimeUpdates: () => void;
}

const usePaymentStore = create<PaymentStore>((set) => ({
  selectedPeriod: '30d',
  selectedCountry: 'all',
  selectedMethod: 'all',
  isRealtime: true,
  realtimeUpdates: [],
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
  setSelectedCountry: (country) => set({ selectedCountry: country }),
  setSelectedMethod: (method) => set({ selectedMethod: method }),
  setIsRealtime: (enabled) => set({ isRealtime: enabled }),
  addRealtimeUpdate: (update) => 
    set((state) => ({
      realtimeUpdates: [update, ...state.realtimeUpdates.slice(0, 9)],
    })),
  clearRealtimeUpdates: () => set({ realtimeUpdates: [] }),
}));

const usePaymentAnalytics = (period: string, country: string, method: string) => {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['payment-metrics', period, country, method],
    queryFn: async (): Promise<PaymentMetrics> => {
      const days = parseInt(period.replace('d', ''));
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      let query = supabase
        .from('payments_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (country !== 'all') {
        query = query.eq('country', country);
      }

      if (method !== 'all') {
        query = query.eq('payment_method', method);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalVolume = data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      const totalTransactions = data?.length || 0;
      const successfulTransactions = data?.filter(item => item.status === 'success').length || 0;
      const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

      // Calculate growth (mock calculation - would need historical comparison)
      const growth = Math.random() * 20 - 10; // -10% to +10%

      return {
        totalVolume,
        totalTransactions,
        successRate,
        averageValue: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
        growth,
        currency: 'USD',
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: countryData, isLoading: countryLoading } = useQuery({
    queryKey: ['country-metrics', period, method],
    queryFn: async (): Promise<CountryMetrics[]> => {
      const days = parseInt(period.replace('d', ''));
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      let query = supabase
        .from('payments_analytics')
        .select('country, amount, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (method !== 'all') {
        query = query.eq('payment_method', method);
      }

      const { data, error } = await query;

      if (error) throw error;

      const countryMap = new Map<string, { volume: number; transactions: number; successful: number }>();

      data?.forEach(item => {
        const current = countryMap.get(item.country) || { volume: 0, transactions: 0, successful: 0 };
        current.volume += item.amount || 0;
        current.transactions += 1;
        if (item.status === 'success') current.successful += 1;
        countryMap.set(item.country, current);
      });

      return Array.from(countryMap.entries())
        .map(([country, stats]) => ({
          country,
          countryCode: country, // Would map to actual country codes
          volume: stats.volume,
          transactions: stats.transactions,
          successRate: stats.transactions > 0 ? (stats.successful / stats.transactions) * 100 : 0,
          growth: Math.random() * 20 - 10, // Mock growth
        }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: methodData, isLoading: methodLoading } = useQuery({
    queryKey: ['method-metrics', period, country],
    queryFn: async (): Promise<PaymentMethodMetrics[]> => {
      const days = parseInt(period.replace('d', ''));
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      let query = supabase
        .from('payments_analytics')
        .select('payment_method, amount, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (country !== 'all') {
        query = query.eq('country', country);
      }

      const { data, error } = await query;

      if (error) throw error;

      const methodMap = new Map<string, { volume: number; transactions: number; successful: number }>();
      let totalVolume = 0;

      data?.forEach(item => {
        const current = methodMap.get(item.payment_method) || { volume: 0, transactions: 0, successful: 0 };
        current.volume += item.amount || 0;
        current.transactions += 1;
        if (item.status === 'success') current.successful += 1;
        methodMap.set(item.payment_method, current);
        totalVolume += item.amount || 0;
      });

      const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

      return Array.from(methodMap.entries())
        .map(([method, stats], index) => ({
          method,
          volume: stats.volume,
          transactions: stats.transactions,
          successRate: stats.transactions > 0 ? (stats.successful / stats.transactions) * 100 : 0,
          marketShare: totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0,
          color: colors[index % colors.length],
        }))
        .sort((a, b) => b.volume - a.volume);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['time-series', period, country, method],
    queryFn: async (): Promise<TimeSeriesData[]> => {
      const days = parseInt(period.replace('d', ''));
      const data: TimeSeriesData[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        data.push({
          date: format(date, 'MMM dd'),
          volume: Math.random() * 100000 + 50000,
          transactions: Math.random() * 1000 + 500,
          successRate: 85 + Math.random() * 15,
        });
      }

      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    metrics,
    countryData,
    methodData,
    timeSeriesData,
    isLoading: metricsLoading || countryLoading || methodLoading || timeSeriesLoading,
    error: metricsError,
  };
};

const useRealtimePayments = () => {
  const { isRealtime, addRealtimeUpdate } = usePaymentStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isRealtime) return;

    const channel = supabase
      .channel('payment-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments_analytics',
        },
        (payload) => {
          const update: RealtimeUpdate = {
            type: 'transaction',
            amount: payload.new.amount || 0,
            country: payload.new.country || 'Unknown',
            method: payload.new.payment_method || 'Unknown',
            timestamp: new Date().toISOString(),
          };
          
          addRealtimeUpdate(update);
          
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['payment-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['country-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['method-metrics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealtime, addRealtimeUpdate, queryClient]);
};

const useIntersectionObserver = (ref: React.RefObject<Element>) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold: 0.1 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return isIntersecting;
};

interface GlobalPaymentAnalyticsProps {
  className?: string;
  refreshInterval?: number;
}

const GlobalPaymentAnalytics: React.FC<GlobalPaymentAnalyticsProps> = ({
  className = '',
  refreshInterval = 30000,
}) => {
  const {
    selectedPeriod,
    selectedCountry,
    selectedMethod,
    isRealtime,
    realtimeUpdates,
    setSelectedPeriod,
    setSelectedCountry,
    setSelectedMethod,
    setIsRealtime,
    clearRealtimeUpdates,
  } = usePaymentStore();

  const {
    metrics,
    countryData,
    methodData,
    timeSeriesData,
    isLoading,
    error,
  } = usePaymentAnalytics(selectedPeriod, selectedCountry, selectedMethod);

  useRealtimePayments();

  const chartRef = useRef<HTMLDivElement>(null);
  const isChartVisible = useIntersectionObserver(chartRef);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const MetricCard: React.FC<{
    title: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    description?: string;
  }> = ({ title, value, change, icon, description }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="flex items-center space-x-1 text-xs">
          {change >= 0 ? (
            <ArrowUpRight className="h-3 w-3 text-green-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
            {formatPercent(Math.abs(change))}
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );

  if (error) {
    return (
      <Alert className={className}>
        <AlertDescription>
          Failed to load payment analytics. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Payment Analytics</h2>
          <p className="text-muted-foreground">
            Global payment performance and insights
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={isRealtime ? "default" : "outline"}
            size="sm"
            onClick={() => setIsRealtime(!isRealtime)}
            className="flex items-center space-x-1"
          >
            <RefreshCw className={`h-3 w-3 ${isRealtime ? 'animate-spin' : ''}`} />
            <span>Real-time</span>
          </Button>
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="365d">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Real-time Updates */}
      {isRealtime && realtimeUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Real-time Updates</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearRealtimeUpdates}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {realtimeUpdates.map((update, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{update.method}</Badge>
                    <span>{update.country}</span>
                  </div>
                  <div className="text-green-500 font-medium">
                    {formatCurrency(update.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Volume"
          value={formatCurrency(metrics?.totalVolume || 0, metrics?.currency)}
          change={metrics?.growth || 0}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Payment volume processed"
        />
        <MetricCard
          title="Transactions"
          value={formatNumber(metrics?.totalTransactions || 0)}
          change={metrics?.growth || 0}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          description="Total payment count"
        />
        <MetricCard
          title="Success Rate"
          value={formatPercent(metrics?.successRate || 0)}
          change={2.1}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description="Payment success ratio"
        />
        <MetricCard
          title="Avg. Transaction"
          value={formatCurrency(metrics?.averageValue || 0, metrics?.currency)}
          change={-1.2}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description="Average payment value"
        />
      </div>

      {/* Charts */}
      <div ref={chartRef}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume Trend</CardTitle>
                <CardDescription>
                  Daily payment volume and transaction count over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isChartVisible && timeSeriesData && (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="volume" orientation="left" />
                      <YAxis yAxisId="transactions" orientation="right" />
                      <Tooltip 
                        formatter={(value, name) => [
                          name === 'volume' ? formatCurrency(value as number) : formatNumber(value as number),
                          name === 'volume' ? 'Volume' : 'Transactions'
                        ]}
                      />
                      <Legend />
                      <Line
                        yAxisId="volume"
                        type="monotone"
                        dataKey="volume"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        name="Volume"
                      />
                      <Line
                        yAxisId="transactions"
                        type="monotone"
                        dataKey="transactions"
                        stroke="#06B6D4"
                        strokeWidth={2}
                        name="Transactions"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>