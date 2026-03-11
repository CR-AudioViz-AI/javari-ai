'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Settings, 
  Search, 
  Filter, 
  Download, 
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  Eye,
  FileText,
  Network,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Globe,
  Lock,
  Zap,
  Target,
  Database,
  Cpu
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'malware' | 'intrusion' | 'ddos' | 'phishing' | 'data_breach' | 'insider_threat';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source_ip: string;
  target_ip: string;
  description: string;
  timestamp: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  location: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
  affected_systems: string[];
  indicators: string[];
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  assignee: string;
  created_at: string;
  updated_at: string;
  events: SecurityEvent[];
  timeline: Array<{
    timestamp: string;
    action: string;
    user: string;
    details: string;
  }>;
}

interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  level: 'analyst' | 'senior_analyst' | 'manager' | 'admin';
}

interface ThreatIntelligence {
  id: string;
  indicator: string;
  type: 'ip' | 'domain' | 'hash' | 'url';
  threat_type: string;
  confidence: number;
  source: string;
  first_seen: string;
  last_seen: string;
  context: string;
}

interface NetworkNode {
  id: string;
  label: string;
  type: 'server' | 'workstation' | 'router' | 'firewall' | 'database';
  ip: string;
  status: 'healthy' | 'warning' | 'critical';
  connections: string[];
}

interface ComplianceFramework {
  id: string;
  name: string;
  requirements: Array<{
    id: string;
    title: string;
    status: 'compliant' | 'non_compliant' | 'partial';
    last_check: string;
  }>;
}

interface DashboardWidget {
  id: string;
  type: 'threat_map' | 'alerts_feed' | 'metrics' | 'incidents' | 'compliance' | 'network';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, any>;
}

interface SOCPageProps {
  className?: string;
}

