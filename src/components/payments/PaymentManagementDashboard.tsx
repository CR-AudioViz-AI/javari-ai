```tsx
"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Filter,
  Search,
} from 'lucide-react';

// Types
interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'disputed';
  payment_method: string;
  customer_email: string;
  created_at: string;
  settlement_date?: string;
  fees: number;
  net_amount: number;
}

interface Settlement {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  settlement_date: string;
  transaction_count: number;
  fees_total: number;
}

interface PaymentMethod {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}

interface Dispute {
  id: string;
  transaction_id: string;
  amount: number;
  reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'lost';
  created_at: string;
  customer_email: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

interface PaymentMetrics {
  totalRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  successRate: number;
  pendingSettlements: number;
  activeDisputes: number;
  refundAmount: number;
  processingFees: number;
}

interface PaymentManagementDashboardProps {
  className?: string;
  defaultDateRange?: DateRange;
  onTransactionSelect?: (transaction: Transaction) => void;
  onExportData?: (data: any, type: string) => void;
}

// Mock API functions (replace with actual Supabase queries)
const fetchTransactions = async (dateRange: DateRange): Promise<Transaction[]> => {
  // Simulate API call
  return Array.from({ length: 50 }, (_, i) => ({
    id: `txn_${i + 1}`,
    amount: Math.random() * 1000 + 10,
    currency: 'USD',
    status: ['pending', 'completed', 'failed', 'disputed'][Math.floor(Math.random() * 4)] as Transaction['status'],
    payment_method: ['credit_card', 'debit_card', 'bank_transfer', 'paypal'][Math.floor(Math.random() * 4)],
    customer_email: `customer${i + 1}@example.com`,
    created_at: format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd HH:mm:ss'),
    settlement_date: Math.random() > 0.5 ? format(subDays(new Date(), Math.floor(Math.random() * 7)), 'yyyy-MM-dd') : undefined,
    fees: Math.random() * 30 + 2,
    net_amount: 0,
  })).map(t => ({ ...t, net_amount: t.amount - t.fees }));
};

const fetchSettlements = async (dateRange: DateRange): Promise<Settlement[]> => {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `settlement_${i + 1}`,
    amount: Math.random() * 10000 + 1000,
    currency: 'USD',
    status: ['pending', 'processing', 'completed', 'failed'][Math.floor(Math.random() * 4)] as Settlement['status'],
    settlement_date: format(subDays(new Date(), i * 3), 'yyyy-MM-dd'),
    transaction_count: Math.floor(Math.random() * 100) + 10,
    fees_total: Math.random() * 500 + 50,
  }));
};

const fetchDisputes = async (): Promise<Dispute[]> => {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `dispute_${i + 1}`,
    transaction_id: `txn_${i + 10}`,
    amount: Math.random() * 500 + 50,
    reason: ['chargeback', 'fraud', 'unrecognized', 'duplicate'][Math.floor(Math.random() * 4)],
    status: ['open', 'under_review', 'resolved', 'lost'][Math.floor(Math.random() * 4)] as Dispute['status'],
    created_at: format(subDays(new Date(), Math.floor(Math.random() * 14)), 'yyyy-MM-dd'),
    customer_email: `customer${i + 10}@example.com`,
  }));
};

// Sub-components
const PaymentMetricsCards: React.FC<{ metrics: PaymentMetrics }> = ({ metrics }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          +{((metrics.totalRevenue / 10000) * 100).toFixed(1)}% from last month
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Transactions</CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metrics.transactionCount}</div>
        <p className="text-xs text-muted-foreground">
          Avg: ${metrics.averageTransaction.toFixed(2)}
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
        <p className="text-xs text-muted-foreground">
          +2.1% from last month
        </p>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Disputes</CardTitle>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metrics.activeDisputes}</div>
        <p className="text-xs text-muted-foreground">
          ${metrics.refundAmount.toFixed(2)} in refunds
        </p>
      </CardContent>
    </Card>
  </div>
);

const TransactionTable: React.FC<{
  transactions: Transaction[];
  onTransactionSelect?: (transaction: Transaction) => void;
}> = ({ transactions, onTransactionSelect }) => (
  <Card>
    <CardHeader>
      <CardTitle>Recent Transactions</CardTitle>
      <CardDescription>Latest payment transactions and their status</CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.slice(0, 10).map((transaction) => (
            <TableRow
              key={transaction.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onTransactionSelect?.(transaction)}
            >
              <TableCell className="font-mono text-sm">{transaction.id}</TableCell>
              <TableCell>${transaction.amount.toFixed(2)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    transaction.status === 'completed'
                      ? 'default'
                      : transaction.status === 'failed'
                      ? 'destructive'
                      : transaction.status === 'disputed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {transaction.status}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">
                {transaction.payment_method.replace('_', ' ')}
              </TableCell>
              <TableCell>{transaction.customer_email}</TableCell>
              <TableCell>{format(parseISO(transaction.created_at), 'MMM dd, yyyy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const SettlementTrackingWidget: React.FC<{ settlements: Settlement[] }> = ({ settlements }) => (
  <Card>
    <CardHeader>
      <CardTitle>Settlement Status</CardTitle>
      <CardDescription>Track settlement processing and payouts</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {settlements.slice(0, 5).map((settlement) => (
          <div key={settlement.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center space-x-3">
              {settlement.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : settlement.status === 'processing' ? (
                <Clock className="h-5 w-5 text-yellow-500" />
              ) : settlement.status === 'failed' ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : (
                <RefreshCw className="h-5 w-5 text-gray-500" />
              )}
              <div>
                <p className="font-medium">${settlement.amount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  {settlement.transaction_count} transactions
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  settlement.status === 'completed'
                    ? 'default'
                    : settlement.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {settlement.status}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {format(parseISO(settlement.settlement_date), 'MMM dd')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const RevenueAnalyticsChart: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const chartData = useMemo(() => {
    const dailyRevenue = transactions.reduce((acc, transaction) => {
      const date = format(parseISO(transaction.created_at), 'MMM dd');
      if (!acc[date]) {
        acc[date] = { date, revenue: 0, transactions: 0 };
      }
      if (transaction.status === 'completed') {
        acc[date].revenue += transaction.amount;
        acc[date].transactions += 1;
      }
      return acc;
    }, {} as Record<string, { date: string; revenue: number; transactions: number }>);

    return Object.values(dailyRevenue).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Revenue Analytics</CardTitle>
        <CardDescription>Daily revenue and transaction volume</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value, name) => [
                name === 'revenue' ? `$${value}` : value,
                name === 'revenue' ? 'Revenue' : 'Transactions'
              ]}
            />
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
  );
};

const PaymentMethodBreakdown: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const methodData = useMemo(() => {
    const methods = transactions.reduce((acc, transaction) => {
      if (transaction.status === 'completed') {
        if (!acc[transaction.payment_method]) {
          acc[transaction.payment_method] = { count: 0, amount: 0 };
        }
        acc[transaction.payment_method].count += 1;
        acc[transaction.payment_method].amount += transaction.amount;
      }
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const total = Object.values(methods).reduce((sum, method) => sum + method.amount, 0);

    return Object.entries(methods).map(([method, data]) => ({
      method: method.replace('_', ' '),
      ...data,
      percentage: (data.amount / total) * 100,
    }));
  }, [transactions]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Breakdown by payment method</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={methodData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ method, percentage }) => `${method} (${percentage.toFixed(1)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
            >
              {methodData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

const DisputeManagementPanel: React.FC<{ disputes: Dispute[] }> = ({ disputes }) => (
  <Card>
    <CardHeader>
      <CardTitle>Dispute Management</CardTitle>
      <CardDescription>Active disputes and resolution status</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {disputes.map((dispute) => (
          <div key={dispute.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">${dispute.amount.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {dispute.reason} - {dispute.customer_email}
              </p>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  dispute.status === 'resolved'
                    ? 'default'
                    : dispute.status === 'lost'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {dispute.status.replace('_', ' ')}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {format(parseISO(dispute.created_at), 'MMM dd')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Main Component
const PaymentManagementDashboard: React.FC<PaymentManagementDashboardProps> = ({
  className = '',
  defaultDateRange = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  },
  onTransactionSelect,
  onExportData,
}) => {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Data fetching
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', dateRange],
    queryFn: () => fetchTransactions(dateRange),
  });

  const { data: settlements = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ['settlements', dateRange],
    queryFn: () => fetchSettlements(dateRange),
  });

  const { data: disputes = [], isLoading: disputesLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: fetchDisputes,
  });

  // Computed metrics
  const metrics = useMemo((): PaymentMetrics => {
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = transactions.reduce((sum, t) => sum + t.fees, 0);
    const successRate = transactions.length > 0 ? (completedTransactions.length / transactions.length) * 100 : 0;
    
    return {
      totalRevenue,
      transactionCount: transactions.length,
      averageTransaction: transactions.length > 0 ? totalRevenue / completedTransactions.length : 0,
      successRate,
      pendingSettlements: settlements.filter(s => s.status === 'pending').length,
      activeDisputes: disputes.filter(d => ['open', 'under_review'].includes(d.status)).length,
      refundAmount: disputes.reduce((sum, d) => sum + d.amount, 0),
      processingFees: totalFees,
    };
  }, [transactions, settlements, disputes]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = searchQuery === '' || 
        transaction.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.customer_email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  const handleExportData = (type: string) => {
    const data = type === 'transactions' ? transactions : 
                 type === 'settlements' ? settlements : disputes;
    onExportData?.(data, type);
  };

  if (transactionsLoading || settlementsLoading || disputesLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Management</h1>
          <p className="text-muted-foreground">
            Monitor transactions, settlements, and financial metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => handleExportData('transactions')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <PaymentMetricsCards metrics={metrics} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search