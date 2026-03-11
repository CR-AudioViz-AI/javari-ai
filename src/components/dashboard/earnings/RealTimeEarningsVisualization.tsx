import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, FunnelChart, Funnel, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  DollarSign, TrendingUp, TrendingDown, Users, Eye, MousePointer, 
  Download, Filter, Calendar, Activity, BarChart3, PieChart, 
  ExternalLink, RefreshCw, AlertCircle 
} from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import Papa from 'papaparse';

interface EarningsData {
  id: string;
  amount: number;
  currency: string;
  source: string;
  category: string;
  timestamp: string;
  metadata: Record<string, any>;
}

interface RevenueStream {
  id: string;
  name: string;
  category: string;
  totalRevenue: number;
  growth: number;
  conversionRate: number;
  color: string;
}

interface ConversionFunnelData {
  stage: string;
  count: number;
  percentage: number;
  dropoffRate: number;
}

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  format: 'currency' | 'percentage' | 'number';
  icon: React.ComponentType<{ className?: string }>;
}

interface TimeRange {
  label: string;
  value: string;
  days: number;
}

interface RealTimeEarningsVisualizationProps {
  userId?: string;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  defaultTimeRange?: string;
  enableExport?: boolean;
  enableDrillDown?: boolean;
}

const TIME_RANGES: TimeRange[] = [
  { label: 'Last 24 Hours', value: '1d', days: 1 },
  { label: 'Last 7 Days', value: '7d', days: 7 },
  { label: 'Last 30 Days', value: '30d', days: 30 },
  { label: 'Last 90 Days', value: '90d', days: 90 },
];

const REVENUE_STREAM_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'
];

