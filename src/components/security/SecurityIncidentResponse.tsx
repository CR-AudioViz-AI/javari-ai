```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  Users, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Upload, 
  Bell, 
  Activity,
  Eye,
  MessageSquare,
  BarChart3,
  Zap,
  Target,
  Archive
} from 'lucide-react';

interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  type: string;
  source: string;
  assignedTeam: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  tags: string[];
  affectedSystems: string[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  playbooks: string[];
}

interface Evidence {
  id: string;
  type: 'log' | 'screenshot' | 'network_capture' | 'file' | 'other';
  filename: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  hash: string;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'alert' | 'action' | 'note' | 'status_change' | 'assignment';
  title: string;
  description: string;
  user: string;
  automated: boolean;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
  estimatedDuration: number;
  severity: string[];
  incidentTypes: string[];
}

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'approval';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignee?: string;
  estimatedDuration: number;
  dependencies: string[];
}

interface Alert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  type: string;
  acknowledged: boolean;
  incidentId?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  availability: 'available' | 'busy' | 'offline';
  expertise: string[];
}

interface SecurityIncidentResponseProps {
  className?: string;
  onIncidentCreate?: (incident: SecurityIncident) => void;
  onIncidentUpdate?: (incident: SecurityIncident) => void;
  onPlaybookExecute?: (playbookId: string, incidentId: string) => void;
  onEvidenceUpload?: (file: File, incidentId: string) => void;
  realTimeEnabled?: boolean;
  complianceMode?: boolean;
}

const SecurityIncidentResponse: React.FC<SecurityIncidentResponseProps> = ({
  className = '',
  onIncidentCreate,
  onIncidentUpdate,
  onPlaybookExecute,
  onEvidenceUpload,
  realTimeEnabled = true,
  complianceMode = false
}) => {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Mock data initialization
  useEffect(() => {
    const mockIncidents: SecurityIncident[] = [
      {
        id: '1',
        title: 'Suspicious Login Activity Detected',
        description: 'Multiple failed login attempts from unusual IP addresses',
        severity: 'high',
        status: 'investigating',
        type: 'Authentication Anomaly',
        source: 'SIEM',
        assignedTeam: ['security-team', 'soc-analyst'],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
        tags: ['brute-force', 'authentication', 'external'],
        affectedSystems: ['auth-server', 'user-portal'],
        evidence: [],
        timeline: [
          {
            id: '1',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            type: 'alert',
            title: 'Alert Generated',
            description: 'SIEM detected suspicious login patterns',
            user: 'system',
            automated: true
          }
        ],
        playbooks: ['brute-force-response', 'account-lockdown']
      },
      {
        id: '2',
        title: 'Malware Detection on Workstation',
        description: 'Endpoint protection detected potential malware on employee workstation',
        severity: 'critical',
        status: 'contained',
        type: 'Malware',
        source: 'EDR',
        assignedTeam: ['incident-response', 'forensics'],
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
        tags: ['malware', 'endpoint', 'quarantine'],
        affectedSystems: ['workstation-042', 'file-server'],
        evidence: [],
        timeline: [],
        playbooks: ['malware-containment', 'forensic-analysis']
      }
    ];

    const mockAlerts: Alert[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'medium',
        title: 'Unusual Network Traffic',
        description: 'Detected abnormal data transfer patterns',
        source: 'Network Monitor',
        type: 'Network Anomaly',
        acknowledged: false
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        severity: 'low',
        title: 'Failed Service Authentication',
        description: 'Service account authentication failure',
        source: 'Active Directory',
        type: 'Authentication',
        acknowledged: true
      }
    ];

    const mockPlaybooks: Playbook[] = [
      {
        id: 'brute-force-response',
        name: 'Brute Force Attack Response',
        description: 'Standard response procedure for brute force attacks',
        steps: [
          {
            id: '1',
            title: 'Block Source IPs',
            description: 'Immediately block attacking IP addresses',
            type: 'automated',
            status: 'completed',
            estimatedDuration: 5,
            dependencies: []
          },
          {
            id: '2',
            title: 'Reset Affected Accounts',
            description: 'Force password reset for potentially compromised accounts',
            type: 'manual',
            status: 'in_progress',
            assignee: 'security-admin',
            estimatedDuration: 15,
            dependencies: ['1']
          }
        ],
        estimatedDuration: 30,
        severity: ['medium', 'high'],
        incidentTypes: ['Authentication Anomaly']
      }
    ];

    const mockTeamMembers: TeamMember[] = [
      {
        id: '1',
        name: 'Alice Johnson',
        role: 'Security Analyst',
        availability: 'available',
        expertise: ['SIEM', 'Threat Analysis', 'Incident Response']
      },
      {
        id: '2',
        name: 'Bob Smith',
        role: 'Forensics Specialist',
        availability: 'busy',
        expertise: ['Digital Forensics', 'Malware Analysis', 'Network Security']
      }
    ];

    setIncidents(mockIncidents);
    setAlerts(mockAlerts);
    setPlaybooks(mockPlaybooks);
    setTeamMembers(mockTeamMembers);
  }, []);

  const handleCreateIncident = useCallback((alert: Alert) => {
    const newIncident: SecurityIncident = {
      id: Date.now().toString(),
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: 'open',
      type: alert.type,
      source: alert.source,
      assignedTeam: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      affectedSystems: [],
      evidence: [],
      timeline: [{
        id: '1',
        timestamp: new Date(),
        type: 'alert',
        title: 'Incident Created',
        description: `Created from alert: ${alert.title}`,
        user: 'system',
        automated: true
      }],
      playbooks: []
    };

    setIncidents(prev => [newIncident, ...prev]);
    onIncidentCreate?.(newIncident);

    // Mark alert as acknowledged and linked
    setAlerts(prev => prev.map(a => 
      a.id === alert.id ? { ...a, acknowledged: true, incidentId: newIncident.id } : a
    ));
  }, [onIncidentCreate]);

  const handleUpdateIncidentStatus = useCallback((incidentId: string, status: SecurityIncident['status']) => {
    setIncidents(prev => prev.map(incident => {
      if (incident.id === incidentId) {
        const updated = {
          ...incident,
          status,
          updatedAt: new Date(),
          resolvedAt: status === 'resolved' ? new Date() : incident.resolvedAt,
          timeline: [
            ...incident.timeline,
            {
              id: Date.now().toString(),
              timestamp: new Date(),
              type: 'status_change' as const,
              title: 'Status Updated',
              description: `Status changed to ${status}`,
              user: 'current-user',
              automated: false
            }
          ]
        };
        onIncidentUpdate?.(updated);
        return updated;
      }
      return incident;
    }));
  }, [onIncidentUpdate]);

  const handleExecutePlaybook = useCallback((playbookId: string, incidentId: string) => {
    onPlaybookExecute?.(playbookId, incidentId);
    
    setIncidents(prev => prev.map(incident => {
      if (incident.id === incidentId) {
        return {
          ...incident,
          playbooks: [...incident.playbooks, playbookId],
          timeline: [
            ...incident.timeline,
            {
              id: Date.now().toString(),
              timestamp: new Date(),
              type: 'action',
              title: 'Playbook Executed',
              description: `Started playbook: ${playbooks.find(p => p.id === playbookId)?.name}`,
              user: 'current-user',
              automated: false
            }
          ]
        };
      }
      return incident;
    }));
  }, [onPlaybookExecute, playbooks]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'investigating': return 'bg-yellow-100 text-yellow-800';
      case 'contained': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || incident.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'all' || incident.status === selectedStatus;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Incident Response</h1>
            <p className="text-gray-600">Real-time incident management and response coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {realTimeEnabled && (
            <Badge variant="outline" className="gap-1">
              <Activity className="w-3 h-3" />
              Real-time
            </Badge>
          )}
          {complianceMode && (
            <Badge variant="outline" className="gap-1">
              <FileText className="w-3 h-3" />
              Compliance
            </Badge>
          )}
        </div>
      </div>

      {/* Alert Bar */}
      {unacknowledgedAlerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Active Alerts</AlertTitle>
          <AlertDescription className="text-red-700">
            {unacknowledgedAlerts.length} unacknowledged alert{unacknowledgedAlerts.length !== 1 ? 's' : ''} require attention
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" />
            Alerts ({unacknowledgedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="incidents" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Incidents ({incidents.length})
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="gap-2">
            <Play className="w-4 h-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <Target className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{incidents.filter(i => i.status !== 'closed').length}</div>
                <p className="text-xs text-muted-foreground">
                  {incidents.filter(i => i.severity === 'critical').length} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unacknowledged Alerts</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{unacknowledgedAlerts.length}</div>
                <p className="text-xs text-muted-foreground">Require immediate attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Resolution Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.4h</div>
                <p className="text-xs text-muted-foreground">-15% from last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Availability</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teamMembers.filter(m => m.availability === 'available').length}/{teamMembers.length}
                </div>
                <p className="text-xs text-muted-foreground">Members available</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest incidents and response actions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-4">
                  {incidents.slice(0, 5).map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-4 h-4 ${incident.severity === 'critical' ? 'text-red-500' : incident.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />
                        <div>
                          <p className="font-medium">{incident.title}</p>
                          <p className="text-sm text-gray-600">{incident.source} • {incident.createdAt.toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(incident.severity)}>{incident.severity}</Badge>
                        <Badge variant="outline" className={getStatusColor(incident.status)}>{incident.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>Real-time security alerts from monitoring systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 border rounded-lg ${alert.acknowledged ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${alert.acknowledged ? 'bg-gray-400' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-gray-600">{alert.description}</p>
                          <p className="text-xs text-gray-500">{alert.source} • {alert.timestamp.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                        {!alert.acknowledged && (
                          <Button