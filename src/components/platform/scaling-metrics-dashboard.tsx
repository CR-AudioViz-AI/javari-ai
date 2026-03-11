```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
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
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Server, 
  Cpu, 
  HardDrive, 
  Wifi, 
  DollarSign, 
  Settings, 
  Zap, 
  BarChart3,
  Target,
  Clock,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subHours, subDays } from 'date-fns'

interface MetricData {
  timestamp: string
  cpu: number
  memory: number
  disk: number
  network: number
  requests: number
  responseTime: number
  errorRate: number
}

interface CostData {
  category: string
  cost: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
  color: string
}

interface PredictionData {
  timestamp: string
  predicted: number
  actual?: number
  confidence: number
}

interface AlertData {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: string
  acknowledged: boolean
}

interface ScalingConfig {
  autoScaling: boolean
  cpuThreshold: number
  memoryThreshold: number
  minInstances: number
  maxInstances: number
  scaleUpCooldown: number
  scaleDownCooldown: number
}

interface CapacityForecast {
  resource: string
  currentUtilization: number
  projectedUtilization: number
  timeToCapacity: string
  recommendedAction: string
  priority: 'low' | 'medium' | 'high'
}

interface ScalingMetricsDashboardProps {
  className?: string
  refreshInterval?: number
  onConfigChange?: (config: ScalingConfig) => void
  onAlertAcknowledge?: (alertId: string) => void
}

const generateMockMetrics = (): MetricData[] => {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => ({
    timestamp: format(subHours(now, 23 - i), 'HH:mm'),
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    network: Math.random() * 1000,
    requests: Math.floor(Math.random() * 10000),
    responseTime: Math.random() * 1000,
    errorRate: Math.random() * 5
  }))
}

const generateMockCosts = (): CostData[] => [
  { category: 'Compute', cost: 1250, percentage: 45, trend: 'up', color: '#8884d8' },
  { category: 'Storage', cost: 680, percentage: 25, trend: 'stable', color: '#82ca9d' },
  { category: 'Network', cost: 420, percentage: 15, trend: 'down', color: '#ffc658' },
  { category: 'Database', cost: 280, percentage: 10, trend: 'up', color: '#ff7c7c' },
  { category: 'Monitoring', cost: 140, percentage: 5, trend: 'stable', color: '#8dd1e1' }
]

const generateMockPredictions = (): PredictionData[] => {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => ({
    timestamp: format(subHours(now, -i), 'HH:mm'),
    predicted: 50 + Math.random() * 40,
    actual: i < 6 ? 50 + Math.random() * 40 : undefined,
    confidence: 0.8 + Math.random() * 0.2
  }))
}

const generateMockAlerts = (): AlertData[] => [
  {
    id: '1',
    type: 'warning',
    title: 'High CPU Usage',
    message: 'CPU utilization has exceeded 85% for the last 10 minutes',
    timestamp: '2 minutes ago',
    acknowledged: false
  },
  {
    id: '2',
    type: 'error',
    title: 'Memory Leak Detected',
    message: 'Memory usage trending upward without corresponding load increase',
    timestamp: '15 minutes ago',
    acknowledged: false
  },
  {
    id: '3',
    type: 'info',
    title: 'Auto-scaling Event',
    message: 'Successfully scaled up from 3 to 5 instances',
    timestamp: '1 hour ago',
    acknowledged: true
  }
]

const generateMockForecasts = (): CapacityForecast[] => [
  {
    resource: 'CPU',
    currentUtilization: 75,
    projectedUtilization: 95,
    timeToCapacity: '3 days',
    recommendedAction: 'Scale up instances',
    priority: 'high'
  },
  {
    resource: 'Memory',
    currentUtilization: 60,
    projectedUtilization: 80,
    timeToCapacity: '1 week',
    recommendedAction: 'Monitor closely',
    priority: 'medium'
  },
  {
    resource: 'Storage',
    currentUtilization: 45,
    projectedUtilization: 65,
    timeToCapacity: '2 weeks',
    recommendedAction: 'No action needed',
    priority: 'low'
  }
]

const ResourceUtilizationCard: React.FC<{
  title: string
  value: number
  icon: React.ReactNode
  color: string
  trend?: 'up' | 'down' | 'stable'
}> = ({ title, value, icon, color, trend }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {trend && getTrendIcon()}
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold">{value.toFixed(1)}%</div>
          <Progress value={value} className="mt-2" style={{ color }} />
        </div>
      </CardContent>
    </Card>
  )
}

const PerformanceTrendsChart: React.FC<{
  data: MetricData[]
  metric: keyof MetricData
  title: string
  color: string
  unit?: string
}> = ({ data, metric, title, color, unit = '' }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
            />
            <Line 
              type="monotone" 
              dataKey={metric} 
              stroke={color} 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const CostAnalysisCard: React.FC<{ data: CostData[] }> = ({ data }) => {
  const totalCost = data.reduce((sum, item) => sum + item.cost, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="h-5 w-5" />
          <span>Cost Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold">${totalCost.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Monthly Cost</div>
          </div>
          
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="cost"
                label={({ category, percentage }) => `${category}: ${percentage}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            {data.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="text-sm">{item.category}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">${item.cost}</span>
                  {item.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
                  {item.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const ScalingPredictionPanel: React.FC<{ data: PredictionData[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Scaling Predictions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="predicted" 
              stroke="#8884d8" 
              fill="#8884d8" 
              fillOpacity={0.3}
              name="Predicted Load"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Actual Load"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

const MetricsAlertPanel: React.FC<{
  alerts: AlertData[]
  onAcknowledge: (alertId: string) => void
}> = ({ alerts, onAcknowledge }) => {
  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Active Alerts</span>
          </div>
          {unacknowledgedAlerts.length > 0 && (
            <Badge variant="destructive">{unacknowledgedAlerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Alert 
              key={alert.id} 
              variant={alert.type === 'error' ? 'destructive' : 'default'}
              className={cn(
                alert.acknowledged && 'opacity-50',
                alert.type === 'warning' && 'border-yellow-500'
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                {alert.title}
                <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
              </AlertTitle>
              <AlertDescription className="mt-2">
                {alert.message}
                {!alert.acknowledged && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={() => onAcknowledge(alert.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const AutoScalingControls: React.FC<{
  config: ScalingConfig
  onConfigChange: (config: ScalingConfig) => void
}> = ({ config, onConfigChange }) => {
  const handleConfigUpdate = (updates: Partial<ScalingConfig>) => {
    onConfigChange({ ...config, ...updates })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Auto-scaling Configuration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-scaling">Enable Auto-scaling</Label>
          <Switch
            id="auto-scaling"
            checked={config.autoScaling}
            onCheckedChange={(checked) => handleConfigUpdate({ autoScaling: checked })}
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label>CPU Threshold (%)</Label>
            <Slider
              value={[config.cpuThreshold]}
              onValueChange={([value]) => handleConfigUpdate({ cpuThreshold: value })}
              max={100}
              min={0}
              step={5}
              className="mt-2"
            />
            <div className="text-sm text-muted-foreground mt-1">
              Current: {config.cpuThreshold}%
            </div>
          </div>

          <div>
            <Label>Memory Threshold (%)</Label>
            <Slider
              value={[config.memoryThreshold]}
              onValueChange={([value]) => handleConfigUpdate({ memoryThreshold: value })}
              max={100}
              min={0}
              step={5}
              className="mt-2"
            />
            <div className="text-sm text-muted-foreground mt-1">
              Current: {config.memoryThreshold}%
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Instances</Label>
              <Select 
                value={config.minInstances.toString()} 
                onValueChange={(value) => handleConfigUpdate({ minInstances: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Max Instances</Label>
              <Select 
                value={config.maxInstances.toString()} 
                onValueChange={(value) => handleConfigUpdate({ maxInstances: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const CapacityPlanningTools: React.FC<{ forecasts: CapacityForecast[] }> = ({ forecasts }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Capacity Planning</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {forecasts.map((forecast) => (
            <div key={forecast.resource} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{forecast.resource}</h4>
                <Badge 
                  variant={
                    forecast.priority === 'high' ? 'destructive' :
                    forecast.priority === 'medium' ? 'default' : 'secondary'
                  }
                >
                  {forecast.priority} priority
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <Label className="text-xs">Current Utilization</Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={forecast.currentUtilization} className="flex-1" />
                    <span className="text-sm font-medium">{forecast.currentUtilization}%</span>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Projected Utilization</Label>
                  <div className="flex items-center space-x-2">
                    <Progress value={forecast.projectedUtilization} className="flex-1" />
                    <span className="text-sm font-medium">{forecast.projectedUtilization}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Time to Capacity</Label>
                  <div className="font-medium">{forecast.timeToCapacity}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Recommended Action</Label>
                  <div className="font-medium">{forecast.recommendedAction}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const ScalingMetricsDashboard: React.FC<ScalingMetricsDashboardProps> = ({
  className,
  refreshInterval = 30000,
  onConfigChange,
  onAlertAcknowledge
}) => {
  const [metricsData, setMetricsData] = useState<MetricData[]>(generateMockMetrics())
  const [costData] = useState<CostData[]>(generateMockCosts())
  const [predictionData] = useState<PredictionData[]>(generateMockPredictions())
  const [alerts, setAlerts] = useState<AlertData[]>(generateMockAlerts())
  const [forecasts] = useState<CapacityForecast[]>(generateMockForecasts())
  const [scalingConfig, setScalingConfig] = useState<ScalingConfig>({
    autoScaling: true,
    cpuThreshold: 80,
    memoryThreshold: 85,
    minInstances: 2,
    maxInstances: 10,
    scaleUpCooldown: 300,
    scaleDownCooldown: 600
  })

  const currentMetrics = useMemo(() => {
    const latest = metricsData[metricsData.length - 1]
    return latest || metricsData[0]
  }, [metricsData])

  const handleConfigChange = (config: ScalingConfig) => {
    setScalingConfig(config)
    onConfigChange?.(config)
  }

  const handleAlertAcknowledge = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
    onAlertAcknowledge?.(alertId)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsData(generateMockMetrics())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">