export default function RealTimeEarningsVisualization({
  userId,
  className = '',
  autoRefresh = true,
  refreshInterval = 30000,
  defaultTimeRange = '7d',
  enableExport = true,
  enableDrillDown = true,
}: RealTimeEarningsVisualizationProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(defaultTimeRange);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);

  const queryClient = useQueryClient();

  // Fetch earnings data
  const { data: earningsData = [], isLoading: earningsLoading } = useQuery({
    queryKey: ['earnings', userId, selectedTimeRange],
    queryFn: async () => {
      const days = TIME_RANGES.find(r => r.value === selectedTimeRange)?.days || 7;
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EarningsData[];
    },
    enabled: !!userId,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Fetch conversion funnel data
  const { data: funnelData = [], isLoading: funnelLoading } = useQuery({
    queryKey: ['conversion-funnel', userId, selectedTimeRange],
    queryFn: async () => {
      const days = TIME_RANGES.find(r => r.value === selectedTimeRange)?.days || 7;
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, count(*)')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .in('event_type', ['view', 'click', 'conversion', 'purchase'])
        .group('event_type');

      if (error) throw error;
      
      // Transform to funnel format
      const stages = ['view', 'click', 'conversion', 'purchase'];
      let previousCount = 0;
      
      return stages.map((stage, index) => {
        const stageData = data.find(d => d.event_type === stage);
        const count = stageData?.count || 0;
        const percentage = previousCount > 0 ? (count / previousCount) * 100 : 100;
        const dropoffRate = index > 0 ? 100 - percentage : 0;
        
        if (index === 0) previousCount = count;
        else previousCount = count;
        
        return {
          stage: stage.charAt(0).toUpperCase() + stage.slice(1),
          count,
          percentage: index === 0 ? 100 : percentage,
          dropoffRate,
        };
      });
    },
    enabled: !!userId,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Process revenue streams
  const revenueStreams = useMemo(() => {
    const streamMap = new Map<string, RevenueStream>();
    
    earningsData.forEach((earning, index) => {
      const key = earning.source;
      if (streamMap.has(key)) {
        const stream = streamMap.get(key)!;
        stream.totalRevenue += earning.amount;
      } else {
        streamMap.set(key, {
          id: earning.id,
          name: earning.source,
          category: earning.category,
          totalRevenue: earning.amount,
          growth: Math.random() * 20 - 10, // Mock growth data
          conversionRate: Math.random() * 5, // Mock conversion rate
          color: REVENUE_STREAM_COLORS[index % REVENUE_STREAM_COLORS.length],
        });
      }
    });
    
    return Array.from(streamMap.values());
  }, [earningsData]);

  // Calculate performance metrics
  const performanceMetrics = useMemo((): PerformanceMetric[] => {
    const totalRevenue = earningsData.reduce((sum, earning) => sum + earning.amount, 0);
    const avgRevenue = totalRevenue / (earningsData.length || 1);
    const totalConversions = funnelData.find(d => d.stage === 'Purchase')?.count || 0;
    const totalViews = funnelData.find(d => d.stage === 'View')?.count || 0;
    const conversionRate = totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

    return [
      {
        id: 'total-revenue',
        name: 'Total Revenue',
        value: totalRevenue,
        change: Math.random() * 20 - 10,
        format: 'currency',
        icon: DollarSign,
      },
      {
        id: 'avg-revenue',
        name: 'Average Revenue',
        value: avgRevenue,
        change: Math.random() * 15 - 7.5,
        format: 'currency',
        icon: TrendingUp,
      },
      {
        id: 'conversion-rate',
        name: 'Conversion Rate',
        value: conversionRate,
        change: Math.random() * 5 - 2.5,
        format: 'percentage',
        icon: MousePointer,
      },
      {
        id: 'total-views',
        name: 'Total Views',
        value: totalViews,
        change: Math.random() * 30 - 15,
        format: 'number',
        icon: Eye,
      },
    ];
  }, [earningsData, funnelData]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || !autoRefresh) return;

    const channel = supabase
      .channel('earnings_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'earnings',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          setIsLive(true);
          setLastUpdated(new Date());
          queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
          
          // Reset live indicator after 2 seconds
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, autoRefresh, queryClient]);

  // Handle drill-down
  const handleDrillDown = async (streamId: string) => {
    if (!enableDrillDown) return;
    
    setSelectedStream(streamId);
    
    // Fetch detailed data for the selected stream
    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('source', revenueStreams.find(s => s.id === streamId)?.name)
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (!error) {
      setDrillDownData(data);
    }
  };

  // Export functions
  const exportToPDF = async () => {
    if (!enableExport) return;
    
    setIsExporting(true);
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Earnings Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Time Range: ${TIME_RANGES.find(r => r.value === selectedTimeRange)?.label}`, 20, 40);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 20, 50);
    
    let yPosition = 70;
    performanceMetrics.forEach(metric => {
      doc.text(
        `${metric.name}: ${formatMetricValue(metric.value, metric.format)}`, 
        20, 
        yPosition
      );
      yPosition += 10;
    });
    
    doc.save('earnings-report.pdf');
    setIsExporting(false);
  };

  const exportToCSV = () => {
    if (!enableExport) return;
    
    setIsExporting(true);
    const csv = Papa.unparse(earningsData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'earnings-data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  // Format metric values
  const formatMetricValue = (value: number, format: PerformanceMetric['format']) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(value);
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(Math.round(value));
      default:
        return value.toString();
    }
  };

  const isLoading = earningsLoading || funnelLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Real-Time Earnings</h2>
          </div>
          
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm text-muted-foreground">
              {isLive ? 'Live' : `Updated ${format(lastUpdated, 'HH:mm:ss')}`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {enableExport && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToCSV}
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToPDF}
                disabled={isExporting}
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          )}

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['earnings'] });
              queryClient.invalidateQueries({ queryKey: ['conversion-funnel'] });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map(metric => {
          const Icon = metric.icon;
          const isPositive = metric.change > 0;
          
          return (
            <Card key={metric.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.name}
                  </p>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {formatMetricValue(metric.value, metric.format)}
                  </p>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositive ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Streams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Revenue Streams
            </CardTitle>
            <CardDescription>
              Revenue breakdown by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueStreams.map(stream => (
                <div 
                  key={stream.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleDrillDown(stream.id)}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stream.color }}
                    />
                    <div>
                      <p className="font-medium">{stream.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stream.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatMetricValue(stream.totalRevenue, 'currency')}
                    </p>
                    <div className="flex items-center gap-1">
                      {stream.growth > 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                      <span className={`text-xs ${
                        stream.growth > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stream.growth > 0 ? '+' : ''}{stream.growth.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              User journey from view to purchase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((stage, index) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="text-sm text-muted-foreground">
                      {stage.count.toLocaleString()} users
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-6 relative">
                    <div 
                      className="bg-primary h-6 rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground"
                      style={{ width: `${stage.percentage}%` }}
                    >
                      {stage.percentage.toFixed(1)}%
                    </div>
                  </div>
                  {index > 0 && stage.dropoffRate > 0 && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {stage.dropoffRate.toFixed(1)}% drop-off
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Timeline</CardTitle>
          <CardDescription>
            Revenue trends over the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis 
                  tickFormatter={(value) => formatMetricValue(value, 'currency')}
                />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'PPp')}
                  formatter={(value) => [formatMetricValue(Number(value), 'currency'), 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down Modal */}
      {enableDrillDown && (
        <Dialog 
          open={!!selectedStream} 
          onOpenChange={(open) => !open && setSelectedStream(null)}
        >
          <Dialog