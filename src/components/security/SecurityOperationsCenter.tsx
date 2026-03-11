'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Eye, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Users,
  Database,
  Network,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  LineChart,
  Zap,
  FileText,
  Calendar
} from 'lucide-react';

// Types
interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'threat' | 'incident' | 'vulnerability' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  description: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
  metadata?: Record<string, any>;
}

interface ThreatIndicator {
  id: string;
  type: 'malware' | 'phishing' | 'ddos' | 'intrusion' | 'data_breach';
  confidence: number;
  count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastSeen: Date;
  blockedCount: number;
  allowedCount: number;
}

interface SecurityPolicy {
  id: string;
  name: string;
  category: 'firewall' | 'access_control' | 'data_protection' | 'monitoring';
  enabled: boolean;
  automated: boolean;
  rules: number;
  violations: number;
  lastUpdated: Date;
}

interface IncidentResponse {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  assignee: string;
  createdAt: Date;
  updatedAt: Date;
  playbook?: string;
  affectedAssets: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
}

interface ComplianceStatus {
  framework: string;
  score: number;
  requirements: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  };
  lastAssessment: Date;
}

interface SecurityOperationsCenterProps {
  className?: string;
  refreshInterval?: number;
  enableRealTime?: boolean;
  onSecurityEvent?: (event: SecurityEvent) => void;
  onIncidentStatusChange?: (incident: IncidentResponse) => void;
  onPolicyToggle?: (policyId: string, enabled: boolean) => void;
}

