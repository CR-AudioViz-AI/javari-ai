```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Globe, 
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  MapPin,
  Zap,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface PaymentTransaction {
  id: string
  amount: number
  currency: string
  status: 'success' | 'failed' | 'pending'
  payment_method: string
  processor: string
  country: string
  region: string
  fees: number
  created_at: string
}

interface PaymentAnalytics {
  totalRevenue: number
  totalTransactions: number
  successRate: number
  averageTransactionValue: number
  totalFees: number
  topCountries: Array<{ country: string; revenue: number; transactions: number }>
  paymentMethods: Array<{ method: string; percentage: number; success_rate: number }>
  monthlyTrends: Array<{ month: string; revenue: number; transactions: number; fees: number }>
  processorPerformance: Array<{ processor: string; success_rate: number; avg_fee: number }>
  geographicData: Array<{ country: string; lat: number; lng: number; revenue: number; transactions: number }>
}

interface OptimizationRecommendation {
  id: string
  type: 'fee_optimization' | 'processor_switch' | 'geographic_expansion' | 'payment_method'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  potential_savings: number
  implementation_effort: 'easy' | 'medium' | 'complex'
}

interface PaymentAnalyticsWidgetProps {
  className?: string
  dateRange?: string
  region?: string
  currency?: string
  onDateRangeChange?: (range: string) => void
  onRegionChange?: (region: string) => void
  onCurrencyChange?: (currency: string) => void
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#82d982']

const PaymentAnalyticsWidget: React.FC<PaymentAnalyticsWidgetProps> = ({
  className,
  dateRange = '30d',
  region = 'all',
  currency = 'all',
  onDateRangeChange,
  onRegionChange,
  onCurrencyChange
}) => {
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null)
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Mock data for demonstration
  const mockAnalytics: PaymentAnalytics = {
    totalRevenue: 2456789.50,
    totalTransactions: 15847,
    successRate: 97.8,
    averageTransactionValue: 155.12,
    totalFees: 49135.79,
    topCountries: [
      { country: 'United States', revenue: 1234567, transactions: 7823 },
      { country: 'United Kingdom', revenue: 456789, transactions: 2941 },
      { country: 'Germany', revenue: 345678, transactions: 2234 },
      { country: 'Canada', revenue: 234567, transactions: 1512 },
      { country: 'Australia', revenue: 185234, transactions: 1337 }
    ],
    paymentMethods: [
      { method: 'Credit Card', percentage: 45.2, success_rate: 98.1 },
      { method: 'Digital Wallet', percentage: 28.7, success_rate: 99.3 },
      { method: 'Bank Transfer', percentage: 15.6, success_rate: 96.8 },
      { method: 'Buy Now Pay Later', percentage: 7.3, success_rate: 94.5 },
      { method: 'Cryptocurrency', percentage: 3.2, success_rate: 92.1 }
    ],
    monthlyTrends: [
      { month: 'Jan', revenue: 198000, transactions: 1280, fees: 3960 },
      { month: 'Feb', revenue: 215000, transactions: 1387, fees: 4300 },
      { month: 'Mar', revenue: 232000, transactions: 1495, fees: 4640 },
      { month: 'Apr', revenue: 201000, transactions: 1296, fees: 4020 },
      { month: 'May', revenue: 245000, transactions: 1580, fees: 4900 },
      { month: 'Jun', revenue: 268000, transactions: 1728, fees: 5360 }
    ],
    processorPerformance: [
      { processor: 'Stripe', success_rate: 98.5, avg_fee: 2.9 },
      { processor: 'PayPal', success_rate: 97.2, avg_fee: 3.4 },
      { processor: 'Square', success_rate: 98.1, avg_fee: 2.6 },
      { processor: 'Adyen', success_rate: 98.8, avg_fee: 2.8 }
    ],
    geographicData: [
      { country: 'United States', lat: 39.8283, lng: -98.5795, revenue: 1234567, transactions: 7823 },
      { country: 'United Kingdom', lat: 55.3781, lng: -3.4360, revenue: 456789, transactions: 2941 },
      { country: 'Germany', lat: 51.1657, lng: 10.4515, revenue: 345678, transactions: 2234 },
      { country: 'Canada', lat: 56.1304, lng: -106.3468, revenue: 234567, transactions: 1512 }
    ]
  }

  const mockRecommendations: OptimizationRecommendation[] = [
    {
      id: '1',
      type: 'processor_switch',
      title: 'Switch to Lower-Fee Processor in EU',
      description: 'Switch European transactions from PayPal to Adyen to reduce processing fees by 0.6%',
      impact: 'high',
      potential_savings: 2745.60,
      implementation_effort: 'medium'
    },
    {
      id: '2',
      type: 'payment_method',
      title: 'Promote Digital Wallet Usage',
      description: 'Increase digital wallet adoption with 2% discount to improve success rates',
      impact: 'medium',
      potential_savings: 1890.30,
      implementation_effort: 'easy'
    },
    {
      id: '3',
      type: 'geographic_expansion',
      title: 'Expand to Asian Markets',
      description: 'High revenue potential in Singapore and Hong Kong based on regional analysis',
      impact: 'high',
      potential_savings: 45000.00,
      implementation_effort: 'complex'
    }
  ]

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        setAnalytics(mockAnalytics)
        setRecommendations(mockRecommendations)
      } catch (err) {
        setError('Failed to load payment analytics data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [dateRange, region, currency])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      // Simulate refresh
      await new Promise(resolve => setTimeout(resolve, 500))
      setAnalytics({ ...mockAnalytics })
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 98) return 'text-green-600'
    if (rate >= 95) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'complex': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Payment Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !analytics) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Payment Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || 'Failed to load analytics data'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Payment Analytics
              </CardTitle>
              <CardDescription>
                Comprehensive payment performance and optimization insights
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateRange} onValueChange={onDateRangeChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={region} onValueChange={onRegionChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="na">North America</SelectItem>
                  <SelectItem value="eu">Europe</SelectItem>
                  <SelectItem value="asia">Asia Pacific</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">+12.5% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className={cn('text-2xl font-bold', getSuccessRateColor(analytics.successRate))}>
                  {formatPercentage(analytics.successRate)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <Progress value={analytics.successRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{analytics.totalTransactions.toLocaleString()}</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-sm text-green-600">+8.3% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(analytics.totalFees)}</p>
              </div>
              <Target className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex items-center mt-2">
              <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
              <span className="text-sm text-red-600">2.1% of revenue</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="processors">Processors</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue and transaction volume</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'revenue' ? formatCurrency(value as number) : value,
                        name === 'revenue' ? 'Revenue' : name === 'transactions' ? 'Transactions' : 'Fees'
                      ]}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="transactions"
                      stackId="2"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Countries */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Countries</CardTitle>
                <CardDescription>Revenue by geographic region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topCountries.map((country, index) => (
                    <div key={country.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{country.country}</p>
                          <p className="text-sm text-muted-foreground">
                            {country.transactions.toLocaleString()} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(country.revenue)}</p>
                        <Progress 
                          value={(country.revenue / analytics.totalRevenue) * 100} 
                          className="w-20 h-2 mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="methods" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Method Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Method Distribution</CardTitle>
                <CardDescription>Transaction volume by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.paymentMethods}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="percentage"
                      label={({ method, percentage }) => `${method}: ${percentage}%`}
                    >
                      {analytics.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Method Success Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rates by Method</CardTitle>
                <CardDescription>Payment success rates and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.paymentMethods.map((method) => (
                    <div key={method.method} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{method.method}</span>
                        <span className={cn('text-sm font-medium', getSuccessRateColor(method.success_rate))}>
                          {formatPercentage(method.success_rate)}
                        </span>
                      </div>
                      <Progress value={method.