'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  DollarSign,
  Activity,
  MapPin,
  Download,
  Filter,
  Calendar,
  Users,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { DateRange } from 'react-day-picker'

// Types and Interfaces
interface PaymentMetrics {
  totalRevenue: number
  totalTransactions: number
  successRate: number
  averageTransactionValue: number
  currency: string
  period: string
}

interface TransactionVolume {
  date: string
  volume: number
  amount: number
  successful: number
  failed: number
}

interface PaymentMethod {
  method: string
  count: number
  percentage: number
  revenue: number
  color: string
}

interface GeographicData {
  country: string
  countryCode: string
  transactions: number
  revenue: number
  coordinates: [number, number]
}

interface PaymentAnalyticsProps {
  className?: string
  dateRange?: DateRange
  refreshInterval?: number
  onDateRangeChange?: (range: DateRange | undefined) => void
  onExportData?: (data: any, format: 'csv' | 'pdf') => void
}

// Mock data generators
const generateTransactionVolume = (days: number): TransactionVolume[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
    const volume = Math.floor(Math.random() * 1000) + 500
    const successful = Math.floor(volume * (0.85 + Math.random() * 0.1))
    const failed = volume - successful
    return {
      date,
      volume,
      amount: volume * (50 + Math.random() * 200),
      successful,
      failed
    }
  })
}

const generatePaymentMethods = (): PaymentMethod[] => [
  { method: 'Credit Card', count: 2450, percentage: 45.2, revenue: 245000, color: '#3b82f6' },
  { method: 'PayPal', count: 1230, percentage: 22.7, revenue: 123000, color: '#10b981' },
  { method: 'Bank Transfer', count: 890, percentage: 16.4, revenue: 178000, color: '#f59e0b' },
  { method: 'Digital Wallet', count: 560, percentage: 10.3, revenue: 67000, color: '#8b5cf6' },
  { method: 'Cryptocurrency', count: 295, percentage: 5.4, revenue: 89000, color: '#ef4444' }
]

const generateGeographicData = (): GeographicData[] => [
  { country: 'United States', countryCode: 'US', transactions: 3200, revenue: 456000, coordinates: [-95.7129, 37.0902] },
  { country: 'United Kingdom', countryCode: 'GB', transactions: 1800, revenue: 287000, coordinates: [-2.5, 54.0] },
  { country: 'Germany', countryCode: 'DE', transactions: 1500, revenue: 234000, coordinates: [10.4515, 51.1657] },
  { country: 'France', countryCode: 'FR', transactions: 1200, revenue: 198000, coordinates: [2.2137, 46.2276] },
  { country: 'Canada', countryCode: 'CA', transactions: 980, revenue: 145000, coordinates: [-106.3468, 56.1304] },
  { country: 'Australia', countryCode: 'AU', transactions: 750, revenue: 123000, coordinates: [133.7751, -25.2744] },
  { country: 'Japan', countryCode: 'JP', transactions: 650, revenue: 198000, coordinates: [138.2529, 36.2048] },
  { country: 'Brazil', countryCode: 'BR', transactions: 540, revenue: 87000, coordinates: [-51.9253, -14.2351] }
]

// Subcomponents
const MetricsOverview: React.FC<{ metrics: PaymentMetrics; previousMetrics: PaymentMetrics }> = ({
  metrics,
  previousMetrics
}) => {
  const calculateGrowth = (current: number, previous: number) => {
    return previous > 0 ? ((current - previous) / previous) * 100 : 0
  }

  const revenueGrowth = calculateGrowth(metrics.totalRevenue, previousMetrics.totalRevenue)
  const transactionGrowth = calculateGrowth(metrics.totalTransactions, previousMetrics.totalTransactions)
  const successRateChange = metrics.successRate - previousMetrics.successRate

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.currency} {metrics.totalRevenue.toLocaleString()}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            {revenueGrowth >= 0 ? (
              <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
            )}
            <span className={revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(revenueGrowth).toFixed(1)}% from last period
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalTransactions.toLocaleString()}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            {transactionGrowth >= 0 ? (
              <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
            )}
            <span className={transactionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(transactionGrowth).toFixed(1)}% from last period
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
          <div className="flex items-center text-xs text-muted-foreground">
            {successRateChange >= 0 ? (
              <CheckCircle className="mr-1 h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="mr-1 h-4 w-4 text-red-500" />
            )}
            <span className={successRateChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(successRateChange).toFixed(1)}% from last period
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Transaction Value</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.currency} {metrics.averageTransactionValue.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">Based on successful transactions</p>
        </CardContent>
      </Card>
    </div>
  )
}

