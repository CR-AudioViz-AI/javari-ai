```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Download, Target, DollarSign, Users, Percent } from 'lucide-react'
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns'

interface RevenueData {
  month: string
  historical?: number
  projected?: number
  conservative?: number
  realistic?: number
  optimistic?: number
}

interface MetricsData {
  mrr: number
  arr: number
  growthRate: number
  conversionRate: number
  previousMrr: number
  previousArr: number
  previousGrowthRate: number
  previousConversionRate: number
}

interface GoalData {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  deadline: string
  type: 'monthly' | 'yearly'
}

interface ForecastTableData {
  month: string
  conservative: number
  realistic: number
  optimistic: number
  growthRate: number
}

interface RevenueForecastingWidgetProps {
  userId?: string
  className?: string
  onExport?: (data: RevenueData[], format: 'csv' | 'pdf') => void
  onScenarioChange?: (scenario: string) => void
  onTimeframeChange?: (timeframe: string) => void
}

const RevenueForecastingWidget: React.FC<RevenueForecastingWidgetProps> = ({
  userId = 'default-user',
  className = '',
  onExport,
  onScenarioChange,
  onTimeframeChange
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('realistic')
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('12M')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock data - replace with actual Supabase integration
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [metricsData, setMetricsData] = useState<MetricsData>({
    mrr: 15420,
    arr: 185040,
    growthRate: 12.5,
    conversionRate: 3.2,
    previousMrr: 13700,
    previousArr: 164400,
    previousGrowthRate: 8.9,
    previousConversionRate: 2.8
  })
  const [goalsData, setGoalsData] = useState<GoalData[]>([
    {
      id: '1',
      title: 'Monthly Revenue Goal',
      targetAmount: 20000,
      currentAmount: 15420,
      deadline: '2024-12-31',
      type: 'monthly'
    },
    {
      id: '2',
      title: 'Annual Revenue Goal',
      targetAmount: 250000,
      currentAmount: 185040,
      deadline: '2024-12-31',
      type: 'yearly'
    }
  ])

  // Generate mock historical and forecast data
  useEffect(() => {
    const generateForecastData = () => {
      const months = selectedTimeframe === '3M' ? 3 : selectedTimeframe === '6M' ? 6 : 12
      const baseRevenue = 10000
      const growthRate = 0.08 // 8% monthly growth
      const data: RevenueData[] = []

      // Historical data (last 6 months)
      for (let i = -6; i < 0; i++) {
        const date = addMonths(new Date(), i)
        const revenue = baseRevenue * Math.pow(1 + growthRate + (Math.random() - 0.5) * 0.02, i + 6)
        data.push({
          month: format(date, 'MMM yyyy'),
          historical: Math.round(revenue)
        })
      }

      // Forecast data
      for (let i = 0; i < months; i++) {
        const date = addMonths(new Date(), i)
        const baseProjected = baseRevenue * Math.pow(1 + growthRate, i + 6)
        
        data.push({
          month: format(date, 'MMM yyyy'),
          projected: Math.round(baseProjected),
          conservative: Math.round(baseProjected * 0.85),
          realistic: Math.round(baseProjected),
          optimistic: Math.round(baseProjected * 1.25)
        })
      }

      setRevenueData(data)
    }

    generateForecastData()
    setIsLoading(false)
  }, [selectedTimeframe])

  const forecastTableData: ForecastTableData[] = useMemo(() => {
    return revenueData
      .filter(item => item.projected)
      .map(item => ({
        month: item.month,
        conservative: item.conservative || 0,
        realistic: item.realistic || 0,
        optimistic: item.optimistic || 0,
        growthRate: Math.round(Math.random() * 20 + 5) // Mock growth rate
      }))
  }, [revenueData])

  const handleScenarioChange = (scenario: string) => {
    setSelectedScenario(scenario)
    onScenarioChange?.(scenario)
  }

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe)
    onTimeframeChange?.(timeframe)
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    onExport?.(revenueData, format)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getTrendIcon = (current: number, previous: number) => {
    const isPositive = current > previous
    return isPositive ? (
      <TrendingUp className="h-4 w-4 text-green-500" aria-label="Trending up" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" aria-label="Trending down" />
    )
  }

  const getTrendColor = (current: number, previous: number) => {
    return current > previous ? 'text-green-600' : 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`} role="status" aria-label="Loading revenue forecast">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600" role="alert">
            <p>Error loading revenue forecast: {error}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Revenue Forecasting</h2>
          <p className="text-muted-foreground">Track performance and predict future revenue</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedTimeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-24" aria-label="Select forecast timeframe">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3M">3M</SelectItem>
              <SelectItem value="6M">6M</SelectItem>
              <SelectItem value="12M">12M</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedScenario} onValueChange={handleScenarioChange}>
            <SelectTrigger className="w-32" aria-label="Select forecast scenario">
              <SelectValue placeholder="Scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="realistic">Realistic</SelectItem>
              <SelectItem value="optimistic">Optimistic</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="gap-2"
            aria-label="Export forecast data"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metricsData.mrr)}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(metricsData.mrr, metricsData.previousMrr)}`}>
              {getTrendIcon(metricsData.mrr, metricsData.previousMrr)}
              {formatPercentage((metricsData.mrr - metricsData.previousMrr) / metricsData.previousMrr * 100)} from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metricsData.arr)}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(metricsData.arr, metricsData.previousArr)}`}>
              {getTrendIcon(metricsData.arr, metricsData.previousArr)}
              {formatPercentage((metricsData.arr - metricsData.previousArr) / metricsData.previousArr * 100)} from last year
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(metricsData.growthRate)}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(metricsData.growthRate, metricsData.previousGrowthRate)}`}>
              {getTrendIcon(metricsData.growthRate, metricsData.previousGrowthRate)}
              {formatPercentage(metricsData.growthRate - metricsData.previousGrowthRate)} from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData.conversionRate}%</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(metricsData.conversionRate, metricsData.previousConversionRate)}`}>
              {getTrendIcon(metricsData.conversionRate, metricsData.previousConversionRate)}
              {formatPercentage((metricsData.conversionRate - metricsData.previousConversionRate) / metricsData.previousConversionRate * 100)} from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goalsData.map((goal) => (
          <Card key={goal.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{goal.title}</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardDescription>
                Target: {formatCurrency(goal.targetAmount)} by {format(new Date(goal.deadline), 'MMM yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</span>
                </div>
                <Progress 
                  value={(goal.currentAmount / goal.targetAmount) * 100} 
                  className="h-2"
                  aria-label={`${goal.title} progress: ${Math.round((goal.currentAmount / goal.targetAmount) * 100)}%`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.currentAmount)}</span>
                  <span>{formatCurrency(goal.targetAmount - goal.currentAmount)} remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
          <CardDescription>
            Historical performance and projected revenue for the next {selectedTimeframe.replace('M', ' months')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="historical" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Historical"
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey={selectedScenario} 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`${selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Forecast`}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Forecast Breakdown</CardTitle>
          <CardDescription>Detailed revenue projections by scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Conservative</TableHead>
                  <TableHead className="text-right">Realistic</TableHead>
                  <TableHead className="text-right">Optimistic</TableHead>
                  <TableHead className="text-right">Growth Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastTableData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.conservative)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.realistic)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.optimistic)}</TableCell>
                    <TableCell className="text-right">{formatPercentage(row.growthRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RevenueForecastingWidget
```