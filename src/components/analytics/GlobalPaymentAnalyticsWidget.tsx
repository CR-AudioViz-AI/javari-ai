```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Globe,
  DollarSign,
  Activity,
  Download,
  Filter,
  RefreshCw,
  MapPin,
  CreditCard,
  BarChart3,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

// Types and Interfaces
interface PaymentData {
  id: string
  amount: number
  currency: string
  country: string
  region: string
  status: 'completed' | 'pending' | 'failed'
  method: string
  timestamp: string
  merchantId: string
}

interface PaymentTrend {
  date: string
  volume: number
  amount: number
  transactions: number
}

interface CurrencyMetrics {
  code: string
  name: string
  volume: number
  change: number
  transactions: number
  avgAmount: number
}

interface RegionalData {
  region: string
  country: string
  volume: number
  transactions: number
  growthRate: number
  marketShare: number
  coordinates: [number, number]
}

interface FilterState {
  dateRange: DateRange | undefined
  currencies: string[]
  regions: string[]
  paymentMethods: string[]
  status: string[]
}

interface GlobalPaymentAnalyticsWidgetProps {
  className?: string
  refreshInterval?: number
  defaultFilters?: Partial<FilterState>
  onDataExport?: (data: PaymentData[], format: 'csv' | 'pdf') => Promise<void>
  onFilterChange?: (filters: FilterState) => void
}

// Mock data generators for demonstration
const generatePaymentTrends = (days: number): PaymentTrend[] => {
  const trends: PaymentTrend[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    trends.push({
      date,
      volume: Math.floor(Math.random() * 1000000) + 500000,
      amount: Math.floor(Math.random() * 50000000) + 10000000,
      transactions: Math.floor(Math.random() * 5000) + 2000
    })
  }
  return trends
}

const generateCurrencyMetrics = (): CurrencyMetrics[] => [
  { code: 'USD', name: 'US Dollar', volume: 45000000, change: 2.3, transactions: 15000, avgAmount: 3000 },
  { code: 'EUR', name: 'Euro', volume: 32000000, change: -1.2, transactions: 12000, avgAmount: 2667 },
  { code: 'GBP', name: 'British Pound', volume: 18000000, change: 1.8, transactions: 8000, avgAmount: 2250 },
  { code: 'JPY', name: 'Japanese Yen', volume: 25000000, change: 0.5, transactions: 10000, avgAmount: 2500 },
  { code: 'CAD', name: 'Canadian Dollar', volume: 12000000, change: -0.8, transactions: 6000, avgAmount: 2000 },
  { code: 'AUD', name: 'Australian Dollar', volume: 9000000, change: 3.1, transactions: 4500, avgAmount: 2000 }
]

const generateRegionalData = (): RegionalData[] => [
  { region: 'North America', country: 'United States', volume: 45000000, transactions: 15000, growthRate: 12.5, marketShare: 35.2, coordinates: [-95.7129, 37.0902] },
  { region: 'Europe', country: 'Germany', volume: 32000000, transactions: 12000, growthRate: 8.3, marketShare: 25.0, coordinates: [10.4515, 51.1657] },
  { region: 'Asia Pacific', country: 'Japan', volume: 25000000, transactions: 10000, growthRate: 15.7, marketShare: 19.5, coordinates: [138.2529, 36.2048] },
  { region: 'Europe', country: 'United Kingdom', volume: 18000000, transactions: 8000, growthRate: 6.2, marketShare: 14.1, coordinates: [-3.4360, 55.3781] },
  { region: 'North America', country: 'Canada', volume: 12000000, transactions: 6000, growthRate: 9.8, marketShare: 9.4, coordinates: [-106.3468, 68.7755] },
  { region: 'Oceania', country: 'Australia', volume: 9000000, transactions: 4500, growthRate: 11.2, marketShare: 7.0, coordinates: [133.7751, -25.2744] }
]

// Sub-components
const RealTimeIndicator: React.FC<{ isConnected: boolean; lastUpdate: Date | null }> = ({ isConnected, lastUpdate }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Circle className={cn("h-2 w-2 fill-current", isConnected ? "text-green-500" : "text-red-500")} />
    <span>{isConnected ? 'Live' : 'Disconnected'}</span>
    {lastUpdate && (
      <span className="text-xs">
        Updated {format(lastUpdate, 'HH:mm:ss')}
      </span>
    )}
  </div>
)

const PaymentMetricsCards: React.FC<{ data: PaymentTrend[] }> = ({ data }) => {
  const latestData = data[data.length - 1]
  const previousData = data[data.length - 2]
  
  const metrics = [
    {
      title: 'Total Volume',
      value: latestData?.volume || 0,
      change: latestData && previousData ? ((latestData.volume - previousData.volume) / previousData.volume) * 100 : 0,
      icon: DollarSign,
      format: (val: number) => `$${(val / 1000000).toFixed(1)}M`
    },
    {
      title: 'Transactions',
      value: latestData?.transactions || 0,
      change: latestData && previousData ? ((latestData.transactions - previousData.transactions) / previousData.transactions) * 100 : 0,
      icon: CreditCard,
      format: (val: number) => val.toLocaleString()
    },
    {
      title: 'Avg Amount',
      value: latestData ? latestData.amount / latestData.transactions : 0,
      change: 0,
      icon: Wallet,
      format: (val: number) => `$${val.toFixed(0)}`
    },
    {
      title: 'Success Rate',
      value: 96.8,
      change: 0.5,
      icon: Activity,
      format: (val: number) => `${val.toFixed(1)}%`
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        const isPositive = metric.change > 0
        
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.format(metric.value)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {isPositive ? (
                  <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={cn(isPositive ? "text-green-500" : "text-red-500")}>
                  {Math.abs(metric.change).toFixed(1)}%
                </span>
                <span className="ml-1">from yesterday</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

const PaymentTrendsChart: React.FC<{ data: PaymentTrend[] }> = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Payment Trends
      </CardTitle>
      <CardDescription>Volume and transaction trends over time</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
              formatter={(value: number, name: string) => [
                name === 'volume' ? `$${(value / 1000000).toFixed(1)}M` : value.toLocaleString(),
                name === 'volume' ? 'Volume' : 'Transactions'
              ]}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="volume"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
              name="Volume"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="transactions"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={false}
              name="Transactions"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
)

const CurrencyPerformanceGrid: React.FC<{ data: CurrencyMetrics[] }> = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Globe className="h-5 w-5" />
        Currency Performance
      </CardTitle>
      <CardDescription>Volume and performance by currency</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {data.map((currency) => (
          <div key={currency.code} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                {currency.code}
              </div>
              <div>
                <div className="font-medium">{currency.name}</div>
                <div className="text-sm text-muted-foreground">
                  {currency.transactions.toLocaleString()} transactions
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">${(currency.volume / 1000000).toFixed(1)}M</div>
              <div className="flex items-center gap-1 text-sm">
                {currency.change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={cn(currency.change > 0 ? "text-green-500" : "text-red-500")}>
                  {Math.abs(currency.change).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)

const RegionalInsightsMap: React.FC<{ data: RegionalData[] }> = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Regional Insights
      </CardTitle>
      <CardDescription>Payment distribution and growth by region</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {data.map((region, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium">{region.country}</div>
              <div className="text-sm text-muted-foreground">{region.region}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">${(region.volume / 1000000).toFixed(1)}M</div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{region.marketShare.toFixed(1)}%</Badge>
                <span className="text-green-500">+{region.growthRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
          <span className="text-muted-foreground">Interactive map would be rendered here</span>
        </div>
      </div>
    </CardContent>
  </Card>
)

const FilterPanel: React.FC<{
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  currencies: string[]
  regions: string[]
}> = ({ filters, onFiltersChange, currencies, regions }) => {
  const [searchCurrency, setSearchCurrency] = useState('')
  
  const filteredCurrencies = currencies.filter(currency =>
    currency.toLowerCase().includes(searchCurrency.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="date-range">Date Range</Label>
          <DatePickerWithRange
            id="date-range"
            date={filters.dateRange}
            onDateChange={(dateRange) =>
              onFiltersChange({ ...filters, dateRange })
            }
          />
        </div>
        
        <div>
          <Label htmlFor="currency-search">Currencies</Label>
          <Input
            id="currency-search"
            placeholder="Search currencies..."
            value={searchCurrency}
            onChange={(e) => setSearchCurrency(e.target.value)}
            className="mb-2"
          />
          <ScrollArea className="h-32 border rounded p-2">
            {filteredCurrencies.map((currency) => (
              <div key={currency} className="flex items-center space-x-2 py-1">
                <input
                  type="checkbox"
                  id={`currency-${currency}`}
                  checked={filters.currencies.includes(currency)}
                  onChange={(e) => {
                    const newCurrencies = e.target.checked
                      ? [...filters.currencies, currency]
                      : filters.currencies.filter(c => c !== currency)
                    onFiltersChange({ ...filters, currencies: newCurrencies })
                  }}
                  className="rounded"
                />
                <Label htmlFor={`currency-${currency}`} className="text-sm">
                  {currency}
                </Label>
              </div>
            ))}
          </ScrollArea>
        </div>

        <div>
          <Label htmlFor="region-select">Region</Label>
          <Select
            value={filters.regions.join(',')}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, regions: value ? value.split(',') : [] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select regions..." />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status-select">Payment Status</Label>
          <Select
            value={filters.status.join(',')}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, status: value ? value.split(',') : [] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

const ExportControls: React.FC<{
  onExport: (format: 'csv' | 'pdf') => Promise<void>
  isExporting: boolean
}> = ({ onExport, isExporting }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Download className="h-5 w-5" />
        Export Data
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => onExport('csv')}
        disabled={isExporting}
      >
        Export as CSV
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => onExport('pdf')}
        disabled={isExporting}
      >
        Export as PDF
      </Button>
    </CardContent>
  </Card>
)

// Main Component
export const GlobalPaymentAnalyticsWidget: React.FC<GlobalPaymentAnalyticsWidgetProps> = ({
  className,
  refreshInterval = 30000,
  defaultFilters,
  onDataExport,
  onFilterChange
}) => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date()
    },
    currencies: ['USD', 'EUR', 'GBP'],
    regions: [],
    paymentMethods: [],
    status: ['completed'],
    ...defaultFilters
  })

  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Mock data - in real implementation, this would come from API/WebSocket
  const paymentTrends = useMemo(() => generatePaymentTrends(30), [])
  const currencyMetrics = useMemo(() => generateCurrencyMetrics(), [])
  const regionalData = useMemo(() => generateRegionalData(), [])

  const availableCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK']
  const availableRegions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East', 'Africa', 'Oceania']

  // Real-time connection simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      // Simulate occasional connection issues
      setIsConnected(Math.random() > 0.1)
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }, [onFilterChange])

  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      // Mock export - in real implementation, would generate actual files
      await new Promise(resolve => setTimeout(resolve, 2000))
      onDataExport?.([], format)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [onDataExport])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Mock refresh - in real implementation, would refetch data
      await new Promise(resolve => setTimeout(resolve, 1000))
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", className)}>
        {/* Header */}
        <div className="flex