const TransactionVolumeChart: React.FC<{ data: TransactionVolume[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Volume Over Time</CardTitle>
        <CardDescription>Daily transaction counts and success rates</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="successful"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.6}
              name="Successful"
            />
            <Area
              type="monotone"
              dataKey="failed"
              stackId="1"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
              name="Failed"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const SuccessRateChart: React.FC<{ data: TransactionVolume[] }> = ({ data }) => {
  const successRateData = data.map(item => ({
    ...item,
    successRate: (item.successful / item.volume) * 100
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Success Rate Trend</CardTitle>
        <CardDescription>Transaction success rate percentage over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={successRateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            />
            <YAxis domain={[80, 100]} />
            <Tooltip
              labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Success Rate']}
            />
            <Line
              type="monotone"
              dataKey="successRate"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const PaymentMethodBreakdown: React.FC<{ data: PaymentMethod[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method Distribution</CardTitle>
        <CardDescription>Breakdown by payment method and revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                label={({ method, percentage }) => `${method}: ${percentage}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {data.map((method, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }} />
                  <span className="font-medium">{method.method}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{method.count.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">${method.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const GeographicDistributionMap: React.FC<{ data: GeographicData[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution</CardTitle>
        <CardDescription>Transaction volume by country</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {data.slice(0, 6).map((country, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{country.countryCode}</Badge>
                  <span className="font-medium">{country.country}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{country.transactions.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">${country.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.slice(0, 6)} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="countryCode" type="category" width={40} />
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Bar dataKey="transactions" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

const FilterPanel: React.FC<{
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  selectedMetric: string
  onMetricChange: (metric: string) => void
  selectedRegion: string
  onRegionChange: (region: string) => void
}> = ({ dateRange, onDateRangeChange, selectedMetric, onMetricChange, selectedRegion, onRegionChange }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters & Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Date Range</label>
          <DatePickerWithRange date={dateRange} onDateChange={onDateRangeChange} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Primary Metric</label>
          <Select value={selectedMetric} onValueChange={onMetricChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="volume">Transaction Volume</SelectItem>
              <SelectItem value="success-rate">Success Rate</SelectItem>
              <SelectItem value="avg-value">Average Value</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Region</label>
          <Select value={selectedRegion} onValueChange={onRegionChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="north-america">North America</SelectItem>
              <SelectItem value="europe">Europe</SelectItem>
              <SelectItem value="asia-pacific">Asia Pacific</SelectItem>
              <SelectItem value="latin-america">Latin America</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Component
export const PaymentAnalyticsDashboard: React.FC<PaymentAnalyticsProps> = ({
  className = '',
  dateRange: initialDateRange,
  refreshInterval = 30000,
  onDateRangeChange,
  onExportData
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialDateRange || {
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date())
    }
  )
  const [selectedMetric, setSelectedMetric] = useState('revenue')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [isLoading, setIsLoading] = useState(false)

  // Mock data - in real implementation, this would come from API calls
  const transactionVolumeData = useMemo(() => generateTransactionVolume(30), [dateRange])
  const paymentMethodData = useMemo(() => generatePaymentMethods(), [dateRange])
  const geographicData = useMemo(() => generateGeographicData(), [dateRange])

  const currentMetrics: PaymentMetrics = {
    totalRevenue: 1256789,
    totalTransactions: 8945,
    successRate: 94.2,
    averageTransactionValue: 140.45,
    currency: 'USD',
    period: 'Last 30 days'
  }

  const previousMetrics: PaymentMetrics = {
    totalRevenue: 1123456,
    totalTransactions: 7834,
    successRate: 92.8,
    averageTransactionValue: 143.21,
    currency: 'USD',
    period: 'Previous 30 days'
  }

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    setDateRange(newRange)
    onDateRangeChange?.(newRange)
  }

  const handleExportData = (format: 'csv' | 'pdf') => {
    const data = {
      metrics: currentMetrics,
      transactions: transactionVolumeData,
      paymentMethods: paymentMethodData,
      geographic: geographicData,
      dateRange,
      exportedAt: new Date().toISOString()
    }
    onExportData?.(data, format)
  }

  // Auto-refresh functionality
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        // In real implementation, trigger data refresh here
        console.log('Refreshing payment analytics data...')
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [refreshInterval])

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive overview of payment performance and metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExportData('csv')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportData('pdf')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {format(new Date(), 'HH:mm:ss')}
          </Badge>
        </div>
      </div>

      {/* Metrics Overview */}
      <MetricsOverview metrics={currentMetrics} previousMetrics={previousMetrics} />

      {/* Main Dashboard Grid */}
      <div className="grid gap