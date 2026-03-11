```tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Target, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  MapPin,
  Zap,
  Eye,
  AlertCircle,
  Users,
  Server,
  Lock,
  Unlock,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'intrusion' | 'malware' | 'data_breach' | 'unauthorized_access';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  description: string;
  status: 'active' | 'investigating' | 'resolved';
  assignedTo?: string;
}

interface ThreatLocation {
  id: string;
  location: string;
  country: string;
  coordinates: [number, number];
  threatCount: number;
  threatTypes: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface Vulnerability {
  id: string;
  asset: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss: number;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  daysOpen: number;
  category: string;
}

interface ComplianceFramework {
  name: string;
  score: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  status: 'compliant' | 'non_compliant' | 'partial';
  lastAssessment: Date;
}

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  assignedTeam: string;
  createdAt: Date;
  estimatedResolution?: Date;
  affectedAssets: number;
  responseStage: 'detection' | 'analysis' | 'containment' | 'eradication' | 'recovery';
}

interface SecurityOperationsCenterDashboardProps {
  className?: string;
  refreshInterval?: number;
  onIncidentEscalate?: (incident: Incident) => void;
  onSecurityEventAcknowledge?: (eventId: string) => void;
  onVulnerabilityAssign?: (vulnerabilityId: string, assignee: string) => void;
}

const SecurityOperationsCenterDashboard: React.FC<SecurityOperationsCenterDashboardProps> = ({
  className = "",
  refreshInterval = 30000,
  onIncidentEscalate,
  onSecurityEventAcknowledge,
  onVulnerabilityAssign
}) => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [threatLocations, setThreatLocations] = useState<ThreatLocation[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [complianceFrameworks, setComplianceFrameworks] = useState<ComplianceFramework[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [securityScore, setSecurityScore] = useState(75);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Mock data initialization
  useEffect(() => {
    const initializeData = () => {
      setSecurityEvents([
        {
          id: '1',
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          type: 'intrusion',
          severity: 'critical',
          source: '192.168.1.100',
          description: 'Multiple failed login attempts detected',
          status: 'active',
          assignedTo: 'SOC Analyst 1'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
          type: 'malware',
          severity: 'high',
          source: 'workstation-042',
          description: 'Suspicious executable detected and quarantined',
          status: 'investigating'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 1000 * 60 * 120),
          type: 'unauthorized_access',
          severity: 'medium',
          source: 'api.company.com',
          description: 'Unusual API access pattern detected',
          status: 'resolved'
        }
      ]);

      setThreatLocations([
        {
          id: '1',
          location: 'Beijing',
          country: 'China',
          coordinates: [116.4074, 39.9042],
          threatCount: 45,
          threatTypes: ['Brute Force', 'DDoS'],
          severity: 'critical'
        },
        {
          id: '2',
          location: 'Moscow',
          country: 'Russia',
          coordinates: [37.6176, 55.7558],
          threatCount: 32,
          threatTypes: ['Phishing', 'Malware'],
          severity: 'high'
        }
      ]);

      setVulnerabilities([
        {
          id: '1',
          asset: 'web-server-01',
          severity: 'critical',
          cvss: 9.1,
          description: 'Remote Code Execution in Apache Struts',
          status: 'open',
          daysOpen: 3,
          category: 'Application'
        },
        {
          id: '2',
          asset: 'db-server-02',
          severity: 'high',
          cvss: 7.8,
          description: 'SQL Injection vulnerability',
          status: 'in_progress',
          daysOpen: 7,
          category: 'Database'
        }
      ]);

      setComplianceFrameworks([
        {
          name: 'ISO 27001',
          score: 85,
          totalControls: 114,
          passedControls: 97,
          failedControls: 17,
          status: 'partial',
          lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
        },
        {
          name: 'SOC 2 Type II',
          score: 92,
          totalControls: 64,
          passedControls: 59,
          failedControls: 5,
          status: 'compliant',
          lastAssessment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)
        }
      ]);

      setIncidents([
        {
          id: '1',
          title: 'Data Exfiltration Attempt',
          severity: 'critical',
          status: 'investigating',
          assignedTeam: 'Incident Response Team',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          affectedAssets: 12,
          responseStage: 'analysis'
        },
        {
          id: '2',
          title: 'Ransomware Detection',
          severity: 'high',
          status: 'contained',
          assignedTeam: 'Malware Analysis Team',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
          affectedAssets: 3,
          responseStage: 'containment'
        }
      ]);
    };

    initializeData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(async () => {
      setIsRefreshing(true);
      // Simulate data refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsRefreshing(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-500 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'investigating':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'active':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Operations Center</h1>
          <p className="text-gray-600">Real-time security monitoring and incident response</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 1000);
          }}
          disabled={isRefreshing}
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Security Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Security Score</p>
                <p className="text-2xl font-bold text-gray-900">{securityScore}/100</p>
              </div>
              <div className="relative">
                <Shield className="h-8 w-8 text-green-500" />
                <div className="absolute -top-1 -right-1">
                  <div className={`h-3 w-3 rounded-full ${securityScore >= 80 ? 'bg-green-500' : securityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                </div>
              </div>
            </div>
            <Progress value={securityScore} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Threats</p>
                <p className="text-2xl font-bold text-red-600">{securityEvents.filter(e => e.status === 'active').length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              +2 in last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Vulnerabilities</p>
                <p className="text-2xl font-bold text-orange-600">{vulnerabilities.filter(v => v.status === 'open').length}</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {vulnerabilities.filter(v => v.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Compliance Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.round(complianceFrameworks.reduce((acc, f) => acc + f.score, 0) / complianceFrameworks.length)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {complianceFrameworks.filter(f => f.status === 'compliant').length}/{complianceFrameworks.length} frameworks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Event Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Security Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-4">
                    {securityEvents.map((event) => (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getStatusIcon(event.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <Badge className={getSeverityColor(event.severity)}>
                              {event.severity.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(event.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {event.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            Source: {event.source}
                          </p>
                          {event.assignedTo && (
                            <p className="text-xs text-blue-600 mt-1">
                              Assigned to: {event.assignedTo}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSecurityEventAcknowledge?.(event.id)}
                          aria-label={`Acknowledge security event ${event.id}`}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Threat Landscape Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Global Threat Landscape
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {threatLocations.map((location) => (
                    <div key={location.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${getSeverityColor(location.severity).split(' ')[0].replace('text-', 'bg-')}`} />
                        <div>
                          <p className="font-medium text-gray-900">{location.location}, {location.country}</p>
                          <p className="text-sm text-gray-600">{location.threatCount} threats detected</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getSeverityColor(location.severity)}>
                          {location.severity.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {location.threatTypes.join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Critical:</strong> Multiple brute force attempts detected on authentication servers. Immediate action required.
                  </AlertDescription>
                </Alert>
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>High:</strong> Unusual network traffic pattern detected. Potential data exfiltration in progress.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Vulnerability Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vulnerabilities.map((vulnerability) => (
                  <div key={vulnerability.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Badge className={getSeverityColor(vulnerability.severity)}>
                          {vulnerability.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-gray-900">{vulnerability.asset}</span>
                        <Badge variant="outline">CVSS {vulnerability.cvss}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={vulnerability.status === 'open' ? 'destructive' : vulnerability.status === 'in_progress' ? 'default' : 'secondary'}>
                          {vulnerability.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-500">{vulnerability.daysOpen} days open</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{vulnerability.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Category: {vulnerability.category}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onVulnerabilityAssign?.(vulnerability.id, 'Security Engineer')}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {complianceFrameworks.map((framework) => (
              <Card key={framework.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      {framework.name}
                    </span>
                    <Badge className={framework.status === 'compliant' ? 'bg-green-100 text-green-800' : framework.