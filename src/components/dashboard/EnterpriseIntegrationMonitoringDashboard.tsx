```tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  Eye, 
  Filter, 
  Pause, 
  Play, 
  RefreshCw, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  XCircle,
  Zap,
  Server,
  Database,
  Globe,
  Shield
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

interface IntegrationHealth {
  id: string;
  name: string;
  type: 'api' | 'database' | 'webhook' | 'queue' | 'file_transfer';
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  uptime: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  lastChecked: Date;
  endpoint?: string;
  version?: string;
  dependencies: string[];
}

interface PerformanceMetric {
  timestamp: Date;
  integrationId: string;
  responseTime: number;
  throughput: number;
  errorCount: number;
  successCount: number;
}

interface AlertRule {
  id: string;
  integrationId: string;
  type: 'uptime' | 'response_time' | 'error_rate' | 'throughput';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

interface IntegrationAlert {
  id: string;
  integrationId: string;
  integrationName: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

interface IntegrationLog {
  id: string;
  integrationId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
  duration?: number;
  statusCode?: number;
}

interface EnterpriseIntegrationMonitoringDashboardProps {
  refreshInterval?: number;
  maxAlerts?: number;
  enableAutoRefresh?: boolean;
  onIntegrationClick?: (integration: IntegrationHealth) => void;
  onAlertAcknowledge?: (alertId: string) => void;
  onExportData?: (filters: FilterOptions) => void;
  className?: string;
}

interface FilterOptions {
  status?: string[];
  type?: string[];
  timeRange?: string;
  searchTerm?: string;
}

const EnterpriseIntegrationMonitoringDashboard = ({
  refreshInterval = 30000,
  maxAlerts = 50,
  enableAutoRefresh = true,
  onIntegrationClick,
  onAlertAcknowledge,
  onExportData,
  className = ""
}: EnterpriseIntegrationMonitoringDashboardProps) => {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<IntegrationAlert[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationHealth | null>(null);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(enableAutoRefresh);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const wsRef = useRef<WebSocket>();

  // Mock data - replace with actual API calls
  const mockIntegrations: IntegrationHealth[] = [
    {
      id: '1',
      name: 'Salesforce CRM API',
      type: 'api',
      status: 'healthy',
      uptime: 99.9,
      responseTime: 145,
      throughput: 1250,
      errorRate: 0.1,
      lastChecked: new Date(),
      endpoint: 'https://api.salesforce.com/v1',
      version: 'v52.0',
      dependencies: ['OAuth Service', 'Rate Limiter']
    },
    {
      id: '2',
      name: 'PostgreSQL Main DB',
      type: 'database',
      status: 'warning',
      uptime: 98.5,
      responseTime: 89,
      throughput: 850,
      errorRate: 2.3,
      lastChecked: new Date(),
      version: '14.2',
      dependencies: ['Connection Pool', 'Backup Service']
    },
    {
      id: '3',
      name: 'Payment Gateway Webhook',
      type: 'webhook',
      status: 'critical',
      uptime: 95.2,
      responseTime: 2340,
      throughput: 45,
      errorRate: 8.7,
      lastChecked: new Date(),
      endpoint: 'https://webhooks.payments.com/notify',
      version: 'v3.1',
      dependencies: ['SSL Certificate', 'Load Balancer']
    },
    {
      id: '4',
      name: 'Message Queue Redis',
      type: 'queue',
      status: 'healthy',
      uptime: 99.7,
      responseTime: 12,
      throughput: 5400,
      errorRate: 0.3,
      lastChecked: new Date(),
      version: '6.2.6',
      dependencies: ['Redis Cluster', 'Sentinel']
    }
  ];

  const mockAlerts: IntegrationAlert[] = [
    {
      id: '1',
      integrationId: '3',
      integrationName: 'Payment Gateway Webhook',
      type: 'response_time',
      severity: 'critical',
      message: 'Response time exceeded 2000ms threshold (2340ms)',
      timestamp: new Date(Date.now() - 300000),
      acknowledged: false
    },
    {
      id: '2',
      integrationId: '2',
      integrationName: 'PostgreSQL Main DB',
      type: 'error_rate',
      severity: 'medium',
      message: 'Error rate increased to 2.3% (threshold: 1%)',
      timestamp: new Date(Date.now() - 600000),
      acknowledged: false
    }
  ];

  useEffect(() => {
    loadInitialData();
    setupWebSocketConnection();
    
    if (isAutoRefreshEnabled) {
      startAutoRefresh();
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isAutoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }, [isAutoRefreshEnabled, refreshInterval]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      // Replace with actual API calls
      setIntegrations(mockIntegrations);
      setAlerts(mockAlerts);
      
      // Generate mock performance metrics
      const metrics = generateMockMetrics();
      setPerformanceMetrics(metrics);
      
      // Generate mock logs
      const logs = generateMockLogs();
      setLogs(logs);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockMetrics = (): PerformanceMetric[] => {
    const metrics: PerformanceMetric[] = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      mockIntegrations.forEach(integration => {
        metrics.push({
          timestamp,
          integrationId: integration.id,
          responseTime: integration.responseTime + Math.random() * 100 - 50,
          throughput: integration.throughput + Math.random() * 200 - 100,
          errorCount: Math.floor(Math.random() * 10),
          successCount: Math.floor(Math.random() * 1000) + 500
        });
      });
    }
    
    return metrics;
  };

  const generateMockLogs = (): IntegrationLog[] => {
    const logs: IntegrationLog[] = [];
    const now = new Date();
    
    for (let i = 100; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      const integration = mockIntegrations[Math.floor(Math.random() * mockIntegrations.length)];
      
      logs.push({
        id: `log-${i}`,
        integrationId: integration.id,
        timestamp,
        level: ['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)] as any,
        message: `Integration ${integration.name} processed request`,
        duration: Math.floor(Math.random() * 500) + 50,
        statusCode: 200 + Math.floor(Math.random() * 300),
        metadata: { requestId: `req-${i}`, userId: `user-${Math.floor(Math.random() * 1000)}` }
      });
    }
    
    return logs.reverse();
  };

  const setupWebSocketConnection = () => {
    // Mock WebSocket connection - replace with actual implementation
    const mockWs = {
      close: () => {}
    };
    wsRef.current = mockWs as any;
  };

  const startAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setInterval(() => {
      loadInitialData();
    }, refreshInterval);
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = undefined;
    }
  };

  const handleManualRefresh = () => {
    loadInitialData();
  };

  const handleIntegrationClick = (integration: IntegrationHealth) => {
    setSelectedIntegration(integration);
    onIntegrationClick?.(integration);
  };

  const handleAlertAcknowledge = async (alertId: string) => {
    try {
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true }
            : alert
        )
      );
      onAlertAcknowledge?.(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleExportData = () => {
    onExportData?.({ ...filters, searchTerm, timeRange });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api':
        return <Globe className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'webhook':
        return <Zap className="h-4 w-4" />;
      case 'queue':
        return <Server className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-600 bg-blue-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = !searchTerm || 
      integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !filters.status?.length || 
      filters.status.includes(integration.status);
    
    const matchesType = !filters.type?.length || 
      filters.type.includes(integration.type);
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const healthyCount = integrations.filter(i => i.status === 'healthy').length;
  const warningCount = integrations.filter(i => i.status === 'warning').length;
  const criticalCount = integrations.filter(i => i.status === 'critical').length;
  const avgResponseTime = integrations.reduce((sum, i) => sum + i.responseTime, 0) / integrations.length;
  const totalThroughput = integrations.reduce((sum, i) => sum + i.throughput, 0);
  const avgUptime = integrations.reduce((sum, i) => sum + i.uptime, 0) / integrations.length;

  if (isLoading) {
    return (
      <div className={`p-6 space-y-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Integration Monitoring</h1>
          <p className="text-muted-foreground mt-2">
            Real-time health monitoring and performance metrics for all enterprise integrations
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={isAutoRefreshEnabled}
              onCheckedChange={setIsAutoRefreshEnabled}
              id="auto-refresh"
            />
            <label htmlFor="auto-refresh" className="text-sm font-medium">
              Auto Refresh
            </label>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrations.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                {healthyCount} Healthy
              </span>
              <span className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1" />
                {warningCount} Warning
              </span>
              <span className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
                {criticalCount} Critical
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgResponseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="inline h-3 w-3 mr-1 text-green-600" />
              12% improvement from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalThroughput.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              requests/minute across all integrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Uptime</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUptime.toFixed(1)}%</div>
            <Progress value={avgUptime} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filters.status?.join(',') || ''} onValueChange={(value) => 
              setFilters(prev => ({ ...prev, status: value ? value.split(',') : undefined }))
            }>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="