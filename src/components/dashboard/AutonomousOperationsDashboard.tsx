```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  TrendingUp,
  Activity,
  Shield,
  Brain,
  Zap,
  Eye,
  History,
  RotateCcw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface SystemStatus {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error' | 'maintenance';
  lastUpdate: string;
  uptime: number;
  performance: number;
  activeDecisions: number;
}

interface DecisionProcess {
  id: string;
  timestamp: string;
  processType: string;
  confidence: number;
  reasoning: string;
  outcome: 'approved' | 'rejected' | 'pending';
  executionTime: number;
  factors: Array<{
    name: string;
    weight: number;
    value: number;
  }>;
}

interface InterventionRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  recommendedAction: string;
  estimatedImpact: string;
  confidence: number;
  timestamp: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  system: string;
  details: string;
  outcome: 'success' | 'failure' | 'warning';
}

interface PerformanceMetric {
  timestamp: string;
  accuracy: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

interface AutonomousOperationsDashboardProps {
  className?: string;
  refreshInterval?: number;
  showAdvancedMetrics?: boolean;
  enableManualOverride?: boolean;
}

export function AutonomousOperationsDashboard({
  className = '',
  refreshInterval = 5000,
  showAdvancedMetrics = true,
  enableManualOverride = true
}: AutonomousOperationsDashboardProps) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus[]>([]);
  const [decisionProcesses, setDecisionProcesses] = useState<DecisionProcess[]>([]);
  const [interventionRecommendations, setInterventionRecommendations] = useState<InterventionRecommendation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [overrideMode, setOverrideMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data initialization
  useEffect(() => {
    const initializeMockData = () => {
      setSystemStatus([
        {
          id: 'audio-processor',
          name: 'Audio Processing Engine',
          status: 'active',
          lastUpdate: new Date().toISOString(),
          uptime: 99.7,
          performance: 94,
          activeDecisions: 12
        },
        {
          id: 'quality-analyzer',
          name: 'Quality Analysis System',
          status: 'active',
          lastUpdate: new Date().toISOString(),
          uptime: 99.9,
          performance: 97,
          activeDecisions: 8
        },
        {
          id: 'resource-manager',
          name: 'Resource Manager',
          status: 'paused',
          lastUpdate: new Date().toISOString(),
          uptime: 98.5,
          performance: 85,
          activeDecisions: 3
        }
      ]);

      setDecisionProcesses([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          processType: 'Audio Quality Optimization',
          confidence: 92,
          reasoning: 'High noise levels detected, applying adaptive filtering with 92% confidence based on historical patterns',
          outcome: 'approved',
          executionTime: 45,
          factors: [
            { name: 'Noise Level', weight: 0.4, value: 0.8 },
            { name: 'Signal Quality', weight: 0.3, value: 0.6 },
            { name: 'Processing Load', weight: 0.2, value: 0.3 },
            { name: 'User Preference', weight: 0.1, value: 0.9 }
          ]
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          processType: 'Resource Allocation',
          confidence: 78,
          reasoning: 'Moderate confidence in reallocating processing resources based on current workload analysis',
          outcome: 'pending',
          executionTime: 32,
          factors: [
            { name: 'CPU Usage', weight: 0.5, value: 0.7 },
            { name: 'Memory Usage', weight: 0.3, value: 0.5 },
            { name: 'Queue Length', weight: 0.2, value: 0.8 }
          ]
        }
      ]);

      setInterventionRecommendations([
        {
          id: '1',
          priority: 'high',
          type: 'Performance Optimization',
          description: 'Processing latency has increased by 15% over the last hour',
          recommendedAction: 'Scale up processing nodes or optimize current algorithms',
          estimatedImpact: 'Reduce latency by 20-30%',
          confidence: 85,
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          priority: 'medium',
          type: 'Resource Management',
          description: 'Memory usage approaching 80% threshold',
          recommendedAction: 'Implement garbage collection or increase memory allocation',
          estimatedImpact: 'Prevent potential system slowdown',
          confidence: 72,
          timestamp: new Date(Date.now() - 600000).toISOString()
        }
      ]);

      setAuditLogs([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          action: 'Manual Override Activated',
          user: 'admin@audioviz.com',
          system: 'Audio Processing Engine',
          details: 'Emergency override to prevent audio distortion',
          outcome: 'success'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          action: 'Autonomous Decision Approved',
          user: 'system',
          system: 'Quality Analysis System',
          details: 'Automatic quality enhancement applied',
          outcome: 'success'
        }
      ]);

      const generatePerformanceData = () => {
        const data = [];
        for (let i = 23; i >= 0; i--) {
          data.push({
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            accuracy: 85 + Math.random() * 10,
            responseTime: 50 + Math.random() * 30,
            throughput: 100 + Math.random() * 50,
            errorRate: Math.random() * 5
          });
        }
        return data;
      };

      setPerformanceMetrics(generatePerformanceData());
      setLoading(false);
    };

    initializeMockData();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      // Simulate real-time updates
      setSystemStatus(prev => prev.map(system => ({
        ...system,
        lastUpdate: new Date().toISOString(),
        performance: Math.max(70, Math.min(100, system.performance + (Math.random() - 0.5) * 5))
      })));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleManualOverride = (systemId: string, action: string) => {
    const newAuditEntry: AuditLogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action: `Manual Override: ${action}`,
      user: 'current-user@audioviz.com',
      system: systemId,
      details: `Manual intervention executed: ${action}`,
      outcome: 'success'
    };

    setAuditLogs(prev => [newAuditEntry, ...prev]);
    
    // Update system status
    setSystemStatus(prev => prev.map(system => 
      system.id === systemId 
        ? { ...system, status: action === 'pause' ? 'paused' : 'active' as any }
        : system
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'paused': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'maintenance': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'maintenance': return <Settings className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading autonomous operations dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Manual Override Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Autonomous Operations</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and control of autonomous systems
          </p>
        </div>
        {enableManualOverride && (
          <div className="flex items-center gap-4">
            <Badge variant={overrideMode ? "destructive" : "secondary"}>
              {overrideMode ? "Manual Override Active" : "Autonomous Mode"}
            </Badge>
            <Button
              variant={overrideMode ? "destructive" : "outline"}
              onClick={() => setOverrideMode(!overrideMode)}
            >
              <Shield className="h-4 w-4 mr-2" />
              {overrideMode ? "Disable Override" : "Enable Override"}
            </Button>
          </div>
        )}
      </div>

      {/* System Status Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {systemStatus.map((system) => (
          <Card key={system.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{system.name}</CardTitle>
              <div className={`flex items-center gap-1 ${getStatusColor(system.status)}`}>
                {getStatusIcon(system.status)}
                <span className="text-xs capitalize">{system.status}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Performance</span>
                  <span>{system.performance}%</span>
                </div>
                <Progress value={system.performance} className="h-2" />
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>Uptime: {system.uptime}%</div>
                  <div>Decisions: {system.activeDecisions}</div>
                </div>
                {overrideMode && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualOverride(system.id, 'pause')}
                      disabled={system.status === 'paused'}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualOverride(system.id, 'resume')}
                      disabled={system.status === 'active'}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualOverride(system.id, 'restart')}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="decisions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="decisions">Decision Processes</TabsTrigger>
          <TabsTrigger value="interventions">Interventions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Decision Processes Tab */}
        <TabsContent value="decisions" className="space-y-4">
          <div className="grid gap-4">
            {decisionProcesses.map((process) => (
              <Card key={process.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      {process.processType}
                    </CardTitle>
                    <Badge variant={process.outcome === 'approved' ? 'default' : 
                                   process.outcome === 'rejected' ? 'destructive' : 'secondary'}>
                      {process.outcome}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Confidence:</span>
                        <Badge variant="outline">{process.confidence}%</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{process.executionTime}ms</span>
                      </div>
                    </div>
                    
                    <div>
                      <Progress value={process.confidence} className="h-2" />
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Reasoning:</p>
                      <p className="text-sm">{process.reasoning}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Decision Factors:</p>
                      <div className="grid gap-2">
                        {process.factors.map((factor, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{factor.name}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={factor.value * 100} className="w-20 h-2" />
                              <span className="text-xs text-muted-foreground">
                                {(factor.weight * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Interventions Tab */}
        <TabsContent value="interventions" className="space-y-4">
          <div className="grid gap-4">
            {interventionRecommendations.map((intervention) => (
              <Card key={intervention.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {intervention.type}
                    </CardTitle>
                    <Badge variant={getPriorityColor(intervention.priority) as any}>
                      {intervention.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm">{intervention.description}</p>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Recommended Action:</p>
                      <p className="text-sm">{intervention.recommendedAction}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estimated Impact:</p>
                      <p className="text-sm">{intervention.estimatedImpact}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Confidence:</span>
                        <Badge variant="outline">{intervention.confidence}%</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                        <Button size="sm">
                          <Zap className="h-3 w-3 mr-1" />
                          Execute
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {showAdvancedMetrics && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>System Accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={performanceMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                      />
                      <Area type="monotone" dataKey="accuracy" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Time & Throughput</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={performanceMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Response Time (ms)" />
                      <Line type="monotone" dataKey="throughput" stroke="#82ca9d" name="Throughput" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Error Rate Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={performanceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Area type="monot