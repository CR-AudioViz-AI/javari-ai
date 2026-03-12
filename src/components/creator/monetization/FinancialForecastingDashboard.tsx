```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
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
  Calendar, 
  Download, 
  Settings, 
  Calculator,
  CreditCard,
  PiggyBank,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink
} from 'lucide-react'
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns'

// Types
interface RevenueStream {
  id: string
  name: string
  category: 'subscription' | 'one-time' | 'recurring' | 'commission'
  currentMonthly: number
  growthRate: number
  seasonality: number[]
  color: string
}

interface FinancialData {
  date: string
  revenue: number
  expenses: number
  profit: number
  taxLiability: number
  cashFlow: number
}

interface GrowthOpportunity {
  id: string
  title: string
  description: string
  potentialRevenue: number
  timeframe: string
  effort: 'low' | 'medium' | 'high'
  confidence: number
}

interface TaxCalculation {
  quarterlyEstimate: number
  annualProjection: number
  deductions: number
  effectiveRate: number
}

interface Props {
  creatorId: string
  className?: string
  onExportData?: (data: any) => void
  onConnectTool?: (tool: string) => void
}

export default function FinancialForecastingDashboard({
  creatorId,
  className = '',
  onExportData,
  onConnectTool
}: Props) {
  // State
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m' | '24m'>('12m')
  const [activeTab, setActiveTab] = useState('overview')
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revenueStreams, setRevenueStreams] = useState<RevenueStream[]>([])
  const [historicalData, setHistoricalData] = useState<FinancialData[]>([])
  const [projectedData, setProjectedData] = useState<FinancialData[]>([])
  const [growthOpportunities, setGrowthOpportunities] = useState<GrowthOpportunity[]>([])
  const [taxCalculations, setTaxCalculations] = useState<TaxCalculation>({
    quarterlyEstimate: 0,
    annualProjection: 0,
    deductions: 0,
    effectiveRate: 0
  })

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock revenue streams
      setRevenueStreams([
        {
          id: '1',
          name: 'Spotify Streaming',
          category: 'recurring',
          currentMonthly: 1200,
          growthRate: 15,
          seasonality: [0.8, 0.9, 1.1, 1.2, 1.3, 1.1, 0.9, 0.8, 1.0, 1.2, 1.4, 1.6],
          color: '#1DB954'
        },
        {
          id: '2',
          name: 'Brand Partnerships',
          category: 'one-time',
          currentMonthly: 2500,
          growthRate: 25,
          seasonality: [1.0, 1.0, 1.2, 1.1, 1.0, 0.8, 0.7, 0.8, 1.1, 1.3, 1.5, 1.8],
          color: '#FF6B35'
        },
        {
          id: '3',
          name: 'Fan Subscriptions',
          category: 'subscription',
          currentMonthly: 800,
          growthRate: 30,
          seasonality: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
          color: '#4ECDC4'
        }
      ])

      // Generate historical and projected data
      const historical = generateHistoricalData()
      const projected = generateProjectedData(historical)
      
      setHistoricalData(historical)
      setProjectedData(projected)

      // Mock growth opportunities
      setGrowthOpportunities([
        {
          id: '1',
          title: 'Launch Premium Tier',
          description: 'Introduce $9.99/month premium subscription with exclusive content',
          potentialRevenue: 1500,
          timeframe: '3-6 months',
          effort: 'medium',
          confidence: 85
        },
        {
          id: '2',
          title: 'Expand to YouTube Music',
          description: 'Distribute music to YouTube Music platform',
          potentialRevenue: 600,
          timeframe: '1-2 months',
          effort: 'low',
          confidence: 90
        },
        {
          id: '3',
          title: 'Virtual Concert Series',
          description: 'Monthly virtual concerts with ticket sales',
          potentialRevenue: 3000,
          timeframe: '6-12 months',
          effort: 'high',
          confidence: 70
        }
      ])

      // Mock tax calculations
      setTaxCalculations({
        quarterlyEstimate: 3200,
        annualProjection: 12800,
        deductions: 4500,
        effectiveRate: 22.5
      })

      setLoading(false)
    }

    fetchData()
  }, [creatorId])

  // Generate mock data functions
  const generateHistoricalData = (): FinancialData[] => {
    const data: FinancialData[] = []
    const now = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const date = format(addMonths(now, -i), 'yyyy-MM')
      const baseRevenue = 3000 + (Math.random() - 0.5) * 500
      const revenue = Math.round(baseRevenue * (1 + (11 - i) * 0.05))
      const expenses = Math.round(revenue * 0.3)
      const profit = revenue - expenses
      const taxLiability = Math.round(profit * 0.25)
      const cashFlow = profit - taxLiability
      
      data.push({
        date,
        revenue,
        expenses,
        profit,
        taxLiability,
        cashFlow
      })
    }
    
    return data
  }

  const generateProjectedData = (historical: FinancialData[]): FinancialData[] => {
    const data: FinancialData[] = []
    const lastMonth = historical[historical.length - 1]
    const now = new Date()
    
    const periodMonths = {
      '3m': 3,
      '6m': 6,
      '12m': 12,
      '24m': 24
    }
    
    for (let i = 1; i <= periodMonths[selectedPeriod]; i++) {
      const date = format(addMonths(now, i), 'yyyy-MM')
      const growthFactor = 1 + (0.15 / 12) // 15% annual growth
      const seasonalFactor = 0.9 + (Math.random() * 0.2) // ±10% seasonal variation
      
      const revenue = Math.round(lastMonth.revenue * Math.pow(growthFactor, i) * seasonalFactor)
      const expenses = Math.round(revenue * 0.3)
      const profit = revenue - expenses
      const taxLiability = Math.round(profit * 0.25)
      const cashFlow = profit - taxLiability
      
      data.push({
        date,
        revenue,
        expenses,
        profit,
        taxLiability,
        cashFlow
      })
    }
    
    return data
  }

  // Computed values
  const combinedData = useMemo(() => {
    return [...historicalData.map(d => ({...d, type: 'historical'})), 
            ...projectedData.map(d => ({...d, type: 'projected'}))]
  }, [historicalData, projectedData])

  const currentMonthRevenue = useMemo(() => {
    return revenueStreams.reduce((sum, stream) => sum + stream.currentMonthly, 0)
  }, [revenueStreams])

  const projectedAnnualRevenue = useMemo(() => {
    return projectedData.reduce((sum, month) => sum + month.revenue, 0)
  }, [projectedData])

  const growthRate = useMemo(() => {
    if (historicalData.length < 2) return 0
    const recent = historicalData.slice(-3).reduce((sum, d) => sum + d.revenue, 0) / 3
    const earlier = historicalData.slice(-6, -3).reduce((sum, d) => sum + d.revenue, 0) / 3
    return ((recent - earlier) / earlier) * 100
  }, [historicalData])

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-32 bg-muted animate-pulse rounded mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Forecasting</h1>
          <p className="text-muted-foreground">
            Revenue projections, growth analysis, and financial planning tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
              <SelectItem value="24m">24 Months</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Financial Report</DialogTitle>
                <DialogDescription>
                  Choose the format and data range for your financial report
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <Button onClick={() => onExportData?.('pdf')}>
                  Export as PDF
                </Button>
                <Button onClick={() => onExportData?.('excel')}>
                  Export as Excel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentMonthRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {growthRate > 0 ? (
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              {Math.abs(growthRate).toFixed(1)}% from last quarter
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Annual Revenue</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${projectedAnnualRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              Based on current trends
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tax Liability (Annual)</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${taxCalculations.annualProjection.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Info className="h-3 w-3 mr-1" />
              {taxCalculations.effectiveRate}% effective rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Opportunities</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${growthOpportunities.reduce((sum, opp) => sum + opp.potentialRevenue, 0).toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              {growthOpportunities.length} opportunities identified
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
          <TabsTrigger value="streams">Revenue Streams</TabsTrigger>
          <TabsTrigger value="opportunities">Growth</TabsTrigger>
          <TabsTrigger value="tax">Tax Planning</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Historical performance and projections</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [`$${value.toLocaleString()}`, name]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      strokeDasharray={(entry: any) => entry?.type === 'projected' ? '5 5' : '0'}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cash Flow Visualization */}
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Analysis</CardTitle>
                <CardDescription>Income, expenses, and net cash flow</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [`$${value.toLocaleString()}`, name]}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* External Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Planning Tools</CardTitle>
              <CardDescription>Connect with external services for comprehensive financial management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'QuickBooks', description: 'Accounting & bookkeeping', connected: true },
                  { name: 'TaxJar', description: 'Tax calculation & filing', connected: true },
                  { name: 'Plaid', description: 'Bank account linking', connected: false },
                  { name: 'Stripe', description: 'Payment processing', connected: true }
                ].map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm text-muted-foreground">{tool.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.connected ? (
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onConnectTool?.(tool.name)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projections Tab */}
        <TabsContent value="projections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Projections</CardTitle>
              <CardDescription>
                Forecasted revenue for the next {selectedPeriod} based on historical data and growth trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={projectedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: string) => [`$${value.toLocaleString()}`, name]}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                  <Area type="monotone" dataKey