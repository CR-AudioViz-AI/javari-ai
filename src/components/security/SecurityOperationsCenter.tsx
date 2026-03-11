```tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Server, 
  Globe, 
  Eye, 
  Play, 
  Pause, 
  RefreshCw,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Filter,
  Search,
  Download,
  Settings,
  Zap
} from 'lucide-react'

interface SecurityEvent {
  id: string
  type: 'malware' | 'intrusion' | 'ddos' | 'phishing' | 'breach' | 'anomaly'
  severity: 'critical' | 'high' | 'medium' | 'low'
  source: string
  target: string
  location: {
    country: string
    city: string
    latitude: number
    longitude: number
  }
  timestamp: Date
  status: 'active' | 'investigating' | 'resolved' | 'false_positive'
  description: string
  indicators: string[]
  affectedAssets: number
  automated: boolean
}

interface SecurityIncident {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  assignee: string
  created: Date
  updated: Date
  events: SecurityEvent[]
  timeline: Array<{
    timestamp: Date
    action: string
    user: string
    description: string
  }>
  impact: string
  mitigation: string[]
}

interface SecurityMetric {
  id: string
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  threshold: number
  status: 'healthy' | 'warning' | 'critical'
  description: string
}

interface ComplianceFramework {
  id: string
  name: string
  requirements: number
  compliant: number
  lastAssessment: Date
  nextAssessment: Date
  status: 'compliant' | 'partial' | 'non_compliant'
}

interface SecurityOperationsCenterProps {
  className?: string
  organizationId: string
  onIncidentCreate?: (incident: Partial<SecurityIncident>) => void
  onResponseAction?: (action: string, eventId: string) => void
  onSettingsChange?: (settings: any) => void
}

const SecurityOperationsCenter: React.FC<SecurityOperationsCenterProps> = ({
  className = '',
  organizationId,
  onIncidentCreate,
  onResponseAction,
  onSettingsChange
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('24h')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState<boolean>(true)
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null)

  // Mock data - in real implementation, this would come from APIs/WebSocket
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
    {
      id: '1',
      type: 'malware',
      severity: 'critical',
      source: '192.168.1.100',
      target: 'web-server-01',
      location: { country: 'Russia', city: 'Moscow', latitude: 55.7558, longitude: 37.6176 },
      timestamp: new Date(Date.now() - 300000),
      status: 'active',
      description: 'Malware detected on web server',
      indicators: ['suspicious_file.exe', 'registry_modification'],
      affectedAssets: 1,
      automated: false
    },
    {
      id: '2',
      type: 'intrusion',
      severity: 'high',
      source: '203.0.113.50',
      target: 'database-cluster',
      location: { country: 'China', city: 'Beijing', latitude: 39.9042, longitude: 116.4074 },
      timestamp: new Date(Date.now() - 600000),
      status: 'investigating',
      description: 'Unauthorized database access attempt',
      indicators: ['brute_force', 'sql_injection'],
      affectedAssets: 3,
      automated: true
    }
  ])

  const [incidents, setIncidents] = useState<SecurityIncident[]>([
    {
      id: 'INC-001',
      title: 'Advanced Persistent Threat Detected',
      severity: 'critical',
      status: 'investigating',
      assignee: 'Sarah Chen',
      created: new Date(Date.now() - 1800000),
      updated: new Date(Date.now() - 300000),
      events: [],
      timeline: [
        {
          timestamp: new Date(Date.now() - 1800000),
          action: 'created',
          user: 'System',
          description: 'Incident automatically created from threat detection'
        }
      ],
      impact: 'Potential data exfiltration risk',
      mitigation: ['Isolate affected systems', 'Review access logs', 'Update security policies']
    }
  ])

  const [metrics, setMetrics] = useState<SecurityMetric[]>([
    {
      id: 'threats_blocked',
      name: 'Threats Blocked',
      value: 1247,
      unit: 'count',
      trend: 'up',
      threshold: 1000,
      status: 'warning',
      description: 'Total threats blocked in the last 24 hours'
    },
    {
      id: 'mean_time_to_detect',
      name: 'Mean Time to Detect',
      value: 4.2,
      unit: 'minutes',
      trend: 'down',
      threshold: 5,
      status: 'healthy',
      description: 'Average time to detect security incidents'
    },
    {
      id: 'security_score',
      name: 'Security Posture Score',
      value: 87,
      unit: '%',
      trend: 'stable',
      threshold: 80,
      status: 'healthy',
      description: 'Overall security posture assessment'
    }
  ])

  const [complianceFrameworks, setComplianceFrameworks] = useState<ComplianceFramework[]>([
    {
      id: 'iso27001',
      name: 'ISO 27001',
      requirements: 114,
      compliant: 98,
      lastAssessment: new Date(Date.now() - 7776000000),
      nextAssessment: new Date(Date.now() + 7776000000),
      status: 'compliant'
    },
    {
      id: 'soc2',
      name: 'SOC 2 Type II',
      requirements: 67,
      compliant: 59,
      lastAssessment: new Date(Date.now() - 5184000000),
      nextAssessment: new Date(Date.now() + 10368000000),
      status: 'partial'
    }
  ])

  // Filter events based on search and severity
  const filteredEvents = useMemo(() => {
    return securityEvents.filter(event => {
      const matchesSearch = searchQuery === '' || 
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.source.includes(searchQuery) ||
        event.target.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesSeverity = selectedSeverity === 'all' || event.severity === selectedSeverity
      
      return matchesSearch && matchesSeverity
    })
  }, [securityEvents, searchQuery, selectedSeverity])

  // Simulate real-time updates
  useEffect(() => {
    if (!isRealTimeEnabled) return

    const interval = setInterval(() => {
      // Simulate new events
      if (Math.random() > 0.7) {
        const newEvent: SecurityEvent = {
          id: Date.now().toString(),
          type: ['malware', 'intrusion', 'ddos', 'phishing', 'breach', 'anomaly'][Math.floor(Math.random() * 6)] as any,
          severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
          source: `192.168.1.${Math.floor(Math.random() * 255)}`,
          target: `server-${Math.floor(Math.random() * 10).toString().padStart(2, '0')}`,
          location: {
            country: ['USA', 'China', 'Russia', 'Germany', 'Brazil'][Math.floor(Math.random() * 5)],
            city: 'Unknown',
            latitude: Math.random() * 180 - 90,
            longitude: Math.random() * 360 - 180
          },
          timestamp: new Date(),
          status: 'active',
          description: 'Automated threat detection',
          indicators: ['suspicious_activity'],
          affectedAssets: Math.floor(Math.random() * 5) + 1,
          automated: true
        }
        
        setSecurityEvents(prev => [newEvent, ...prev.slice(0, 99)])
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isRealTimeEnabled])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'destructive'
      case 'investigating': return 'default'
      case 'resolved': return 'secondary'
      case 'false_positive': return 'outline'
      default: return 'default'
    }
  }

  const handleResponseAction = (action: string, eventId: string) => {
    onResponseAction?.(action, eventId)
    
    // Update event status locally
    setSecurityEvents(prev => 
      prev.map(event => 
        event.id === eventId 
          ? { ...event, status: action === 'isolate' ? 'investigating' : 'resolved' as any }
          : event
      )
    )
  }

  const ThreatDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              <Badge variant={metric.status === 'healthy' ? 'secondary' : metric.status === 'warning' ? 'default' : 'destructive'}>
                {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              {metric.name === 'Security Posture Score' && (
                <Progress value={metric.value} className="mt-2" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Threat Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Interactive threat map would be rendered here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Showing {securityEvents.length} active threats across {new Set(securityEvents.map(e => e.location.country)).size} countries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const AlertsPanel = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Security Alerts
            <Badge variant="destructive">{filteredEvents.filter(e => e.status === 'active').length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={isRealTimeEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
            >
              {isRealTimeEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isRealTimeEnabled ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <Alert key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEvent(event)}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(event.severity) as any}>
                        {event.severity.toUpperCase()}
                      </Badge>
                      <Badge variant={getStatusColor(event.status) as any}>
                        {event.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {event.automated && <Badge variant="outline">AUTO</Badge>}
                  </div>
                  <div className="font-medium mb-1">{event.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {event.source} → {event.target} | {event.location.country}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={(e) => {
                      e.stopPropagation()
                      handleResponseAction('investigate', event.id)
                    }}>
                      <Eye className="h-3 w-3 mr-1" />
                      Investigate
                    </Button>
                    {event.status === 'active' && (
                      <Button size="sm" variant="destructive" onClick={(e) => {
                        e.stopPropagation()
                        handleResponseAction('isolate', event.id)
                      }}>
                        <Shield className="h-3 w-3 mr-1" />
                        Isolate
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const IncidentManager = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Security Incidents</h3>
        <Button onClick={() => onIncidentCreate?.({})}>
          Create Incident
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div key={incident.id} className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                       onClick={() => setSelectedIncident(incident)}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getSeverityColor(incident.severity) as any}>
                        {incident.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{incident.id}</span>
                    </div>
                    <h4 className="font-medium mb-1">{incident.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">Assigned to: {incident.assignee}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={incident.status === 'open' ? 'destructive' : 'default'}>
                        {incident.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(incident.updated).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  <Zap className="h-4 w-4 mr-1" />
                  Auto-Isolate
                </Button>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-1" />
                  Send Alert
                </Button>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-1" />
                  Block IP
                </Button>
                <Button variant="outline" size="sm">
                  <Server className="h-4 w-4 mr-1" />
                  Quarantine
                </Button>
              </div>
              
              <div className="mt-6">
                <h4 className="font-medium mb-2">Automated Responses</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Block malicious IPs</span>
                    <Badge variant="secondary">ENABLED</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Isolate infected hosts</span>
                    <Badge variant="secondary">ENABLED</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">Email notifications</span>
                    <Badge variant="outline">DISABLED</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const ComplianceStatus = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {complianceFrameworks.map((framework) => (
          <Card key={framework.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {framework.name}
                <Badge variant={framework.status === 'compliant' ? 'secondary' : 
                               framework.status === 'partial' ? 'default' : 'destructive'}>
                  {framework.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Compliance Score</span>
                    <span className="text-sm font-medium">
                      {framework.compliant}/{framework.requirements}
                    </span>
                  </div>
                  <Progress value={(framework.compliant / framework.requirements) * 100} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">