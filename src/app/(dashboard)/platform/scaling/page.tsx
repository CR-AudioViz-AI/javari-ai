```tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar
} from 'recharts'
import { 
  Activity,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Network,
  Power,
  Settings,
  TrendingUp,
  TrendingDown,
  Zap,
  DollarSign,
  Users,
  Globe,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle
} from 'lucide-react'

interface MetricsData {
  cpu: number
  memory: number
  network: number
  storage: number
  activeUsers: number
  requestsPerSecond: number
  responseTime: number
}

interface ScalingEvent {
  id: string
  timestamp: string
  action: 'scale_up' | 'scale_down' | 'auto_scale'
  service: string
  from: number
  to: number
  reason: string
  status: 'success' | 'failed' | 'in_progress'
}

interface Alert {
  id: string
  type: 'warning' | 'critical' | 'info'
  title: string
  description: string
  timestamp: string
  acknowledged: boolean
}

interface ThresholdConfig {
  cpu: { min: number; max: number }
  memory: { min: number; max: number }
  responseTime: { max: number }
  autoScaling: boolean
}

const performanceData = [
  { time: '00:00', cpu: 45, memory: 60, network: 30, responseTime: 120 },
  { time: '04:00', cpu: 35, memory: 55, network: 25, responseTime: 100 },
  { time: '08:00', cpu: 75, memory: 70, network: 60, responseTime: 180 },
  { time: '12:00', cpu: 85, memory: 80, network: 80, responseTime: 220 },
  { time: '16:00', cpu: 90, memory: 85, network: 85, responseTime: 250 },
  { time: '20:00', cpu: 65, memory: 75, network: 50, responseTime: 160 },
  { time: '24:00', cpu: 50, memory: 65, network: 35, responseTime: 130 }
]

const capacityForecast = [
  { date: 'Today', current: 100, projected: 100, capacity: 150 },
  { date: 'Tomorrow', current: 100, projected: 120, capacity: 150 },
  { date: '+2 days', current: 100, projected: 140, capacity: 150 },
  { date: '+3 days', current: 100, projected: 160, capacity: 200 },
  { date: '+1 week', current: 100, projected: 200, capacity: 250 }
]

const resourceDistribution = [
  { name: 'Web Servers', value: 40, color: '#8884d8' },
  { name: 'API Services', value: 25, color: '#82ca9d' },
  { name: 'Database', value: 20, color: '#ffc658' },
  { name: 'Cache', value: 10, color: '#ff7c7c' },
  { name: 'Queue', value: 5, color: '#8dd1e1' }
]

const costAnalysis = [
  { month: 'Jan', actual: 12000, projected: 12000 },
  { month: 'Feb', actual: 13500, projected: 13200 },
  { month: 'Mar', actual: 15200, projected: 14800 },
  { month: 'Apr', actual: 16800, projected: 16500 },
  { month: 'May', actual: 0, projected: 18200 },
  { month: 'Jun', actual: 0, projected: 19800 }
]

export default function PlatformScalingPage() {
  const [metricsData, setMetricsData] = useState<MetricsData>({
    cpu: 75,
    memory: 68,
    network: 45,
    storage: 82,
    activeUsers: 2847,
    requestsPerSecond: 1256,
    responseTime: 185
  })

  const [scalingEvents] = useState<ScalingEvent[]>([
    {
      id: '1',
      timestamp: '2024-01-15 14:30:25',
      action: 'scale_up',
      service: 'web-servers',
      from: 3,
      to: 5,
      reason: 'High CPU utilization (>85%)',
      status: 'success'
    },
    {
      id: '2',
      timestamp: '2024-01-15 12:15:10',
      action: 'auto_scale',
      service: 'api-services',
      from: 2,
      to: 4,
      reason: 'Response time threshold exceeded',
      status: 'success'
    },
    {
      id: '3',
      timestamp: '2024-01-15 09:45:33',
      action: 'scale_down',
      service: 'queue-workers',
      from: 6,
      to: 4,
      reason: 'Low resource utilization',
      status: 'in_progress'
    }
  ])

  const [alerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'critical',
      title: 'High Memory Usage',
      description: 'Memory utilization has exceeded 85% for 10 minutes',
      timestamp: '2024-01-15 14:25:00',
      acknowledged: false
    },
    {
      id: '2',
      type: 'warning',
      title: 'Approaching CPU Limit',
      description: 'CPU usage trending upward, consider scaling soon',
      timestamp: '2024-01-15 14:20:00',
      acknowledged: true
    },
    {
      id: '3',
      type: 'info',
      title: 'Auto-scaling Triggered',
      description: 'Additional web server instances deployed successfully',
      timestamp: '2024-01-15 14:15:00',
      acknowledged: true
    }
  ])

  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    cpu: { min: 30, max: 80 },
    memory: { min: 25, max: 75 },
    responseTime: { max: 200 },
    autoScaling: true
  })

  const [selectedService, setSelectedService] = useState('web-servers')
  const [manualScaleValue, setManualScaleValue] = useState([3])

  // Simulate real-time metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsData(prev => ({
        ...prev,
        cpu: Math.max(0, Math.min(100, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(0, Math.min(100, prev.memory + (Math.random() - 0.5) * 8)),
        network: Math.max(0, Math.min(100, prev.network + (Math.random() - 0.5) * 15)),
        storage: Math.max(0, Math.min(100, prev.storage + (Math.random() - 0.5) * 2)),
        activeUsers: Math.max(0, prev.activeUsers + Math.floor((Math.random() - 0.5) * 100)),
        requestsPerSecond: Math.max(0, prev.requestsPerSecond + Math.floor((Math.random() - 0.5) * 200)),
        responseTime: Math.max(50, prev.responseTime + (Math.random() - 0.5) * 50)
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (value: number, thresholds: { min?: number; max: number }) => {
    if (value > thresholds.max) return 'text-red-600'
    if (thresholds.min && value < thresholds.min) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressColor = (value: number, max: number) => {
    const percentage = (value / max) * 100
    if (percentage > 85) return 'bg-red-500'
    if (percentage > 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const handleScaleService = async (action: 'up' | 'down') => {
    // Simulate scaling operation
    console.log(`Scaling ${selectedService} ${action}`)
  }

  const handleEmergencyStop = async () => {
    // Simulate emergency stop
    console.log('Emergency stop triggered')
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Scaling Control</h1>
            <p className="text-muted-foreground">
              Monitor and control platform scaling operations in real-time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Live
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmergencyStop}
              className="flex items-center gap-1"
            >
              <Power className="h-4 w-4" />
              Emergency Stop
            </Button>
          </div>
        </div>

        {/* Alerts Panel */}
        {alerts.filter(alert => !alert.acknowledged).length > 0 && (
          <div className="space-y-2">
            {alerts
              .filter(alert => !alert.acknowledged)
              .map(alert => (
                <Alert 
                  key={alert.id} 
                  variant={alert.type === 'critical' ? 'destructive' : 'default'}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{alert.title}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              ))}
          </div>
        )}

        {/* Main Dashboard */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Metrics Overview */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <span className={getStatusColor(metricsData.cpu, thresholds.cpu)}>
                      {metricsData.cpu.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={metricsData.cpu} 
                    className="mt-2" 
                    color={getProgressColor(metricsData.cpu, 100)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <span className={getStatusColor(metricsData.memory, thresholds.memory)}>
                      {metricsData.memory.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={metricsData.memory} 
                    className="mt-2"
                    color={getProgressColor(metricsData.memory, 100)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                  <Network className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {metricsData.network.toFixed(1)}%
                  </div>
                  <Progress value={metricsData.network} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Storage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {metricsData.storage.toFixed(1)}%
                  </div>
                  <Progress value={metricsData.storage} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance (24h)</CardTitle>
                <CardDescription>
                  Real-time monitoring of key performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="CPU %"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memory" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Memory %"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="network" 
                      stroke="#ffc658" 
                      strokeWidth={2}
                      name="Network %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.activeUsers.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +12% from yesterday
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Requests/sec</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metricsData.requestsPerSecond.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-yellow-600 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +5% from last hour
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <span className={getStatusColor(metricsData.responseTime, { max: thresholds.responseTime.max })}>
                      {metricsData.responseTime.toFixed(0)}ms
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-red-600 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +8% from baseline
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Capacity Tab */}
          <TabsContent value="capacity" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Capacity Forecast</CardTitle>
                  <CardDescription>
                    Projected resource needs based on current trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={capacityForecast}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="capacity" 
                        stackId="1"
                        stroke="#8884d8" 
                        fill="#8884d8"
                        fillOpacity={0.3}
                        name="Total Capacity"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="projected" 
                        stackId="2"
                        stroke="#82ca9d" 
                        fill="#82ca9d"
                        name="Projected Usage"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="current" 
                        stackId="3"
                        stroke="#ffc658" 
                        fill="#ffc658"
                        name="Current Usage"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Distribution</CardTitle>
                  <CardDescription>
                    Current allocation across services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={resourceDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {resourceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Controls Tab */}
          <TabsContent value="controls" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Manual Scaling Controls</CardTitle>
                  <CardDescription>
                    Manually adjust service instances
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="service-select">Service</Label>
                    <select
                      id="service-select"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"