```tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Globe,
  Download,
  Filter,
  AlertTriangle,
  Target,
  Activity,
  PieChart as PieChartIcon,
  BarChart3,
  MapPin,
  Zap
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format, subDays } from 'date-fns';

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  method: 'card' | 'bank_transfer' | 'digital_wallet' | 'crypto';
  country: string;
  timestamp: Date;
  fee: number;
  customer_id: string;
}

interface AnalyticsMetrics {
  totalRevenue: number;
  transactionCount: number;
  averageOrderValue: number;
  conversionRate: number;
  failureRate: number;
  refundRate: number;
  growthRate: number;
  activeCustomers: number;
}

interface GeographicalData {
  country: string;
  revenue: number;
  transactions: number;
  color: string;
}

interface PredictionData {
  period: string;
  predicted: number;
  confidence: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface PaymentAnalyticsDashboardProps {
  initialData?: PaymentData[];
  onDataExport?: (data: any, format: 'csv' | 'pdf' | 'json') => void;
  refreshInterval?: number;
  className?: string;
}

const PaymentAnalyticsDashboard: React.FC<PaymentAnalyticsDashboardProps> = ({
  initialData = [],
  onDataExport,
  refreshInterval = 30000,
  className = ''
}) => {
  const [paymentData, setPaymentData] = useState<PaymentData[]>(initialData);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Simulated real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new payment data
      const newPayment: PaymentData = {
        id: `payment_${Date.now()}`,
        amount: Math.random() * 1000 + 10,
        currency: 'USD',
        status: Math.random() > 0.1 ? 'completed' : 'failed',
        method: ['card', 'bank_transfer', 'digital_wallet', 'crypto'][Math.floor(Math.random() * 4)] as any,
        country: ['US', 'GB', 'DE', 'FR', 'CA'][Math.floor(Math.random() * 5)],
        timestamp: new Date(),
        fee: Math.random() * 20,
        customer_id: `customer_${Math.random().toString(36).substr(2, 9)}`
      };
      
      setPaymentData(prev => [newPayment, ...prev.slice(0, 999)]);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Filter data based on date range and filters
  const filteredData = useMemo(() => {
    return paymentData.filter(payment => {
      const dateInRange = dateRange?.from && dateRange?.to 
        ? payment.timestamp >= dateRange.from && payment.timestamp <= dateRange.to
        : true;
      const countryMatch = selectedCountry === 'all' || payment.country === selectedCountry;
      const methodMatch = selectedMethod === 'all' || payment.method === selectedMethod;
      
      return dateInRange && countryMatch && methodMatch;
    });
  }, [paymentData, dateRange, selectedCountry, selectedMethod]);

  // Calculate analytics metrics
  const metrics = useMemo((): AnalyticsMetrics => {
    const completedPayments = filteredData.filter(p => p.status === 'completed');
    const failedPayments = filteredData.filter(p => p.status === 'failed');
    const refundedPayments = filteredData.filter(p => p.status === 'refunded');
    
    const totalRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const transactionCount = filteredData.length;
    const averageOrderValue = completedPayments.length > 0 ? totalRevenue / completedPayments.length : 0;
    const failureRate = transactionCount > 0 ? (failedPayments.length / transactionCount) * 100 : 0;
    const refundRate = completedPayments.length > 0 ? (refundedPayments.length / completedPayments.length) * 100 : 0;
    const activeCustomers = new Set(completedPayments.map(p => p.customer_id)).size;
    
    // Mock growth rate calculation
    const growthRate = Math.random() * 20 - 5; // -5% to +15%
    const conversionRate = Math.random() * 100; // Mock conversion rate

    return {
      totalRevenue,
      transactionCount,
      averageOrderValue,
      conversionRate,
      failureRate,
      refundRate,
      growthRate,
      activeCustomers
    };
  }, [filteredData]);

  // Prepare chart data
  const revenueChartData = useMemo(() => {
    const dailyData = new Map<string, { revenue: number, transactions: number }>();
    
    filteredData.filter(p => p.status === 'completed').forEach(payment => {
      const day = format(payment.timestamp, 'yyyy-MM-dd');
      const existing = dailyData.get(day) || { revenue: 0, transactions: 0 };
      dailyData.set(day, {
        revenue: existing.revenue + payment.amount,
        transactions: existing.transactions + 1
      });
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date: format(new Date(date), 'MMM dd'),
      revenue: data.revenue,
      transactions: data.transactions
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const paymentMethodData = useMemo(() => {
    const methodCounts = filteredData.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(methodCounts).map(([method, amount]) => ({
      method: method.replace('_', ' ').toUpperCase(),
      amount,
      percentage: (amount / metrics.totalRevenue) * 100
    }));
  }, [filteredData, metrics.totalRevenue]);

  const geographicalData = useMemo((): GeographicalData[] => {
    const countryData = filteredData.reduce((acc, payment) => {
      if (payment.status === 'completed') {
        acc[payment.country] = acc[payment.country] || { revenue: 0, transactions: 0 };
        acc[payment.country].revenue += payment.amount;
        acc[payment.country].transactions += 1;
      }
      return acc;
    }, {} as Record<string, { revenue: number, transactions: number }>);

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
    
    return Object.entries(countryData).map(([country, data], index) => ({
      country,
      revenue: data.revenue,
      transactions: data.transactions,
      color: colors[index % colors.length]
    }));
  }, [filteredData]);

  // Mock predictive data
  const predictionData = useMemo((): PredictionData[] => {
    const future = Array.from({ length: 12 }, (_, i) => ({
      period: format(addDays(new Date(), (i + 1) * 30), 'MMM yyyy'),
      predicted: metrics.totalRevenue * (1 + (Math.random() * 0.2 - 0.1)),
      confidence: 75 + Math.random() * 20
    }));
    
    return future;
  }, [metrics.totalRevenue]);

  const handleExport = useCallback((format: 'csv' | 'pdf' | 'json') => {
    const exportData = {
      metrics,
      revenueData: revenueChartData,
      paymentMethods: paymentMethodData,
      geographical: geographicalData,
      predictions: predictionData,
      rawData: filteredData,
      filters: { dateRange, selectedCountry, selectedMethod },
      exportedAt: new Date().toISOString()
    };

    onDataExport?.(exportData, format);
  }, [metrics, revenueChartData, paymentMethodData, geographicalData, predictionData, filteredData, dateRange, selectedCountry, selectedMethod, onDataExport]);

  // Mock alerts
  useEffect(() => {
    const mockAlerts: Alert[] = [
      {
        id: 'alert_1',
        type: 'warning',
        title: 'High Failure Rate',
        description: `Payment failure rate is ${metrics.failureRate.toFixed(1)}%, above the 5% threshold.`,
        timestamp: new Date(),
        acknowledged: false
      },
      {
        id: 'alert_2',
        type: 'success',
        title: 'Revenue Target Met',
        description: 'Monthly revenue target achieved 3 days ahead of schedule.',
        timestamp: subDays(new Date(), 1),
        acknowledged: true
      }
    ].filter(alert => 
      (alert.type === 'warning' && metrics.failureRate > 5) || 
      (alert.type === 'success' && metrics.growthRate > 10)
    );

    setAlerts(mockAlerts);
  }, [metrics.failureRate, metrics.growthRate]);

  const MetricsCard: React.FC<{
    title: string;
    value: string;
    change?: string;
    changeType?: 'positive' | 'negative';
    icon: React.ReactNode;
  }> = ({ title, value, change, changeType, icon }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'} flex items-center`}>
            {changeType === 'positive' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const FilterPanel: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Date Range</label>
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Country</label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="FR">France</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Payment Method</label>
          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="card">Credit Card</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
              <SelectItem value="crypto">Cryptocurrency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );

  const ExportControls: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </CardTitle>
        <CardDescription>
          Export analytics data in various formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button 
          onClick={() => handleExport('csv')} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          Export as CSV
        </Button>
        <Button 
          onClick={() => handleExport('pdf')} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          Export as PDF
        </Button>
        <Button 
          onClick={() => handleExport('json')} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          Export as JSON
        </Button>
      </CardContent>
    </Card>
  );

  const AlertsPanel: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Alerts ({alerts.filter(a => !a.acknowledged).length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active alerts</p>
        ) : (
          alerts.map(alert => (
            <Alert key={alert.id} className={`${alert.acknowledged ? 'opacity-60' : ''}`}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription className="text-xs">
                {alert.description}
                <div className="text-xs text-muted-foreground mt-1">
                  {format(alert.timestamp, 'MMM dd, HH:mm')}
                </div>
              </AlertDescription>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Payment Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into your payment performance
          </p>
        </div>
        <Badge variant="outline" className="flex items-center">
          <Activity className="w-3 h-3 mr-1" />
          Live Data
        </Badge>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Dashboard */}
        <div className="xl:col-span-3 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricsCard
              title="Total Revenue"
              value={`$${metrics.totalRevenue.toLocaleString()}`}
              change={`+${metrics.growthRate.toFixed(1)}%`}
              changeType={metrics.growthRate > 0 ? 'positive' : 'negative'}
              icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
            />
            <MetricsCard
              title="Transactions"
              value={metrics.transactionCount.toLocaleString()}
              change="+12.5%"
              changeType="positive"
              icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}
            />
            <MetricsCard
              title="Avg. Order Value"
              value={`$${metrics.averageOrderValue.toFixed(2)}`}
              change="+8.2%"
              changeType="positive"
              icon={<Target className="w-4 h-4 text-muted-foreground" />}
            />
            <MetricsCard
              title="Active Customers"
              value={metrics.activeCustomers.toLocaleString()}
              change="+15.3%"
              changeType="positive"
              icon={<Users className="w-4 h-4 text-muted-foreground" />}
            />
          </div>

          {/* Charts and Analytics */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="geographical">Geographical</TabsTrigger>
              <TabsTrigger value="methods">Payment Methods</TabsTrigger>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Revenue Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Revenue Trends
                  </CardTitle>
                  <CardDescription>
                    Daily revenue and transaction volume over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.3}
                          name="Revenue ($)"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="transactions"
                          stroke="#82ca9d"
                          name="Transactions"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">
                        {(100 - metrics.failureRate).toFixed(1)}%
                      </div>
                      <Progress value={100 - metrics.failureRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {metrics.transactionCount - filteredData.filter(p => p.status === 'failed').length} successful transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Refund Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">
                        {metrics.refundRate.toFixed(1)}%
                      </div>
                      <Progress value={metrics.refundRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {filteredData.filter(p => p.status === 'refunded').length} refunded transactions
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">