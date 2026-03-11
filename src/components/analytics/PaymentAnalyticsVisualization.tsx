```tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Sankey,
  Rectangle
} from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown,
  Download,
  Filter,
  Calendar,
  CreditCard,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  RefreshCw
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

// Types
interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
  merchant_id: string;
  country: string;
  fees: number;
}

interface MetricCardData {
  title: string;
  value: string;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface FlowData {
  source: string;
  target: string;
  value: number;
}

interface ChartData {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

interface PaymentAnalyticsVisualizationProps {
  className?: string;
  merchantId?: string;
  defaultDateRange?: DateRange;
  enableExport?: boolean;
  enableDrillDown?: boolean;
}

// Mock data fetch function (replace with actual Supabase integration)
const fetchPaymentTransactions = async (
  dateRange: DateRange,
  filters: {
    currency?: string;
    paymentMethod?: string;
    status?: string;
    merchantId?: string;
  }
): Promise<PaymentTransaction[]> => {
  // Mock implementation - replace with actual Supabase query
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockData: PaymentTransaction[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `txn_${i}`,
        amount: Math.random() * 1000 + 10,
        currency: ['USD', 'EUR', 'GBP', 'JPY'][Math.floor(Math.random() * 4)],
        payment_method: ['card', 'bank_transfer', 'digital_wallet', 'crypto'][Math.floor(Math.random() * 4)],
        status: ['pending', 'completed', 'failed', 'refunded'][Math.floor(Math.random() * 4)] as PaymentTransaction['status'],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        merchant_id: filters.merchantId || 'merchant_1',
        country: ['US', 'UK', 'DE', 'FR', 'JP'][Math.floor(Math.random() * 5)],
        fees: Math.random() * 10 + 1
      }));
      resolve(mockData.filter(t => {
        const transactionDate = new Date(t.created_at);
        return transactionDate >= dateRange.from && transactionDate <= dateRange.to;
      }));
    }, 500);
  });
};

// Color palettes
const COLORS = {
  primary: ['#0ea5e9', '#3b82f6', '#8b5cf6', '#ef4444'],
  currencies: {
    USD: '#0ea5e9',
    EUR: '#3b82f6',
    GBP: '#8b5cf6',
    JPY: '#ef4444',
    default: '#6b7280'
  },
  paymentMethods: {
    card: '#10b981',
    bank_transfer: '#f59e0b',
    digital_wallet: '#8b5cf6',
    crypto: '#ef4444',
    default: '#6b7280'
  },
  status: {
    completed: '#10b981',
    pending: '#f59e0b',
    failed: '#ef4444',
    refunded: '#6b7280'
  }
};

// Utility functions
const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// Components
const MetricCard: React.FC<MetricCardData & { onClick?: () => void }> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  description,
  onClick
}) => (
  <Card className={cn("cursor-pointer transition-all hover:shadow-md", onClick && "hover:scale-105")} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center text-xs text-muted-foreground">
        {changeType === 'increase' ? (
          <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
        ) : (
          <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
        )}
        <span className={cn(
          "font-medium",
          changeType === 'increase' ? 'text-green-500' : 'text-red-500'
        )}>
          {Math.abs(change).toFixed(1)}%
        </span>
        <span className="ml-1">{description}</span>
      </div>
    </CardContent>
  </Card>
);

const CurrencyDistributionChart: React.FC<{
  data: ChartData[];
  onSegmentClick?: (data: ChartData) => void;
}> = ({ data, onSegmentClick }) => (
  <ResponsiveContainer width="100%" height={300}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={120}
        paddingAngle={2}
        dataKey="value"
        onClick={onSegmentClick}
        className="cursor-pointer"
      >
        {data.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={COLORS.currencies[entry.name as keyof typeof COLORS.currencies] || COLORS.currencies.default}
          />
        ))}
      </Pie>
      <Tooltip
        formatter={(value: number, name: string) => [
          formatCurrency(value, name),
          name
        ]}
      />
      <Legend />
    </PieChart>
  </ResponsiveContainer>
);

const PaymentMethodPerformanceChart: React.FC<{
  data: ChartData[];
  onBarClick?: (data: ChartData) => void;
}> = ({ data, onBarClick }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis tickFormatter={(value) => formatCurrency(value, 'USD')} />
      <Tooltip
        formatter={(value: number) => [formatCurrency(value, 'USD'), 'Volume']}
      />
      <Bar
        dataKey="value"
        fill="#0ea5e9"
        onClick={onBarClick}
        className="cursor-pointer"
        shape={(props: any) => (
          <Rectangle
            {...props}
            fill={COLORS.paymentMethods[props.payload.name as keyof typeof COLORS.paymentMethods] || COLORS.paymentMethods.default}
          />
        )}
      />
    </BarChart>
  </ResponsiveContainer>
);

const TransactionFlowChart: React.FC<{
  data: FlowData[];
  onNodeClick?: (node: string) => void;
}> = ({ data, onNodeClick }) => {
  const sankeyData = useMemo(() => {
    const nodes = new Set<string>();
    data.forEach(d => {
      nodes.add(d.source);
      nodes.add(d.target);
    });

    return {
      nodes: Array.from(nodes).map(name => ({ name })),
      links: data.map(d => ({
        source: Array.from(nodes).indexOf(d.source),
        target: Array.from(nodes).indexOf(d.target),
        value: d.value
      }))
    };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Sankey diagram requires additional configuration</p>
          <p className="text-sm">Transaction flow visualization</p>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

const TimeRangeSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-40">
      <Calendar className="mr-2 h-4 w-4" />
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="7d">Last 7 days</SelectItem>
      <SelectItem value="30d">Last 30 days</SelectItem>
      <SelectItem value="90d">Last 90 days</SelectItem>
      <SelectItem value="1y">Last year</SelectItem>
      <SelectItem value="custom">Custom range</SelectItem>
    </SelectContent>
  </Select>
);

const FilterPanel: React.FC<{
  filters: {
    currency: string;
    paymentMethod: string;
    status: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}> = ({ filters, onFilterChange, onReset }) => (
  <div className="flex flex-wrap gap-2">
    <Select
      value={filters.currency}
      onValueChange={(value) => onFilterChange('currency', value)}
    >
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Currency" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="EUR">EUR</SelectItem>
        <SelectItem value="GBP">GBP</SelectItem>
        <SelectItem value="JPY">JPY</SelectItem>
      </SelectContent>
    </Select>

    <Select
      value={filters.paymentMethod}
      onValueChange={(value) => onFilterChange('paymentMethod', value)}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Payment Method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Methods</SelectItem>
        <SelectItem value="card">Card</SelectItem>
        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
        <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
        <SelectItem value="crypto">Crypto</SelectItem>
      </SelectContent>
    </Select>

    <Select
      value={filters.status}
      onValueChange={(value) => onFilterChange('status', value)}
    >
      <SelectTrigger className="w-32">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="failed">Failed</SelectItem>
        <SelectItem value="refunded">Refunded</SelectItem>
      </SelectContent>
    </Select>

    <Button variant="outline" size="sm" onClick={onReset}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Reset
    </Button>
  </div>
);

const DrillDownModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: PaymentTransaction[];
}> = ({ isOpen, onClose, title, data }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Detailed breakdown of {data.length} transactions
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatCurrency(data.reduce((sum, t) => sum + t.amount, 0), 'USD')}
              </div>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data.length}</div>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatCurrency(data.reduce((sum, t) => sum + t.amount, 0) / data.length, 'USD')}
              </div>
              <p className="text-sm text-muted-foreground">Average</p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold">Recent Transactions</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.slice(0, 20).map((transaction) => (
              <div
                key={transaction.id}
                className="flex justify-between items-center p-2 rounded border"
              >
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      transaction.status === 'completed' && 'bg-green-100 text-green-800',
                      transaction.status === 'pending' && 'bg-yellow-100 text-yellow-800',
                      transaction.status === 'failed' && 'bg-red-100 text-red-800'
                    )}
                  >
                    {transaction.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(transaction.created_at), 'MMM dd, HH:mm')}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {transaction.payment_method}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const ExportButton: React.FC<{
  onExport: (format: 'csv' | 'pdf') => void;
  loading?: boolean;
}> = ({ onExport, loading = false }) => (
  <Select onValueChange={(value: 'csv' | 'pdf') => onExport(value)}>
    <SelectTrigger asChild>
      <Button variant="outline" size="sm" disabled={loading}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="csv">Export as CSV</SelectItem>
      <SelectItem value="pdf">Export as PDF</SelectItem>
    </SelectContent>
  </Select>
);

// Main component
const PaymentAnalyticsVisualization: React.FC<PaymentAnalyticsVisualizationProps> = ({
  className,
  merchantId,
  defaultDateRange = {
    from: subDays(new Date(), 30),
    to: new Date()
  },
  enableExport = true,
  enableDrillDown = true
}) => {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [filters, setFilters] = useState({
    currency: 'all',
    paymentMethod: 'all',
    status: 'all'
  });
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    title: string;
    data: PaymentTransaction[];
  }>({
    isOpen: false,
    title: '',
    data: []
  });

  // Update date range based on time range selection
  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRange(value);
    const now = new Date();
    const ranges = {
      '7d': { from: subDays(now, 7), to: now },
      '30d': { from: subDays(now, 30), to: now },
      '90d': { from: subDays(now, 90), to: now },
      '1y': { from: subDays(now, 365), to: now },
      'custom': dateRange
    };
    setDateRange(ranges[value as keyof typeof ranges] || ranges['30d']);
  }, [dateRange]);

  // Data fetching
  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['payment-transactions', dateRange, filters, merchantId],
    queryFn: () => fetchPaymentTransactions(dateRange, {
      ...filters,
      merchantId
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  // Data processing
  const analytics = useMemo(() => {
    if (!transactions.length) {
      return {
        metrics: [],
        currencyDistribution: [],
        paymentMethodPerformance: [],
        transactionFlow: []
      };
    }

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const completed = transactions.filter(t => t.status === 'completed');
    const completedTotal = completed.reduce((sum, t) => sum + t.amount, 0);
    const fees = transactions.reduce((sum, t) => sum + t.fees, 0);

    const metrics: MetricCardData[] = [
      {
        title: 'Total Revenue',
        value: formatCurrency(completedTotal, 'USD'),
        change: 12.5,
        changeType: 'increase',
        icon: DollarSign,
        description: 'from last period'
      },
      {
        title: 'Total Transactions',
        value: transactions.length.toLocaleString(),
        change: 8.2,
        changeType: 'increase',
        icon: CreditCard,
        description: 'from last period'
      },
      {
        title: 'Success Rate',
        value: formatPercentage((completed.length / transactions.length) * 100),
        change: -2.1,
        changeType: 'decrease',
        icon: TrendingUp,
        description: 'from last period'
      },
      {
        title: 'Total Fees',
        value: formatCurrency(fees, 'USD'),
        change: 5.8,
        changeType: 'increase',
        icon: BarChart3,
        description: 'from last period'
      }
    ];

    // Currency distribution
    const currencyMap = new Map<string, number>();
    completed.forEach(t => {
      currencyMap.set(t.currency, (currencyMap.get(t.currency) || 0) + t.amount);
    });
    const currencyDistribution = Array.from(currencyMap.entries()).map(([name, value]) => ({
      name,
      value,
      percentage: (value / completedTotal) * 100
    }));

    // Payment method performance
    const methodMap = new Map<string, number>();
    completed.forEach(t => {
      methodMap.set(t.payment_method, (methodMap.get(t.payment_method) || 0) + t.amount);
    });
    const paymentMethodPerformance = Array.from(methodMap.entries()).map(([name, value]) => ({
      name,
      value
    }));

    // Transaction flow (simplified)
    const transactionFlow: FlowData[] = [
      { source: 'Initiated', target: 'Processing', value: transactions.length },
      { source: 'Processing', target: