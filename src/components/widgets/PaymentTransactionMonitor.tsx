"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  Search, 
  Eye,
  TrendingUp,
  DollarSign,
  Activity,
  Users
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// Types
interface Transaction {
  id: string
  amount: number
  currency: string
  status: 'success' | 'failed' | 'pending' | 'cancelled'
  paymentMethod: string
  region: string
  merchantId: string
  merchantName: string
  timestamp: string
  processingTime: number
  errorCode?: string
  errorMessage?: string
  userId: string
  cardLast4?: string
  networkFee: number
}

interface Alert {
  id: string
  type: 'high_failure_rate' | 'unusual_volume' | 'security_concern' | 'system_error'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  timestamp: string
  resolved: boolean
  affectedTransactions: number
}

interface Metrics {
  totalVolume: number
  totalAmount: number
  successRate: number
  averageAmount: number
  averageProcessingTime: number
  activeUsers: number
  topPaymentMethods: Array<{ method: string; count: number; percentage: number }>
  hourlyData: Array<{ time: string; volume: number; successRate: number; amount: number }>
}

interface PaymentTransactionMonitorProps {
  className?: string
  refreshInterval?: number
  maxTransactions?: number
  enableRealtime?: boolean
}

interface Filters {
  status: string[]
  paymentMethod: string[]
  region: string[]
  dateRange: string
  amountRange: { min: number; max: number }
}

export default function PaymentTransactionMonitor({
  className = '',
  refreshInterval = 30000,
  maxTransactions = 100,
  enableRealtime = true
}: PaymentTransactionMonitorProps) {
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [filters, setFilters] = useState<Filters>({
    status: [],
    paymentMethod: [],
    region: [],
    dateRange: '24h',
    amountRange: { min: 0, max: 100000 }
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock data generation (in real app, this would be replaced with API calls)
  const generateMockData = (): { transactions: Transaction[]; alerts: Alert[]; metrics: Metrics } => {
    const paymentMethods = ['visa', 'mastercard', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer']
    const regions = ['US', 'EU', 'APAC', 'LATAM', 'MEA']
    const statuses: Transaction['status'][] = ['success', 'failed', 'pending', 'cancelled']
    
    const mockTransactions: Transaction[] = Array.from({ length: maxTransactions }, (_, i) => ({
      id: `tx_${Date.now()}_${i}`,
      amount: Math.floor(Math.random() * 10000) + 10,
      currency: 'USD',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      merchantId: `merchant_${Math.floor(Math.random() * 100)}`,
      merchantName: `Merchant ${Math.floor(Math.random() * 100)}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      processingTime: Math.floor(Math.random() * 5000) + 100,
      userId: `user_${Math.floor(Math.random() * 1000)}`,
      cardLast4: Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
      networkFee: Math.floor(Math.random() * 50) + 5,
      ...(Math.random() > 0.8 && {
        errorCode: 'CARD_DECLINED',
        errorMessage: 'Insufficient funds'
      })
    }))

    const mockAlerts: Alert[] = [
      {
        id: 'alert_1',
        type: 'high_failure_rate',
        severity: 'high',
        title: 'High Failure Rate Detected',
        message: 'Payment success rate dropped to 85% in the last hour',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: false,
        affectedTransactions: 45
      },
      {
        id: 'alert_2',
        type: 'unusual_volume',
        severity: 'medium',
        title: 'Unusual Transaction Volume',
        message: 'Transaction volume 150% above normal for this time period',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        resolved: true,
        affectedTransactions: 0
      }
    ]

    const successfulTransactions = mockTransactions.filter(t => t.status === 'success')
    const mockMetrics: Metrics = {
      totalVolume: mockTransactions.length,
      totalAmount: mockTransactions.reduce((sum, t) => sum + t.amount, 0),
      successRate: (successfulTransactions.length / mockTransactions.length) * 100,
      averageAmount: mockTransactions.reduce((sum, t) => sum + t.amount, 0) / mockTransactions.length,
      averageProcessingTime: mockTransactions.reduce((sum, t) => sum + t.processingTime, 0) / mockTransactions.length,
      activeUsers: new Set(mockTransactions.map(t => t.userId)).size,
      topPaymentMethods: paymentMethods.map(method => {
        const count = mockTransactions.filter(t => t.paymentMethod === method).length
        return {
          method,
          count,
          percentage: (count / mockTransactions.length) * 100
        }
      }).sort((a, b) => b.count - a.count),
      hourlyData: Array.from({ length: 24 }, (_, i) => ({
        time: `${23 - i}:00`,
        volume: Math.floor(Math.random() * 100) + 50,
        successRate: 85 + Math.random() * 15,
        amount: Math.floor(Math.random() * 50000) + 10000
      })).reverse()
    }

    return { transactions: mockTransactions, alerts: mockAlerts, metrics: mockMetrics }
  }

  // Data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // In real implementation, this would be API calls
        const data = generateMockData()
        setTransactions(data.transactions)
        setAlerts(data.alerts)
        setMetrics(data.metrics)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    
    if (enableRealtime) {
      const interval = setInterval(fetchData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, enableRealtime, maxTransactions])

  // Filter transactions based on current filters and search
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(transaction.status)) {
        return false
      }
      
      // Payment method filter
      if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(transaction.paymentMethod)) {
        return false
      }
      
      // Region filter
      if (filters.region.length > 0 && !filters.region.includes(transaction.region)) {
        return false
      }
      
      // Amount range filter
      if (transaction.amount < filters.amountRange.min || transaction.amount > filters.amountRange.max) {
        return false
      }
      
      // Search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          transaction.id.toLowerCase().includes(searchLower) ||
          transaction.merchantName.toLowerCase().includes(searchLower) ||
          transaction.userId.toLowerCase().includes(searchLower)
        )
      }
      
      return true
    })
  }, [transactions, filters, searchTerm])

  // Component helpers
  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getAlertSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  if (isLoading && !metrics) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Error loading payment data: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Metrics Overview */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalVolume.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">transactions</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">processed today</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
              <Progress value={metrics.successRate} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">unique users</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Active Alerts</span>
              <Badge variant="destructive">{alerts.filter(a => !a.resolved).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg border ${alert.resolved ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge className={getAlertSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(alert.timestamp)}
                        {alert.affectedTransactions > 0 && (
                          <span> • {alert.affectedTransactions} transactions affected</span>
                        )}
                      </p>
                    </div>
                    {alert.resolved && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transaction Flow Chart */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Transaction Flow (24h)</CardTitle>
              <CardDescription>Hourly transaction volume and success rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Volume"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="successRate" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Success Rate (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Methods Distribution */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Distribution of payment methods used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.topPaymentMethods.slice(0, 5).map((method, index) => (
                  <div key={method.method} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4" />
                      <span className="capitalize">{method.method.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={method.percentage} className="w-20" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {method.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transaction Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                {filteredTransactions.length} of {transactions.length} transactions
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.slice(0, 50).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-sm">
                      {transaction.id.substring(0, 16)}...
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(transaction.status)}>
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1 capitalize">{transaction.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {transaction.pay