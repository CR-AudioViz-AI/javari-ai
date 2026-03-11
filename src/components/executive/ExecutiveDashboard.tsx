'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  DollarSign, 
  BarChart3,
  AlertTriangle,
  Calendar,
  Download,
  Settings,
  Maximize2,
  RefreshCw,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

// Types
interface ExecutiveUser {
  id: string
  name: string
  role: 'CEO' | 'CFO' | 'COO' | 'CTO' | 'VP' | 'Director'
  permissions: string[]
}

interface KPIMetric {
  id: string
  title: string
  value: number
  previousValue: number
  target?: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  category: 'financial' | 'operational' | 'strategic' | 'customer'
  lastUpdated: Date
}

interface ChartData {
  name: string
  value: number
  previousValue?: number
  target?: number
  date?: string
}

interface StrategicGoal {
  id: string
  title: string
  description: string
  progress: number
  target: number
  deadline: Date
  status: 'on-track' | 'at-risk' | 'behind' | 'completed'
  owner: string
  category: string
}

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  acknowledged: boolean
}

interface DashboardLayout {
  id: string
  name: string
  widgets: Array<{
    id: string
    type: string
    position: { x: number; y: number; w: number; h: number }
    config: Record<string, any>
  }>
}

interface ExecutiveDashboardProps {
  user: ExecutiveUser
  className?: string
}

// Mock data generators
const generateKPIMetrics = (): KPIMetric[] => [
  {
    id: '1',
    title: 'Revenue',
    value: 2450000,
    previousValue: 2100000,
    target: 2800000,
    unit: 'USD',
    trend: 'up',
    category: 'financial',
    lastUpdated: new Date()
  },
  {
    id: '2',
    title: 'Customer Acquisition',
    value: 1250,
    previousValue: 980,
    unit: 'users',
    trend: 'up',
    category: 'customer',
    lastUpdated: new Date()
  },
  {
    id: '3',
    title: 'Operating Margin',
    value: 24.5,
    previousValue: 22.1,
    target: 25,
    unit: '%',
    trend: 'up',
    category: 'financial',
    lastUpdated: new Date()
  },
  {
    id: '4',
    title: 'Employee Satisfaction',
    value: 8.4,
    previousValue: 7.9,
    target: 8.5,
    unit: '/10',
    trend: 'up',
    category: 'operational',
    lastUpdated: new Date()
  }
]

const generateChartData = (type: 'revenue' | 'users' | 'performance'): ChartData[] => {
  const data = []
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  
  for (let i = 0; i < months.length; i++) {
    switch (type) {
      case 'revenue':
        data.push({
          name: months[i],
          value: Math.floor(Math.random() * 1000000) + 2000000,
          previousValue: Math.floor(Math.random() * 1000000) + 1800000,
          target: 2500000
        })
        break
      case 'users':
        data.push({
          name: months[i],
          value: Math.floor(Math.random() * 500) + 1000,
          previousValue: Math.floor(Math.random() * 400) + 800
        })
        break
      case 'performance':
        data.push({
          name: months[i],
          value: Math.floor(Math.random() * 20) + 70,
          target: 85
        })
        break
    }
  }
  return data
}

const generateStrategicGoals = (): StrategicGoal[] => [
  {
    id: '1',
    title: 'Market Expansion',
    description: 'Expand into 3 new geographic markets',
    progress: 65,
    target: 100,
    deadline: new Date('2024-12-31'),
    status: 'on-track',
    owner: 'VP Sales',
    category: 'Growth'
  },
  {
    id: '2',
    title: 'Digital Transformation',
    description: 'Complete cloud migration and automation',
    progress: 45,
    target: 100,
    deadline: new Date('2024-09-30'),
    status: 'at-risk',
    owner: 'CTO',
    category: 'Technology'
  },
  {
    id: '3',
    title: 'Sustainability Initiative',
    description: 'Reduce carbon footprint by 30%',
    progress: 80,
    target: 100,
    deadline: new Date('2024-11-30'),
    status: 'on-track',
    owner: 'COO',
    category: 'ESG'
  }
]

const generateAlerts = (): Alert[] => [
  {
    id: '1',
    type: 'critical',
    title: 'Revenue Target Miss',
    message: 'Q2 revenue is 15% below target. Immediate action required.',
    timestamp: new Date(),
    acknowledged: false
  },
  {
    id: '2',
    type: 'warning',
    title: 'High Customer Churn',
    message: 'Customer churn rate increased by 8% this month.',
    timestamp: subDays(new Date(), 1),
    acknowledged: false
  },
  {
    id: '3',
    type: 'info',
    title: 'New Market Opportunity',
    message: 'Competitor exit creates opportunity in APAC region.',
    timestamp: subDays(new Date(), 2),
    acknowledged: true
  }
]

