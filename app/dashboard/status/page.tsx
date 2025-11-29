'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Cloud,
  Brain,
  Cpu,
  Server,
  Wifi,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  details?: Record<string, any>;
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  responseTimeMs: number;
  version: string;
  environment: string;
  components: ComponentStatus[];
  summary: {
    operational: number;
    degraded: number;
    down: number;
    total: number;
  };
  capabilities: Record<string, boolean>;
  endpoints: Record<string, string>;
}

interface HealthCheck {
  healthy: boolean;
  status: string;
  timestamp: string;
  responseTimeMs: number;
  checks: Record<string, string>;
  stats: Record<string, number>;
}

export default function StatusPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const [statusRes, healthRes] = await Promise.all([
        fetch('/api/javari/status'),
        fetch('/api/javari/health'),
      ]);

      if (statusRes.ok) {
        setSystemStatus(await statusRes.json());
      }
      if (healthRes.ok) {
        setHealthCheck(await healthRes.json());
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down':
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
      case 'warn':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getComponentIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'database':
        return <Database className="h-5 w-5" />;
      case 'knowledge base':
        return <Brain className="h-5 w-5" />;
      case 'openai provider':
      case 'claude provider':
        return <Cpu className="h-5 w-5" />;
      case 'apps registry':
        return <Server className="h-5 w-5" />;
      case 'conversations':
        return <Cloud className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const overallHealth = systemStatus?.status === 'operational' ? 100 :
    systemStatus?.status === 'degraded' ? 75 : 25;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            System Status
          </h1>
          <p className="text-muted-foreground mt-1">
            Javari AI System Health Monitor
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchStatus} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <Card className={`mb-6 ${systemStatus ? getStatusColor(systemStatus.status) : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {systemStatus && getStatusIcon(systemStatus.status)}
              <div>
                <h2 className="text-2xl font-bold capitalize">
                  {systemStatus?.status || 'Checking...'}
                </h2>
                <p className="text-sm opacity-80">
                  All systems are {systemStatus?.status === 'operational' ? 'running normally' : 
                    systemStatus?.status === 'degraded' ? 'experiencing some issues' : 'down'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Response Time</p>
              <p className="text-xl font-bold">{systemStatus?.responseTimeMs || 0}ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Components</p>
                <p className="text-2xl font-bold">{systemStatus?.summary.total || 0}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Operational</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemStatus?.summary.operational || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Knowledge</p>
                <p className="text-2xl font-bold">
                  {healthCheck?.stats?.knowledgeEntries || 0}
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="text-2xl font-bold">{systemStatus?.version || '1.0.0'}</p>
              </div>
              <Wifi className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Component Status</CardTitle>
          <CardDescription>Real-time status of all system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemStatus?.components.map((component) => (
              <div
                key={component.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {getComponentIcon(component.name)}
                  <div>
                    <p className="font-medium">{component.name}</p>
                    {component.details && (
                      <p className="text-sm text-muted-foreground">
                        {Object.entries(component.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(component.status)}
                  <Badge className={getStatusColor(component.status)}>
                    {component.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Capabilities & Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
            <CardDescription>Available system features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemStatus?.capabilities &&
                Object.entries(systemStatus.capabilities).map(([name, enabled]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {enabled ? (
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Available API routes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemStatus?.endpoints &&
                Object.entries(systemStatus.endpoints).map(([name, path]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="capitalize">{name}</span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{path}</code>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
