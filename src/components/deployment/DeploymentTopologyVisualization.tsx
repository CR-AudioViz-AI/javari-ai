```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Server, 
  Database, 
  Globe, 
  Cpu, 
  MemoryStick, 
  HardDrive,
  Network,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Info
} from 'lucide-react'

interface ServiceMetrics {
  cpu: number
  memory: number
  disk: number
  network: number
  requests: number
  errors: number
  latency: number
}

interface Service {
  id: string
  name: string
  type: 'api' | 'database' | 'frontend' | 'worker' | 'gateway' | 'cache'
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  version: string
  replicas: number
  dependencies: string[]
  position: { x: number; y: number }
  metrics: ServiceMetrics
  alerts: Alert[]
  lastUpdated: Date
}

interface Connection {
  id: string
  source: string
  target: string
  type: 'http' | 'tcp' | 'grpc' | 'database' | 'message_queue'
  status: 'active' | 'inactive' | 'error'
  latency: number
  throughput: number
}

interface Alert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

interface DeploymentTopologyVisualizationProps {
  deploymentId: string
  className?: string
  onServiceSelect?: (service: Service) => void
  onConnectionSelect?: (connection: Connection) => void
  refreshInterval?: number
  enableRealtime?: boolean
}

const DeploymentTopologyVisualization: React.FC<DeploymentTopologyVisualizationProps> = ({
  deploymentId,
  className = '',
  onServiceSelect,
  onConnectionSelect,
  refreshInterval = 30000,
  enableRealtime = true
}) => {
  const [services, setServices] = useState<Service[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [showMetrics, setShowMetrics] = useState(true)
  const [showDependencies, setShowDependencies] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Mock data for demonstration
  const mockServices: Service[] = [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      type: 'gateway',
      status: 'healthy',
      version: '2.1.0',
      replicas: 3,
      dependencies: ['auth-service', 'user-service'],
      position: { x: 200, y: 100 },
      metrics: { cpu: 45, memory: 60, disk: 30, network: 80, requests: 1250, errors: 2, latency: 120 },
      alerts: [],
      lastUpdated: new Date()
    },
    {
      id: 'auth-service',
      name: 'Authentication Service',
      type: 'api',
      status: 'healthy',
      version: '1.8.2',
      replicas: 2,
      dependencies: ['auth-db', 'redis-cache'],
      position: { x: 100, y: 250 },
      metrics: { cpu: 30, memory: 40, disk: 20, network: 60, requests: 800, errors: 1, latency: 85 },
      alerts: [],
      lastUpdated: new Date()
    },
    {
      id: 'user-service',
      name: 'User Service',
      type: 'api',
      status: 'warning',
      version: '2.0.1',
      replicas: 3,
      dependencies: ['user-db'],
      position: { x: 300, y: 250 },
      metrics: { cpu: 75, memory: 85, disk: 40, network: 95, requests: 2100, errors: 15, latency: 280 },
      alerts: [
        { id: '1', severity: 'medium', message: 'High memory usage detected', timestamp: new Date(), resolved: false }
      ],
      lastUpdated: new Date()
    },
    {
      id: 'auth-db',
      name: 'Auth Database',
      type: 'database',
      status: 'healthy',
      version: '14.5',
      replicas: 1,
      dependencies: [],
      position: { x: 50, y: 400 },
      metrics: { cpu: 25, memory: 55, disk: 60, network: 40, requests: 500, errors: 0, latency: 45 },
      alerts: [],
      lastUpdated: new Date()
    },
    {
      id: 'user-db',
      name: 'User Database',
      type: 'database',
      status: 'critical',
      version: '14.5',
      replicas: 1,
      dependencies: [],
      position: { x: 350, y: 400 },
      metrics: { cpu: 90, memory: 95, disk: 85, network: 70, requests: 1800, errors: 25, latency: 450 },
      alerts: [
        { id: '2', severity: 'critical', message: 'Database connection pool exhausted', timestamp: new Date(), resolved: false },
        { id: '3', severity: 'high', message: 'Disk usage above 85%', timestamp: new Date(), resolved: false }
      ],
      lastUpdated: new Date()
    },
    {
      id: 'redis-cache',
      name: 'Redis Cache',
      type: 'cache',
      status: 'healthy',
      version: '7.0.5',
      replicas: 2,
      dependencies: [],
      position: { x: 150, y: 400 },
      metrics: { cpu: 15, memory: 35, disk: 10, network: 50, requests: 3000, errors: 0, latency: 12 },
      alerts: [],
      lastUpdated: new Date()
    }
  ]

  const mockConnections: Connection[] = [
    { id: '1', source: 'api-gateway', target: 'auth-service', type: 'http', status: 'active', latency: 25, throughput: 1200 },
    { id: '2', source: 'api-gateway', target: 'user-service', type: 'http', status: 'active', latency: 45, throughput: 2000 },
    { id: '3', source: 'auth-service', target: 'auth-db', type: 'database', status: 'active', latency: 15, throughput: 800 },
    { id: '4', source: 'auth-service', target: 'redis-cache', type: 'tcp', status: 'active', latency: 8, throughput: 1500 },
    { id: '5', source: 'user-service', target: 'user-db', type: 'database', status: 'error', latency: 250, throughput: 1800 }
  ]

  useEffect(() => {
    // Simulate initial data load
    setIsLoading(true)
    setTimeout(() => {
      setServices(mockServices)
      setConnections(mockConnections)
      setAlerts(mockServices.flatMap(s => s.alerts))
      setIsLoading(false)
    }, 1000)
  }, [deploymentId])

  useEffect(() => {
    if (!enableRealtime) return

    const interval = setInterval(() => {
      // Simulate real-time updates
      setServices(prev => prev.map(service => ({
        ...service,
        metrics: {
          ...service.metrics,
          cpu: Math.max(0, Math.min(100, service.metrics.cpu + (Math.random() - 0.5) * 10)),
          memory: Math.max(0, Math.min(100, service.metrics.memory + (Math.random() - 0.5) * 8)),
          requests: Math.max(0, service.metrics.requests + Math.floor((Math.random() - 0.5) * 100))
        },
        lastUpdated: new Date()
      })))
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [enableRealtime, refreshInterval])

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || service.status === filterStatus
      const matchesType = filterType === 'all' || service.type === filterType
      return matchesSearch && matchesStatus && matchesType
    })
  }, [services, searchTerm, filterStatus, filterType])

  const getServiceIcon = (type: Service['type']) => {
    switch (type) {
      case 'api': return Server
      case 'database': return Database
      case 'frontend': return Globe
      case 'worker': return Cpu
      case 'gateway': return Network
      case 'cache': return MemoryStick
      default: return Server
    }
  }

  const getStatusColor = (status: Service['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'critical': return 'text-red-500'
      case 'unknown': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusBadgeVariant = (status: Service['status']) => {
    switch (status) {
      case 'healthy': return 'default'
      case 'warning': return 'secondary'
      case 'critical': return 'destructive'
      case 'unknown': return 'outline'
      default: return 'outline'
    }
  }

  const handleServiceClick = useCallback((service: Service) => {
    setSelectedService(service)
    onServiceSelect?.(service)
  }, [onServiceSelect])

  const handleConnectionClick = useCallback((connection: Connection) => {
    setSelectedConnection(connection)
    onConnectionSelect?.(connection)
  }, [onConnectionSelect])

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(3, prev + 0.2))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev - 0.2))
  }

  const handleReset = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const ServiceNode: React.FC<{ service: Service; isSelected: boolean }> = ({ service, isSelected }) => {
    const Icon = getServiceIcon(service.type)
    const statusColor = getStatusColor(service.status)
    
    return (
      <g
        transform={`translate(${service.position.x}, ${service.position.y})`}
        className="cursor-pointer"
        onClick={() => handleServiceClick(service)}
      >
        <rect
          x={-50}
          y={-30}
          width={100}
          height={60}
          rx={8}
          fill={isSelected ? '#3b82f6' : '#ffffff'}
          stroke={isSelected ? '#1d4ed8' : '#e5e7eb'}
          strokeWidth={isSelected ? 2 : 1}
          className="drop-shadow-sm"
        />
        <Icon className={`w-6 h-6 ${statusColor}`} x={-12} y={-12} />
        <text
          x={0}
          y={5}
          textAnchor="middle"
          className="text-xs font-medium fill-gray-900"
        >
          {service.name}
        </text>
        <text
          x={0}
          y={20}
          textAnchor="middle"
          className="text-xs fill-gray-500"
        >
          v{service.version}
        </text>
        {service.alerts.length > 0 && (
          <circle
            cx={35}
            cy={-20}
            r={6}
            fill="#ef4444"
            className="animate-pulse"
          />
        )}
        {showMetrics && (
          <g transform="translate(-45, 35)">
            <rect width={90} height={25} rx={4} fill="#f9fafb" stroke="#e5e7eb" />
            <text x={45} y={12} textAnchor="middle" className="text-xs fill-gray-600">
              CPU: {service.metrics.cpu}%
            </text>
            <text x={45} y={22} textAnchor="middle" className="text-xs fill-gray-600">
              Mem: {service.metrics.memory}%
            </text>
          </g>
        )}
      </g>
    )
  }

  const ConnectionEdge: React.FC<{ connection: Connection; sourceService: Service; targetService: Service }> = ({
    connection,
    sourceService,
    targetService
  }) => {
    const getConnectionColor = (status: Connection['status']) => {
      switch (status) {
        case 'active': return '#22c55e'
        case 'inactive': return '#6b7280'
        case 'error': return '#ef4444'
        default: return '#6b7280'
      }
    }

    const color = getConnectionColor(connection.status)
    const strokeWidth = connection.status === 'active' ? 2 : 1
    const strokeDasharray = connection.status === 'inactive' ? '5,5' : 'none'

    return (
      <g onClick={() => handleConnectionClick(connection)} className="cursor-pointer">
        <line
          x1={sourceService.position.x}
          y1={sourceService.position.y}
          x2={targetService.position.x}
          y2={targetService.position.y}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          markerEnd="url(#arrowhead)"
        />
        {connection.status === 'active' && (
          <circle
            cx={(sourceService.position.x + targetService.position.x) / 2}
            cy={(sourceService.position.y + targetService.position.y) / 2}
            r={3}
            fill={color}
            className="animate-pulse"
          />
        )}
      </g>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Deployment Topology</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMetrics(!showMetrics)}
            >
              {showMetrics ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Metrics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDependencies(!showDependencies)}
            >
              {showDependencies ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Dependencies
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter">Status:</Label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="type-filter">Type:</Label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm"
            >
              <option value="all">All</option>
              <option value="api">API</option>
              <option value="database">Database</option>
              <option value="frontend">Frontend</option>
              <option value="worker">Worker</option>
              <option value="gateway">Gateway</option>
              <option value="cache">Cache</option>
            </select>
          </div>
        </div>

        {/* Alerts Summary */}
        {alerts.filter(a => !a.resolved).length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {alerts.filter(a => !a.resolved).length} active alert(s) detected. Check service details for more information.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Topology Visualization */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Network Topology</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative border rounded-lg bg-gray-50 overflow-hidden" style={{ height: '500px' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 500 500"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-move"
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                  </marker>
                </defs>

                <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                  {/* Render connections first (behind nodes) */}
                  {showDependencies && connections.map(connection => {
                    const sourceService = services.find(s => s.id === connection.source)
                    const targetService = services.find(s => s.id === connection.target)
                    if (!sourceService || !targetService) return null
                    
                    return (
                      <ConnectionEdge
                        key={connection.id}
                        connection={connection}
                        sourceService={sourceService}
                        targetService={targetService}
                      />