// Components
const KPICard: React.FC<{ metric: KPIMetric }> = ({ metric }) => {
  const percentChange = ((metric.value - metric.previousValue) / metric.previousValue * 100).toFixed(1)
  const isPositive = metric.trend === 'up'
  
  const formatValue = (value: number) => {
    if (metric.unit === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    }
    return `${value.toLocaleString()}${metric.unit}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
        {metric.trend === 'up' ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : metric.trend === 'down' ? (
          <TrendingDown className="h-4 w-4 text-red-600" />
        ) : (
          <BarChart3 className="h-4 w-4 text-blue-600" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(metric.value)}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
          <span className={cn(
            "flex items-center",
            isPositive ? "text-emerald-600" : "text-red-600"
          )}>
            {isPositive ? '+' : ''}{percentChange}%
          </span>
          <span>vs last period</span>
        </div>
        {metric.target && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress to target</span>
              <span>{Math.round(metric.value / metric.target * 100)}%</span>
            </div>
            <Progress value={metric.value / metric.target * 100} className="h-1" />
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-2">
          Last updated: {format(metric.lastUpdated, 'MMM d, HH:mm')}
        </div>
      </CardContent>
    </Card>
  )
}

const MetricsChart: React.FC<{
  title: string
  data: ChartData[]
  type: 'line' | 'area' | 'bar'
  color?: string
}> = ({ title, data, type, color = '#3b82f6' }) => {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.3} />
            {data[0]?.target && <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="3 3" />}
          </AreaChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        )
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
            {data[0]?.previousValue && (
              <Line type="monotone" dataKey="previousValue" stroke="#94a3b8" strokeDasharray="3 3" />
            )}
            {data[0]?.target && (
              <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" />
            )}
          </LineChart>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const StrategicPlanningWidget: React.FC<{ goals: StrategicGoal[] }> = ({ goals }) => {
  const getStatusColor = (status: StrategicGoal['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500'
      case 'on-track':
        return 'bg-blue-500'
      case 'at-risk':
        return 'bg-yellow-500'
      case 'behind':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Strategic Goals</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((goal) => (
          <div key={goal.id} className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-medium">{goal.title}</h4>
                <p className="text-sm text-muted-foreground">{goal.description}</p>
              </div>
              <Badge variant="secondary" className={cn("text-white", getStatusColor(goal.status))}>
                {goal.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress: {goal.progress}%</span>
                <span>Due: {format(goal.deadline, 'MMM d, yyyy')}</span>
              </div>
              <Progress value={goal.progress} className="h-2" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Owner: {goal.owner}</span>
              <span>{goal.category}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

const RealTimeAlerts: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const filteredAlerts = alerts.filter(alert => 
    filter === 'all' || alert.type === filter
  )

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Real-time Alerts</span>
          </CardTitle>
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No alerts matching the current filter
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <Alert key={alert.id} className={cn(
              "border-l-4",
              alert.type === 'critical' && "border-l-red-500",
              alert.type === 'warning' && "border-l-yellow-500",
              alert.type === 'info' && "border-l-blue-500",
              alert.acknowledged && "opacity-60"
            )}>
              <div className="flex items-start space-x-3">
                {getAlertIcon(alert.type)}
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium">{alert.title}</h5>
                    <span className="text-xs text-muted-foreground">
                      {format(alert.timestamp, 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <AlertDescription className="text-sm">
                    {alert.message}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  )
}

const DashboardFilters: React.FC<{
  dateRange: string
  onDateRangeChange: (range: string) => void
  department: string
  onDepartmentChange: (dept: string) => void
}> = ({ dateRange, onDateRangeChange, department, onDepartmentChange }) => {
  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      
      <Select value={dateRange} onValueChange={onDateRangeChange}>
        <SelectTrigger className="w-40">
          <Calendar className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value="ytd">Year to date</SelectItem>
          <SelectItem value="1y">Last year</SelectItem>
        </SelectContent>
      </Select>

      <Select value={department} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-40">
          <Users className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          <SelectItem value="sales">Sales</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
          <SelectItem value="operations">Operations</SelectItem>
          <SelectItem value="finance">Finance</SelectItem>
          <SelectItem value="hr">Human Resources</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

const ExecutiveReports: React.FC<{ user: ExecutiveUser }> = ({ user }) => {
  const reports = [
    { name: 'Executive Summary', type: 'monthly', lastGenerated: new Date() },
    { name: 'Financial Dashboard', type: 'weekly', lastGenerated: subDays(new Date(), 2) },
    { name: 'KPI Report', type: 'daily', lastGenerated: new Date() },
    { name: 'Strategic Review', type: 'quarterly', lastGenerated: subDays(new Date(), 30) }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Download className="h-5 w-5" />
          <span>Executive Reports</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reports.map((report, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h4 className="font-medium">{report.name}</h4>
              <p className="text-sm text-muted-foreground">
                Last generated: {format(report.lastGenerated, 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Main Component
const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ user, className }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')
  const [department, setDepartment] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const kpiMetrics = useMemo(() => generateKPIMetrics(), [])
  const revenueData = useMemo(() => generateChartData('revenue'), [])
  const userGrowthData = useMemo(() => generateChartData('users'), [])
  const performanceData = useMemo(() => generateChartData('performance'), [])
  const strategicGoals = useMemo(() => generateStrategicGoals(), [])
  const alerts = useMemo(() => generateAlerts(), [])

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid