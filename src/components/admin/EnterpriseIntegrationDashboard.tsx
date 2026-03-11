```tsx
"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Database, 
  Download, 
  Eye, 
  Filter,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Upload,
  Wifi,
  WifiOff,
  XCircle,
  Zap
} from 'lucide-react'

interface Integration {
  id: string
  name: string
  type: 'database' | 'api' | 'file' | 'webhook'
  status: 'active' | 'inactive' | 'error' | 'syncing'
  lastSync: string
  nextSync: string
  dataTransferred: number
  errorCount: number
  config: {
    endpoint?: string
    frequency: string
    retryCount: number
    timeout: number
  }
}

interface DataFlowMetrics {
  timestamp: string
  recordsProcessed: number
  errors: number
  avgProcessingTime: number
}

interface ErrorLog {
  id: string
  integrationId: string
  timestamp: string
  level: 'error' | 'warning' | 'info'
  message: string
  details?: string
}

interface EnterpriseIntegrationDashboardProps {
  className?: string
}

const mockIntegrations: Integration[] = [
  {
    id: '1',
    name: 'Salesforce CRM',
    type: 'api',
    status: 'active',
    lastSync: '2024-01-20T10:30:00Z',
    nextSync: '2024-01-20T14:30:00Z',
    dataTransferred: 12500,
    errorCount: 0,
    config: {
      endpoint: 'https://api.salesforce.com',
      frequency: '4h',
      retryCount: 3,
      timeout: 30000
    }
  },
  {
    id: '2',
    name: 'PostgreSQL DataWarehouse',
    type: 'database',
    status: 'syncing',
    lastSync: '2024-01-20T09:15:00Z',
    nextSync: '2024-01-20T15:15:00Z',
    dataTransferred: 85600,
    errorCount: 2,
    config: {
      frequency: '6h',
      retryCount: 5,
      timeout: 60000
    }
  },
  {
    id: '3',
    name: 'Customer Webhook',
    type: 'webhook',
    status: 'error',
    lastSync: '2024-01-20T08:45:00Z',
    nextSync: '2024-01-20T12:45:00Z',
    dataTransferred: 3200,
    errorCount: 5,
    config: {
      endpoint: 'https://customer.webhook.com/api',
      frequency: '1h',
      retryCount: 2,
      timeout: 15000
    }
  }
]

const mockMetrics: DataFlowMetrics[] = [
  { timestamp: '09:00', recordsProcessed: 1200, errors: 2, avgProcessingTime: 150 },
  { timestamp: '10:00', recordsProcessed: 1850, errors: 1, avgProcessingTime: 120 },
  { timestamp: '11:00', recordsProcessed: 2100, errors: 0, avgProcessingTime: 110 },
  { timestamp: '12:00', recordsProcessed: 1950, errors: 1, avgProcessingTime: 140 },
  { timestamp: '13:00', recordsProcessed: 2300, errors: 0, avgProcessingTime: 105 }
]

const mockErrorLogs: ErrorLog[] = [
  {
    id: '1',
    integrationId: '3',
    timestamp: '2024-01-20T10:25:00Z',
    level: 'error',
    message: 'Connection timeout to webhook endpoint',
    details: 'Failed to connect to https://customer.webhook.com/api after 15000ms'
  },
  {
    id: '2',
    integrationId: '2',
    timestamp: '2024-01-20T09:45:00Z',
    level: 'warning',
    message: 'Slow query detected',
    details: 'Query execution took 45 seconds, exceeding threshold'
  }
]

export default function EnterpriseIntegrationDashboard({ className }: EnterpriseIntegrationDashboardProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      setIntegrations(prev => prev.map(integration => ({
        ...integration,
        dataTransferred: integration.dataTransferred + Math.floor(Math.random() * 100),
        lastSync: integration.status === 'active' ? new Date().toISOString() : integration.lastSync
      })))
    }, 5000)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled])

  const getStatusColor = (status: Integration['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'syncing': return 'bg-blue-500'
      case 'error': return 'bg-red-500'
      case 'inactive': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-4 w-4" />
      case 'syncing': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'error': return <XCircle className="h-4 w-4" />
      case 'inactive': return <Pause className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTypeIcon = (type: Integration['type']) => {
    switch (type) {
      case 'database': return <Database className="h-4 w-4" />
      case 'api': return <Zap className="h-4 w-4" />
      case 'webhook': return <Wifi className="h-4 w-4" />
      case 'file': return <Upload className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || integration.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleToggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { 
            ...integration, 
            status: integration.status === 'active' ? 'inactive' : 'active'
          }
        : integration
    ))
  }

  const handleTestConnection = (id: string) => {
    // Simulate connection test
    setIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { ...integration, status: 'syncing' as const }
        : integration
    ))
    
    setTimeout(() => {
      setIntegrations(prev => prev.map(integration => 
        integration.id === id 
          ? { ...integration, status: 'active' as const }
          : integration
      ))
    }, 2000)
  }

  const totalIntegrations = integrations.length
  const activeIntegrations = integrations.filter(i => i.status === 'active').length
  const errorIntegrations = integrations.filter(i => i.status === 'error').length
  const totalDataTransferred = integrations.reduce((sum, i) => sum + i.dataTransferred, 0)

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Integrations</h1>
          <p className="text-muted-foreground">
            Monitor and manage all enterprise data integrations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="real-time">Real-time</Label>
            <Switch
              id="real-time"
              checked={isRealTimeEnabled}
              onCheckedChange={setIsRealTimeEnabled}
            />
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Config
          </Button>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Config
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalIntegrations}</div>
            <p className="text-xs text-muted-foreground">
              {activeIntegrations} active, {errorIntegrations} with errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Transferred</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalDataTransferred / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground">
              Records processed today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.2%</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125ms</div>
            <p className="text-xs text-muted-foreground">
              -12ms from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Error Logs</TabsTrigger>
          <TabsTrigger value="schedule">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="syncing">Syncing</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>

          {/* Integrations Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Next Sync</TableHead>
                  <TableHead>Data Transferred</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIntegrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(integration.type)}
                        <div>
                          <div className="font-medium">{integration.name}</div>
                          {integration.config.endpoint && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {integration.config.endpoint}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{integration.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(integration.status)}`} />
                        {getStatusIcon(integration.status)}
                        <span className="capitalize">{integration.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(integration.lastSync).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(integration.nextSync).toLocaleString()}
                    </TableCell>
                    <TableCell>{integration.dataTransferred.toLocaleString()}</TableCell>
                    <TableCell>
                      {integration.errorCount > 0 ? (
                        <Badge variant="destructive">{integration.errorCount}</Badge>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleIntegration(integration.id)}
                        >
                          {integration.status === 'active' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(integration.id)}
                          disabled={integration.status === 'syncing'}
                        >
                          {integration.status === 'syncing' ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                        </Button>
                        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedIntegration(integration)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Configure Integration</DialogTitle>
                              <DialogDescription>
                                Update settings for {selectedIntegration?.name}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedIntegration && (
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="name" className="text-right">Name</Label>
                                  <Input
                                    id="name"
                                    value={selectedIntegration.name}
                                    className="col-span-3"
                                  />
                                </div>
                                {selectedIntegration.config.endpoint && (
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="endpoint" className="text-right">Endpoint</Label>
                                    <Input
                                      id="endpoint"
                                      value={selectedIntegration.config.endpoint}
                                      className="col-span-3"
                                    />
                                  </div>
                                )}
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="frequency" className="text-right">Frequency</Label>
                                  <Select value={selectedIntegration.config.frequency}>
                                    <SelectTrigger className="col-span-3">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="15m">Every 15 minutes</SelectItem>
                                      <SelectItem value="1h">Every hour</SelectItem>
                                      <SelectItem value="4h">Every 4 hours</SelectItem>
                                      <SelectItem value="6h">Every 6 hours</SelectItem>
                                      <SelectItem value="12h">Every 12 hours</SelectItem>
                                      <SelectItem value="24h">Daily</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="retries" className="text-right">Retry Count</Label>
                                  <Input
                                    id="retries"
                                    type="number"
                                    value={selectedIntegration.config.retryCount}
                                    className="col-span-3"
                                  />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="timeout" className="text-right">Timeout (ms)</Label>
                                  <Input
                                    id="timeout"
                                    type="number"
                                    value={selectedIntegration.config.timeout}
                                    className="col-span-3"
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={() => setIsConfigModalOpen(false)}>
                                Save Changes
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data Processing Rate</CardTitle>
                <CardDescription>Records processed per hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="recordsProcessed" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                    />