const SecurityOperationsCenterPage: React.FC<SOCPageProps> = ({ className }) => {
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();
  
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState<boolean>(true);
  const [alertFilters, setAlertFilters] = useState({
    severity: '',
    type: '',
    status: '',
    timeRange: '24h'
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Real-time security events subscription
  useEffect(() => {
    if (!isRealTimeEnabled) return;

    const channel = supabase
      .channel('security_events')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'security_events',
          filter: selectedRole?.permissions.includes('view_all_events') ? undefined : `assignee=eq.${selectedRole?.id}`
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['security_events'] });
          queryClient.invalidateQueries({ queryKey: ['security_metrics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, isRealTimeEnabled, selectedRole]);

  // Fetch user roles and permissions
  const { data: userRoles = [] } = useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select(`
          id,
          name,
          level,
          rbac_permissions!inner(permission)
        `);
      return data?.map(role => ({
        ...role,
        permissions: role.rbac_permissions?.map((p: any) => p.permission) || []
      })) || [];
    }
  });

  // Fetch security events
  const { data: securityEvents = [] } = useQuery({
    queryKey: ['security_events', alertFilters],
    queryFn: async () => {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (alertFilters.severity) {
        query = query.eq('severity', alertFilters.severity);
      }
      if (alertFilters.type) {
        query = query.eq('type', alertFilters.type);
      }
      if (alertFilters.status) {
        query = query.eq('status', alertFilters.status);
      }

      const { data } = await query;
      return data || [];
    },
    refetchInterval: isRealTimeEnabled ? 5000 : false
  });

  // Fetch incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('incidents')
        .select(`
          *,
          security_events(*),
          incident_timeline(*)
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // Fetch threat intelligence
  const { data: threatIntel = [] } = useQuery({
    queryKey: ['threat_intelligence'],
    queryFn: async () => {
      const { data } = await supabase
        .from('threat_intelligence')
        .select('*')
        .order('confidence', { ascending: false })
        .limit(100);
      return data || [];
    }
  });

  // Fetch compliance data
  const { data: complianceData = [] } = useQuery({
    queryKey: ['compliance_frameworks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('compliance_frameworks')
        .select(`
          *,
          compliance_requirements(*)
        `);
      return data || [];
    }
  });

  // Calculate security metrics
  const securityMetrics = useMemo(() => {
    const totalEvents = securityEvents.length;
    const criticalEvents = securityEvents.filter(e => e.severity === 'critical').length;
    const activeIncidents = incidents.filter(i => ['open', 'investigating'].includes(i.status)).length;
    const resolvedToday = incidents.filter(i => 
      i.status === 'resolved' && 
      new Date(i.updated_at).toDateString() === new Date().toDateString()
    ).length;

    return {
      totalEvents,
      criticalEvents,
      activeIncidents,
      resolvedToday,
      threatLevel: criticalEvents > 10 ? 'high' : criticalEvents > 5 ? 'medium' : 'low'
    };
  }, [securityEvents, incidents]);

  const handleCreateIncident = useCallback(async (event: SecurityEvent) => {
    if (!selectedRole?.permissions.includes('create_incidents')) return;

    const { data } = await supabase
      .from('incidents')
      .insert({
        title: `${event.type.toUpperCase()} - ${event.description}`,
        description: event.description,
        severity: event.severity,
        status: 'open',
        assignee: selectedRole.id,
        events: [event.id]
      })
      .select()
      .single();

    if (data) {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    }
  }, [supabase, selectedRole, queryClient]);

  const handleUpdateIncidentStatus = useCallback(async (incidentId: string, status: string) => {
    if (!selectedRole?.permissions.includes('update_incidents')) return;

    await supabase
      .from('incidents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', incidentId);

    // Add timeline entry
    await supabase
      .from('incident_timeline')
      .insert({
        incident_id: incidentId,
        action: `Status changed to ${status}`,
        user: selectedRole.id,
        timestamp: new Date().toISOString(),
        details: `Incident status updated by ${selectedRole.name}`
      });

    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  }, [supabase, selectedRole, queryClient]);

  const getSeverityColor = (severity: string): string => {
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
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <Eye className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderThreatMap = () => (
    <Card className="h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Global Threat Map</CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            {isRealTimeEnabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[300px] bg-slate-900 rounded-lg p-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />
          <div className="relative h-full flex items-center justify-center">
            <Globe className="h-32 w-32 text-blue-400/30" />
            <div className="absolute top-4 left-4 space-y-2">
              {securityEvents.slice(0, 5).map((event, index) => (
                <div key={event.id} className="flex items-center space-x-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${getSeverityColor(event.severity)} animate-pulse`} />
                  <span className="text-white">{event.location?.country || 'Unknown'}</span>
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderRealTimeAlerts = () => (
    <Card className="h-[500px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Real-Time Security Alerts</CardTitle>
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-8"
          />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-3 w-3" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Alert Filters</SheetTitle>
                <SheetDescription>Configure alert filtering options</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="severity-filter">Severity</Label>
                  <Select value={alertFilters.severity} onValueChange={(value) => 
                    setAlertFilters(prev => ({ ...prev, severity: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type-filter">Event Type</Label>
                  <Select value={alertFilters.type} onValueChange={(value) => 
                    setAlertFilters(prev => ({ ...prev, type: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="malware">Malware</SelectItem>
                      <SelectItem value="intrusion">Intrusion</SelectItem>
                      <SelectItem value="ddos">DDoS</SelectItem>
                      <SelectItem value="phishing">Phishing</SelectItem>
                      <SelectItem value="data_breach">Data Breach</SelectItem>
                      <SelectItem value="insider_threat">Insider Threat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {securityEvents
              .filter(event => 
                !searchQuery || 
                event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                event.source_ip.includes(searchQuery)
              )
              .map((event) => (
                <Alert key={event.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getSeverityIcon(event.severity)}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={getSeverityColor(event.severity)}>
                            {event.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary">
                            {event.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <AlertTitle className="text-sm font-medium">
                          {event.description}
                        </AlertTitle>
                        <AlertDescription className="text-xs">
                          Source: {event.source_ip} → Target: {event.target_ip}
                        </AlertDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {selectedRole?.permissions.includes('create_incidents') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleCreateIncident(event)}
                        >
                          Create Incident
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Alert>
              ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderIncidentManagement = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Incident Management</span>
          {selectedRole?.permissions.includes('create_incidents') && (
            <Button size="sm">
              <AlertTriangle className="h-3 w-3 mr-1" />
              New Incident
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell className="font-mono text-xs">
                  {incident.id.slice(0, 8)}
                </TableCell>
                <TableCell>{incident.title}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                    {incident.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select 
                    value={incident.status}
                    onValueChange={(value) => handleUpdateIncidentStatus(incident.id, value)}
                    disabled={!selectedRole?.permissions.includes('update_incidents')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="contained">Contained</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{incident.assignee}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(incident.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderSecurityMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{securityMetrics.totalEvents}</div