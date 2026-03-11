```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'
import Papa from 'papaparse'

interface EarningsData {
  id: string
  creator_id: string
  amount: number
  revenue_stream: string
  transaction_date: string
  status: 'pending' | 'completed' | 'failed'
}

interface PayoutSchedule {
  id: string
  creator_id: string
  amount: number
  scheduled_date: string
  status: 'pending' | 'processing' | 'completed'
  payment_method: string
}

interface RevenueStream {
  name: string
  amount: number
  percentage: number
  growth: number
  color: string
  visible: boolean
}

interface EarningsMetrics {
  totalEarnings: number
  monthlyEarnings: number
  projectedEarnings: number
  growthRate: number
}

interface EarningsBreakdownProps {
  creatorId: string
  className?: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const REVENUE_STREAM_COLORS = {
  subscriptions: '#3b82f6',
  tips: '#10b981',
  sponsorships: '#f59e0b',
  merchandise: '#ef4444',
  licensing: '#8b5cf6',
  other: '#6b7280'
}

export default function EarningsBreakdown({ creatorId, className }: EarningsBreakdownProps) {
  const [earningsData, setEarningsData] = useState<EarningsData[]>([])
  const [payoutSchedules, setPayoutSchedules] = useState<PayoutSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')
  const [revenueStreams, setRevenueStreams] = useState<RevenueStream[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch earnings data
  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        setLoading(true)
        setError(null)

        const dateRanges = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '365d': 365
        }

        const days = dateRanges[dateRange as keyof typeof dateRanges] || 30
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const { data: earnings, error: earningsError } = await supabase
          .from('creator_earnings')
          .select('*')
          .eq('creator_id', creatorId)
          .gte('transaction_date', startDate.toISOString())
          .order('transaction_date', { ascending: true })

        if (earningsError) throw earningsError

        const { data: payouts, error: payoutsError } = await supabase
          .from('payout_schedules')
          .select('*')
          .eq('creator_id', creatorId)
          .gte('scheduled_date', new Date().toISOString())
          .order('scheduled_date', { ascending: true })

        if (payoutsError) throw payoutsError

        setEarningsData(earnings || [])
        setPayoutSchedules(payouts || [])
      } catch (err) {
        console.error('Error fetching earnings data:', err)
        setError('Failed to load earnings data')
      } finally {
        setLoading(false)
      }
    }

    if (creatorId) {
      fetchEarningsData()
    }
  }, [creatorId, dateRange])

  // Process revenue streams data
  const processedRevenueStreams = useMemo(() => {
    if (!earningsData.length) return []

    const streamTotals: { [key: string]: number } = {}
    let totalAmount = 0

    earningsData.forEach(earning => {
      streamTotals[earning.revenue_stream] = (streamTotals[earning.revenue_stream] || 0) + earning.amount
      totalAmount += earning.amount
    })

    const streams = Object.entries(streamTotals).map(([name, amount]) => ({
      name,
      amount,
      percentage: (amount / totalAmount) * 100,
      growth: Math.random() * 20 - 10, // Mock growth data
      color: REVENUE_STREAM_COLORS[name as keyof typeof REVENUE_STREAM_COLORS] || REVENUE_STREAM_COLORS.other,
      visible: true
    }))

    setRevenueStreams(streams)
    return streams
  }, [earningsData])

  // Calculate earnings metrics
  const earningsMetrics: EarningsMetrics = useMemo(() => {
    const totalEarnings = earningsData.reduce((sum, earning) => sum + earning.amount, 0)
    
    const currentMonth = new Date().getMonth()
    const monthlyEarnings = earningsData
      .filter(earning => new Date(earning.transaction_date).getMonth() === currentMonth)
      .reduce((sum, earning) => sum + earning.amount, 0)

    const projectedEarnings = monthlyEarnings * 12 // Simple projection
    const growthRate = Math.random() * 30 - 5 // Mock growth rate

    return {
      totalEarnings,
      monthlyEarnings,
      projectedEarnings,
      growthRate
    }
  }, [earningsData])

  // Prepare chart data
  const trendData = useMemo(() => {
    if (!earningsData.length) return []

    const dailyEarnings: { [key: string]: number } = {}
    
    earningsData.forEach(earning => {
      const date = earning.transaction_date.split('T')[0]
      dailyEarnings[date] = (dailyEarnings[date] || 0) + earning.amount
    })

    return Object.entries(dailyEarnings)
      .map(([date, amount]) => ({
        date,
        amount
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [earningsData])

  const pieData = processedRevenueStreams
    .filter(stream => stream.visible)
    .map(stream => ({
      name: stream.name,
      value: stream.amount,
      color: stream.color
    }))

  // Export functions
  const exportToPDF = async () => {
    const pdf = new jsPDF()
    
    pdf.setFontSize(20)
    pdf.text('Earnings Breakdown Report', 20, 30)
    
    pdf.setFontSize(12)
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 50)
    pdf.text(`Period: Last ${dateRange}`, 20, 65)
    
    pdf.text(`Total Earnings: $${earningsMetrics.totalEarnings.toFixed(2)}`, 20, 85)
    pdf.text(`Monthly Earnings: $${earningsMetrics.monthlyEarnings.toFixed(2)}`, 20, 100)
    pdf.text(`Growth Rate: ${earningsMetrics.growthRate.toFixed(1)}%`, 20, 115)

    let yPosition = 140
    pdf.text('Revenue Streams:', 20, yPosition)
    
    processedRevenueStreams.forEach(stream => {
      yPosition += 15
      pdf.text(
        `${stream.name}: $${stream.amount.toFixed(2)} (${stream.percentage.toFixed(1)}%)`,
        25,
        yPosition
      )
    })

    pdf.save('earnings-breakdown.pdf')
  }

  const exportToCSV = () => {
    const csvData = earningsData.map(earning => ({
      Date: earning.transaction_date.split('T')[0],
      'Revenue Stream': earning.revenue_stream,
      Amount: earning.amount,
      Status: earning.status
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'earnings-breakdown.csv')
    link.click()
  }

  const toggleRevenueStream = (streamName: string) => {
    setRevenueStreams(prev => 
      prev.map(stream => 
        stream.name === streamName 
          ? { ...stream, visible: !stream.visible }
          : stream
      )
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
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
        <CardContent className="p-6 text-center">
          <p className="text-red-600">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Earnings Breakdown</h2>
          <p className="text-gray-600">Track your revenue streams and growth</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportToPDF}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold">{formatCurrency(earningsMetrics.totalEarnings)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold">{formatCurrency(earningsMetrics.monthlyEarnings)}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Projected Annual</p>
                <p className="text-2xl font-bold">{formatCurrency(earningsMetrics.projectedEarnings)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Growth Rate</p>
                <p className="text-2xl font-bold flex items-center">
                  {earningsMetrics.growthRate > 0 ? '+' : ''}
                  {earningsMetrics.growthRate.toFixed(1)}%
                  {earningsMetrics.growthRate > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600 ml-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600 ml-1" />
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Streams Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Streams</CardTitle>
                <CardDescription>Breakdown by source</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {processedRevenueStreams.map(stream => (
                    <DropdownMenuItem
                      key={stream.name}
                      onClick={() => toggleRevenueStream(stream.name)}
                    >
                      {stream.visible ? (
                        <Eye className="w-4 h-4 mr-2" />
                      ) : (
                        <EyeOff className="w-4 h-4 mr-2" />
                      )}
                      {stream.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Growth Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Trend</CardTitle>
            <CardDescription>Daily earnings over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [formatCurrency(value), 'Earnings']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Streams Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Stream Details</CardTitle>
          <CardDescription>Detailed breakdown of each revenue source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processedRevenueStreams.map(stream => (
              <div key={stream.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: stream.color }}
                  />
                  <div>
                    <p className="font-medium capitalize">{stream.name}</p>
                    <p className="text-sm text-gray-600">{stream.percentage.toFixed(1)}% of total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(stream.amount)}</p>
                  <div className="flex items-center text-sm">
                    {stream.growth > 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
                    )}
                    <span className={stream.growth > 0 ? 'text-green-600' : 'text-red-600'}>
                      {stream.growth > 0 ? '+' : ''}{stream.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payout Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Payouts</CardTitle>
          <CardDescription>Scheduled payments and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutSchedules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutSchedules.map(payout => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {formatCurrency(payout.amount)}
                    </TableCell>
                    <TableCell>
                      {new Date(payout.scheduled_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payout.payment_method}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payout.status === 'completed'
                            ? 'default'
                            : payout.status === 'processing'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {payout.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (