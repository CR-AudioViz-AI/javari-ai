```tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  FileText, 
  Activity, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  Zap,
  Target,
  Lock,
  Unlock,
  Globe,
  Server,
  Database,
  Users
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ResponsiveContainer,
  Heatmap,
} from 'recharts';
import { cn } from '@/lib/utils';
import { format, subDays, subHours, isToday, isYesterday } from 'date-fns';

// Types and Interfaces
interface SecurityThreat {
  id: string;
  type: 'malware' | 'phishing' | 'ddos' | 'intrusion' | 'data_breach' | 'insider_threat';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'contained' | 'resolved';
  title: string;
  description: string;
  source: string;
  target: string;
  timestamp: Date;
  indicators: string[];
  mitigationSteps: string[];
  affectedSystems: string[];
}

interface SecurityIncident {
  id: string;
  title: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignee: string;
  reporter: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  description: string;
  timeline: IncidentTimelineEvent[];
  tags: string[];
}

interface IncidentTimelineEvent {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  description: string;
  type: 'created' | 'updated' | 'escalated' | 'resolved' | 'comment';
}

interface SecurityAlert {
  id: string;
  title: string;
  type: 'security_breach' | 'unauthorized_access' | 'malware_detected' | 'policy_violation' | 'system_anomaly';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved';
  source: string;
  timestamp: Date;
  message: string;
  metadata: Record<string, any>;
}

interface ComplianceReport {
  id: string;
  framework: 'SOC2' | 'ISO27001' | 'GDPR' | 'HIPAA' | 'PCI_DSS';
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number;
  lastAssessment: Date;
  nextAssessment: Date;
  controls: ComplianceControl[];
  findings: ComplianceFinding[];
}

interface ComplianceControl {
  id: string;
  name: string;
  status: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';
  evidence: string[];
  lastReviewed: Date;
}

interface ComplianceFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  remediation: string;
  dueDate: Date;
  status: 'open' | 'in_progress' | 'resolved';
}

interface SecurityMetrics {
  threatDetectionRate: number;
  incidentResponseTime: number;
  securityScore: number;
  complianceScore: number;
  alertVolume: number;
  falsePositiveRate: number;
  meanTimeToDetection: number;
  meanTimeToResponse: number;
}

interface SecurityAnalyticsConsoleProps {
  className?: string;
  onThreatSelect?: (threat: SecurityThreat) => void;
  onIncidentSelect?: (incident: SecurityIncident) => void;
  onAlertAcknowledge?: (alertId: string) => void;
  onExportReport?: (type: string, format: string) => void;
}

// Mock Data
const mockThreats: SecurityThreat[] = [
  {
    id: '1',
    type: 'malware',
    severity: 'critical',
    status: 'active',
    title: 'Advanced Persistent Threat Detected',
    description: 'Suspicious network activity indicating potential APT infiltration',
    source: '192.168.1.100',
    target: 'Production Database',
    timestamp: new Date(),
    indicators: ['Unusual outbound connections', 'Encrypted communication', 'Privilege escalation'],
    mitigationSteps: ['Isolate affected systems', 'Deploy countermeasures', 'Monitor network traffic'],
    affectedSystems: ['DB-PROD-01', 'WEB-SERVER-02']
  },
  {
    id: '2',
    type: 'phishing',
    severity: 'high',
    status: 'investigating',
    title: 'Phishing Campaign Targeting Employees',
    description: 'Large-scale phishing emails detected targeting employee credentials',
    source: 'external',
    target: 'Employee Workstations',
    timestamp: subHours(new Date(), 2),
    indicators: ['Suspicious email attachments', 'Credential harvesting attempts'],
    mitigationSteps: ['Block sender domains', 'User awareness training', 'Email filtering'],
    affectedSystems: ['Email Server', 'Workstations']
  }
];

const mockIncidents: SecurityIncident[] = [
  {
    id: '1',
    title: 'Unauthorized Access Attempt',
    type: 'Access Control Violation',
    severity: 'high',
    status: 'investigating',
    assignee: 'John Smith',
    reporter: 'Security System',
    createdAt: new Date(),
    updatedAt: new Date(),
    description: 'Multiple failed login attempts detected from suspicious IP addresses',
    timeline: [
      {
        id: '1',
        timestamp: new Date(),
        action: 'Incident Created',
        actor: 'Security System',
        description: 'Automated detection of suspicious activity',
        type: 'created'
      }
    ],
    tags: ['access-control', 'authentication', 'brute-force']
  }
];

const mockAlerts: SecurityAlert[] = [
  {
    id: '1',
    title: 'Critical Security Event',
    type: 'security_breach',
    severity: 'critical',
    status: 'new',
    source: 'Network Monitoring',
    timestamp: new Date(),
    message: 'Potential data exfiltration detected on network segment 192.168.1.0/24',
    metadata: { sourceIp: '192.168.1.100', protocol: 'HTTPS', bytes: 50000000 }
  },
  {
    id: '2',
    title: 'Malware Detection',
    type: 'malware_detected',
    severity: 'high',
    status: 'acknowledged',
    source: 'Endpoint Protection',
    timestamp: subHours(new Date(), 1),
    message: 'Trojan.Win32.Agent detected on workstation WS-001',
    metadata: { hostname: 'WS-001', fileName: 'suspicious.exe', quarantined: true }
  }
];

const mockComplianceReports: ComplianceReport[] = [
  {
    id: '1',
    framework: 'SOC2',
    status: 'compliant',
    score: 95,
    lastAssessment: subDays(new Date(), 30),
    nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    controls: [
      {
        id: '1',
        name: 'Access Control',
        status: 'implemented',
        evidence: ['Policy document', 'Access logs'],
        lastReviewed: subDays(new Date(), 7)
      }
    ],
    findings: []
  }
];

const mockSecurityMetrics: SecurityMetrics = {
  threatDetectionRate: 98.5,
  incidentResponseTime: 15,
  securityScore: 92,
  complianceScore: 88,
  alertVolume: 1247,
  falsePositiveRate: 2.3,
  meanTimeToDetection: 12,
  meanTimeToResponse: 23
};

// Subcomponents
const SecurityScoreCard: React.FC<{ score: number; title: string; trend?: number }> = ({ 
  score, 
  title, 
  trend 
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", getScoreColor(score))}>
              {score}%
            </p>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className={cn("h-8 w-8", getScoreColor(score))} />
            {trend && (
              <div className={cn(
                "flex items-center text-sm",
                trend > 0 ? "text-green-600" : "text-red-600"
              )}>
                <TrendingUp className="h-4 w-4 mr-1" />
                {Math.abs(trend)}%
              </div>
            )}
          </div>
        </div>
        <Progress value={score} className="mt-3" />
      </CardContent>
    </Card>
  );
};

const AlertSeverityIndicator: React.FC<{ severity: SecurityAlert['severity'] }> = ({ severity }) => {
  const getSeverityConfig = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return { color: 'bg-red-600', label: 'Critical', icon: AlertTriangle };
      case 'high':
        return { color: 'bg-orange-500', label: 'High', icon: AlertCircle };
      case 'medium':
        return { color: 'bg-yellow-500', label: 'Medium', icon: Eye };
      case 'low':
        return { color: 'bg-blue-500', label: 'Low', icon: Activity };
      default:
        return { color: 'bg-gray-500', label: 'Info', icon: Activity };
    }
  };

  const config = getSeverityConfig(severity);
  const IconComponent = config.icon;

  return (
    <Badge variant="outline" className={cn("text-white border-0", config.color)}>
      <IconComponent className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const ComplianceStatusBadge: React.FC<{ status: ComplianceReport['status'] }> = ({ status }) => {
  const getStatusConfig = (status: ComplianceReport['status']) => {
    switch (status) {
      case 'compliant':
        return { variant: 'default' as const, color: 'bg-green-600', icon: CheckCircle };
      case 'non_compliant':
        return { variant: 'destructive' as const, color: 'bg-red-600', icon: XCircle };
      case 'partial':
        return { variant: 'secondary' as const, color: 'bg-yellow-600', icon: AlertCircle };
      default:
        return { variant: 'outline' as const, color: 'bg-gray-500', icon: Clock };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <Badge variant={config.variant}>
      <IconComponent className="h-3 w-3 mr-1" />
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
};

const ThreatHeatMap: React.FC<{ threats: SecurityThreat[] }> = ({ threats }) => {
  const heatmapData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return days.flatMap((day, dayIndex) =>
      hours.map((hour) => ({
        day,
        hour,
        value: Math.floor(Math.random() * 10) + 1,
        dayIndex,
      }))
    );
  }, [threats]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Threat Activity Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-24 gap-1">
          {heatmapData.map((cell, index) => (
            <div
              key={index}
              className={cn(
                "w-4 h-4 rounded",
                cell.value > 8 ? "bg-red-500" :
                cell.value > 6 ? "bg-orange-400" :
                cell.value > 4 ? "bg-yellow-300" :
                cell.value > 2 ? "bg-blue-200" : "bg-gray-100"
              )}
              title={`${cell.day} ${cell.hour}:00 - ${cell.value} threats`}
            />
          ))}
        </div>
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <span>Less</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-gray-100 rounded" />
            <div className="w-3 h-3 bg-blue-200 rounded" />
            <div className="w-3 h-3 bg-yellow-300 rounded" />
            <div className="w-3 h-3 bg-orange-400 rounded" />
            <div className="w-3 h-3 bg-red-500 rounded" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
};

const IncidentTimeline: React.FC<{ incidents: SecurityIncident[] }> = ({ incidents }) => {
  const timelineData = useMemo(() => {
    return incidents.flatMap(incident =>
      incident.timeline.map(event => ({
        ...event,
        incidentId: incident.id,
        incidentTitle: incident.title,
        severity: incident.severity
      }))
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [incidents]);

  const formatTimestamp = (date: Date) => {
    if (isToday(date)) {
      return `Today ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    }
    return format(date, 'MMM dd, HH:mm');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Recent Incident Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {timelineData.map((event, index) => (
              <div key={event.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    event.type === 'created' ? 'bg-blue-500' :
                    event.type === 'resolved' ? 'bg-green-500' :
                    event.type === 'escalated' ? 'bg-red-500' : 'bg-gray-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.action}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {event.description}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {event.actor}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const SecurityEventLog: React.FC<{ alerts: SecurityAlert[] }> = ({ alerts }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          Security Event Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <AlertSeverityIndicator severity={alert.severity} />
                    <span className="text-sm font-medium">{alert.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(alert.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {alert.message}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Source: {alert.source}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {alert.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const ThreatVisualizationDashboard: React.FC<{ threats: SecurityThreat[] }> = ({ threats }) => {
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM dd'),
        threats: Math.floor(Math.random() * 20) + 5,
        resolved: Math.floor(Math.random() * 15) + 2,
      };
    });
    return last7Days;
  }, [threats]);

  const threatTypeData = useMemo(() => {
    const types = threats.reduce((acc, threat) => {
      acc[threat.type] = (acc[threat.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(types).map(([type, count]) => ({
      name: type.replace('_', ' ').toUpperCase(),
      value: count,
    }));
  }, [threats]);

  const severityData = useMemo(() => {
    const severities = threats.reduce((acc, threat) => {
      acc[threat.severity] = (acc[threat.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(severities).map(([severity, count]) => ({
      name: severity.toUpperCase(),
      value: count,
    }));
  }, [threats]);

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Threat Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>