const SecurityOperationsCenter: React.FC<SecurityOperationsCenterProps> = ({
  className = '',
  refreshInterval = 30000,
  enableRealTime = true,
  onSecurityEvent,
  onIncidentStatusChange,
  onPolicyToggle
}) => {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [threatIndicators, setThreatIndicators] = useState<ThreatIndicator[]>([]);
  const [securityPolicies, setSecurityPolicies] = useState<SecurityPolicy[]>([]);
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data generators
  const generateMockSecurityEvents = useCallback((): SecurityEvent[] => {
    const types: SecurityEvent['type'][] = ['threat', 'incident', 'vulnerability', 'compliance'];
    const severities: SecurityEvent['severity'][] = ['critical', 'high', 'medium', 'low'];
    const statuses: SecurityEvent['status'][] = ['active', 'investigating', 'resolved', 'false_positive'];
    
    return Array.from({ length: 50 }, (_, i) => ({
      id: `event-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      source: `Source ${Math.floor(Math.random() * 10) + 1}`,
      description: `Security event ${i + 1} description`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      assignedTo: Math.random() > 0.5 ? `Analyst ${Math.floor(Math.random() * 5) + 1}` : undefined,
      location: {
        country: ['USA', 'UK', 'Germany', 'China', 'Russia'][Math.floor(Math.random() * 5)],
        city: ['New York', 'London', 'Berlin', 'Beijing', 'Moscow'][Math.floor(Math.random() * 5)],
        coordinates: [Math.random() * 180 - 90, Math.random() * 360 - 180] as [number, number]
      }
    }));
  }, []);

  const generateMockThreatIndicators = useCallback((): ThreatIndicator[] => {
    const types: ThreatIndicator['type'][] = ['malware', 'phishing', 'ddos', 'intrusion', 'data_breach'];
    const trends: ThreatIndicator['trend'][] = ['increasing', 'decreasing', 'stable'];
    
    return types.map((type, i) => ({
      id: `threat-${i}`,
      type,
      confidence: Math.floor(Math.random() * 40) + 60,
      count: Math.floor(Math.random() * 1000) + 100,
      trend: trends[Math.floor(Math.random() * trends.length)],
      lastSeen: new Date(Date.now() - Math.random() * 3600000),
      blockedCount: Math.floor(Math.random() * 800) + 200,
      allowedCount: Math.floor(Math.random() * 200) + 50
    }));
  }, []);

  const generateMockPolicies = useCallback((): SecurityPolicy[] => {
    const categories: SecurityPolicy['category'][] = ['firewall', 'access_control', 'data_protection', 'monitoring'];
    
    return Array.from({ length: 12 }, (_, i) => ({
      id: `policy-${i}`,
      name: `Security Policy ${i + 1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      enabled: Math.random() > 0.3,
      automated: Math.random() > 0.5,
      rules: Math.floor(Math.random() * 50) + 10,
      violations: Math.floor(Math.random() * 20),
      lastUpdated: new Date(Date.now() - Math.random() * 604800000)
    }));
  }, []);

  const generateMockIncidents = useCallback((): IncidentResponse[] => {
    const severities: IncidentResponse['severity'][] = ['critical', 'high', 'medium', 'low'];
    const statuses: IncidentResponse['status'][] = ['open', 'investigating', 'contained', 'resolved'];
    const impacts: IncidentResponse['estimatedImpact'][] = ['high', 'medium', 'low'];
    
    return Array.from({ length: 15 }, (_, i) => ({
      id: `incident-${i}`,
      title: `Security Incident ${i + 1}`,
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      assignee: `Analyst ${Math.floor(Math.random() * 5) + 1}`,
      createdAt: new Date(Date.now() - Math.random() * 604800000),
      updatedAt: new Date(Date.now() - Math.random() * 86400000),
      playbook: Math.random() > 0.5 ? `Playbook ${Math.floor(Math.random() * 3) + 1}` : undefined,
      affectedAssets: [`Asset ${Math.floor(Math.random() * 10) + 1}`],
      estimatedImpact: impacts[Math.floor(Math.random() * impacts.length)]
    }));
  }, []);

  const generateMockCompliance = useCallback((): ComplianceStatus[] => {
    const frameworks = ['SOC 2', 'ISO 27001', 'GDPR', 'HIPAA', 'PCI DSS'];
    
    return frameworks.map(framework => {
      const total = Math.floor(Math.random() * 100) + 50;
      const compliant = Math.floor(Math.random() * total);
      const nonCompliant = Math.floor(Math.random() * (total - compliant));
      const pending = total - compliant - nonCompliant;
      
      return {
        framework,
        score: Math.floor((compliant / total) * 100),
        requirements: {
          total,
          compliant,
          nonCompliant,
          pending
        },
        lastAssessment: new Date(Date.now() - Math.random() * 2592000000)
      };
    });
  }, []);

  // Initialize data
  useEffect(() => {
    setSecurityEvents(generateMockSecurityEvents());
    setThreatIndicators(generateMockThreatIndicators());
    setSecurityPolicies(generateMockPolicies());
    setIncidents(generateMockIncidents());
    setComplianceStatus(generateMockCompliance());
    setIsConnected(true);
  }, [generateMockSecurityEvents, generateMockThreatIndicators, generateMockPolicies, generateMockIncidents, generateMockCompliance]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !enableRealTime) return;

    const interval = setInterval(() => {
      // Simulate new events
      const newEvents = generateMockSecurityEvents().slice(0, 3);
      setSecurityEvents(prev => [...newEvents, ...prev].slice(0, 100));
      
      newEvents.forEach(event => {
        onSecurityEvent?.(event);
      });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, enableRealTime, refreshInterval, generateMockSecurityEvents, onSecurityEvent]);

  // Computed values
  const filteredEvents = useMemo(() => {
    return securityEvents.filter(event => {
      if (filterSeverity !== 'all' && event.severity !== filterSeverity) return false;
      return true;
    });
  }, [securityEvents, filterSeverity]);

  const securityMetrics = useMemo(() => {
    const activeThreats = securityEvents.filter(e => e.type === 'threat' && e.status === 'active').length;
    const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
    const policyViolations = securityPolicies.reduce((sum, p) => sum + p.violations, 0);
    const avgComplianceScore = complianceStatus.reduce((sum, c) => sum + c.score, 0) / complianceStatus.length;
    
    return {
      activeThreats,
      criticalIncidents,
      policyViolations,
      avgComplianceScore: Math.round(avgComplianceScore)
    };
  }, [securityEvents, incidents, securityPolicies, complianceStatus]);

  // Event handlers
  const handlePolicyToggle = useCallback((policyId: string, enabled: boolean) => {
    setSecurityPolicies(prev => 
      prev.map(policy => 
        policy.id === policyId 
          ? { ...policy, enabled, lastUpdated: new Date() }
          : policy
      )
    );
    onPolicyToggle?.(policyId, enabled);
  }, [onPolicyToggle]);

  const handleIncidentStatusChange = useCallback((incidentId: string, newStatus: IncidentResponse['status']) => {
    setIncidents(prev => 
      prev.map(incident => 
        incident.id === incidentId 
          ? { ...incident, status: newStatus, updatedAt: new Date() }
          : incident
      )
    );
    const updatedIncident = incidents.find(i => i.id === incidentId);
    if (updatedIncident) {
      onIncidentStatusChange?.({ ...updatedIncident, status: newStatus });
    }
  }, [incidents, onIncidentStatusChange]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ShieldAlert className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <AlertCircle className="h-4 w-4" />;
      case 'low': return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Operations Center</h1>
          <p className="text-muted-foreground">
            Real-time security monitoring and incident response dashboard
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="6h">6h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh
            </Label>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{securityMetrics.activeThreats}</div>
            <p className="text-xs text-muted-foreground">
              {securityMetrics.activeThreats > 5 ? '+12% from last hour' : '-5% from last hour'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{securityMetrics.criticalIncidents}</div>
            <p className="text-xs text-muted-foreground">
              {securityMetrics.criticalIncidents > 2 ? '+2 from last hour' : 'No change'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Policy Violations</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{securityMetrics.policyViolations}</div>
            <p className="text-xs text-muted-foreground">
              -15% from yesterday
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{securityMetrics.avgComplianceScore}%</div>
            <p className="text-xs text-muted-foreground">
              +2% from last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Real-Time Alerts Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Real-Time Security Events</span>
                </CardTitle>
                <CardDescription>Latest security events and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="severity-filter" className="text-sm">Filter by severity:</Label>
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                      <SelectTrigger id="severity-filter" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {filteredEvents.slice(0, 10).map((event) => (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getSeverityColor(event.severity)}`}>
                          {getSeverityIcon(event.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{event.description}</p>
                            <Badge variant={event.status === 'active' ? 'destructive' : 'secondary'}>
                              {event.status}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{