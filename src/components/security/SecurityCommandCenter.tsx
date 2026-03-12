```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  Activity, 
  Eye, 
  Filter,
  Download,
  Play,
  Pause,
  RefreshCw,
  Target,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Database,
  Network,
  Lock,
  Zap
} from 'lucide-react'

interface SecurityEvent {
  id: string
  timestamp: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  source: string
  description: string
  status: 'new' | 'investigating' | 'resolved' | 'false-positive'
  assignedTo?: string
}

interface ThreatIndicator {
  id: string
  type: 'ip' | 'domain' | 'hash' | 'url'
  value: string
  confidence: number
  source: string
  firstSeen: string
  lastSeen: string
  tags: string[]
}

interface IncidentWorkflow {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  assignee: string
  createdAt: string
  steps: WorkflowStep[]
  evidence: EvidenceItem[]
}

interface WorkflowStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'skipped'
  assignee?: string
  dueDate?: string
  notes?: string
}

interface EvidenceItem {
  id: string
  type: 'log' | 'file' | 'network' | 'memory' | 'registry'
  source: string
  timestamp: string
  hash: string
  size: number
  preserved: boolean
}

interface SecurityMetric {
  name: string
  value: number
  trend: 'up' | 'down' | 'stable'
  unit: string
  threshold: number
}

interface ComplianceFramework {
  id: string
  name: string
  controls: ComplianceControl[]
  overallScore: number
}

interface ComplianceControl {
  id: string
  name: string
  status: 'compliant' | 'non-compliant' | 'pending'
  evidence: string[]
  lastAssessed: string
}

interface SecurityCommandCenterProps {
  className?: string
  onExportReport?: (data: any) => void
  onSecurityEventUpdate?: (event: SecurityEvent) => void
  onIncidentCreate?: (incident: Partial<IncidentWorkflow>) => void
  realTimeEnabled?: boolean
}

const SecurityCommandCenter: React.FC<SecurityCommandCenterProps> = ({
  className = '',
  onExportReport,
  onSecurityEventUpdate,
  onIncidentCreate,
  realTimeEnabled = true
}) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [threatIndicators, setThreatIndicators] = useState<ThreatIndicator[]>([])
  const [incidents, setIncidents] = useState<IncidentWorkflow[]>([])
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetric[]>([])
  const [complianceFrameworks, setComplianceFrameworks] = useState<ComplianceFramework[]>([])
  const [threatHuntQuery, setThreatHuntQuery] = useState('')
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(realTimeEnabled)
  const [loading, setLoading] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null)

  // Mock data initialization
  useEffect(() => {
    const mockSecurityEvents: SecurityEvent[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        severity: 'critical',
        type: 'Malware Detection',
        source: 'Endpoint Protection',
        description: 'Suspicious PowerShell execution detected',
        status: 'investigating',
        assignedTo: 'analyst-1'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        severity: 'high',
        type: 'Network Intrusion',
        source: 'IDS/IPS',
        description: 'Multiple failed login attempts from external IP',
        status: 'new'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        severity: 'medium',
        type: 'Data Exfiltration',
        source: 'DLP',
        description: 'Large file transfer to external domain',
        status: 'resolved',
        assignedTo: 'analyst-2'
      }
    ]

    const mockThreatIndicators: ThreatIndicator[] = [
      {
        id: '1',
        type: 'ip',
        value: '192.168.1.100',
        confidence: 85,
        source: 'Internal Analysis',
        firstSeen: new Date(Date.now() - 86400000).toISOString(),
        lastSeen: new Date().toISOString(),
        tags: ['botnet', 'c2']
      },
      {
        id: '2',
        type: 'hash',
        value: 'd41d8cd98f00b204e9800998ecf8427e',
        confidence: 95,
        source: 'VirusTotal',
        firstSeen: new Date(Date.now() - 172800000).toISOString(),
        lastSeen: new Date(Date.now() - 86400000).toISOString(),
        tags: ['malware', 'trojan']
      }
    ]

    const mockSecurityMetrics: SecurityMetric[] = [
      { name: 'Active Threats', value: 12, trend: 'down', unit: 'count', threshold: 20 },
      { name: 'Security Score', value: 87, trend: 'up', unit: '%', threshold: 80 },
      { name: 'Mean Time to Detect', value: 4.2, trend: 'down', unit: 'hours', threshold: 6 },
      { name: 'Mean Time to Respond', value: 1.8, trend: 'stable', unit: 'hours', threshold: 2 }
    ]

    const mockCompliance: ComplianceFramework[] = [
      {
        id: '1',
        name: 'SOC 2 Type II',
        overallScore: 94,
        controls: [
          {
            id: '1',
            name: 'Access Controls',
            status: 'compliant',
            evidence: ['IAM logs', 'Access reviews'],
            lastAssessed: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: '2',
            name: 'Encryption',
            status: 'non-compliant',
            evidence: [],
            lastAssessed: new Date(Date.now() - 172800000).toISOString()
          }
        ]
      }
    ]

    setSecurityEvents(mockSecurityEvents)
    setThreatIndicators(mockThreatIndicators)
    setSecurityMetrics(mockSecurityMetrics)
    setComplianceFrameworks(mockCompliance)
  }, [])

  const handleThreatHunt = useCallback(async () => {
    if (!threatHuntQuery.trim()) return
    
    setLoading(true)
    try {
      // Simulate threat hunting query execution
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('Executing threat hunt query:', threatHuntQuery)
    } catch (error) {
      console.error('Threat hunt failed:', error)
    } finally {
      setLoading(false)
    }
  }, [threatHuntQuery])

  const handleIncidentCreate = useCallback((eventId: string) => {
    const event = securityEvents.find(e => e.id === eventId)
    if (!event) return

    const newIncident: Partial<IncidentWorkflow> = {
      title: `Incident: ${event.type}`,
      severity: event.severity,
      status: 'open',
      assignee: 'current-user',
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: '1',
          title: 'Initial Assessment',
          description: 'Analyze the security event and determine scope',
          status: 'pending'
        },
        {
          id: '2',
          title: 'Containment',
          description: 'Implement measures to prevent further damage',
          status: 'pending'
        },
        {
          id: '3',
          title: 'Eradication',
          description: 'Remove threats and vulnerabilities',
          status: 'pending'
        },
        {
          id: '4',
          title: 'Recovery',
          description: 'Restore normal operations',
          status: 'pending'
        }
      ],
      evidence: []
    }

    onIncidentCreate?.(newIncident)
  }, [securityEvents, onIncidentCreate])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500'
      case 'investigating': return 'bg-yellow-500'
      case 'resolved': return 'bg-green-500'
      case 'false-positive': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const SecurityPostureDashboard = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {securityMetrics.map((metric, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                <div className="flex items-center">
                  <span className="text-2xl font-bold">{metric.value}</span>
                  <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
                </div>
              </div>
              <div className="flex items-center">
                {metric.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {metric.trend === 'down' && <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />}
                {metric.trend === 'stable' && <Activity className="h-4 w-4 text-blue-500" />}
              </div>
            </div>
            <Progress 
              value={(metric.value / metric.threshold) * 100} 
              className="mt-3"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  ), [securityMetrics])

  const ThreatHuntingPanel = useMemo(() => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Threat Hunting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Textarea
              placeholder="Enter your threat hunting query (KQL, SPL, or natural language)..."
              value={threatHuntQuery}
              onChange={(e) => setThreatHuntQuery(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleThreatHunt} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Execute Hunt
          </Button>
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Threat Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {threatIndicators.map((indicator) => (
                  <div key={indicator.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {indicator.type}
                        </Badge>
                        <span className="font-mono text-sm">{indicator.value}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={indicator.confidence} className="w-16 h-2" />
                        <span className="text-xs text-muted-foreground">{indicator.confidence}%</span>
                      </div>
                    </div>
                    <Target className="h-4 w-4 text-red-500" />
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Query Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    Execute a hunt query to see results
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  ), [threatHuntQuery, selectedTimeRange, loading, handleThreatHunt, threatIndicators])

  const SecurityAlertsQueue = useMemo(() => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Security Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {securityEvents.map((event) => (
            <div key={event.id} className="border rounded-lg p-4 mb-3 hover:bg-muted/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${getSeverityColor(event.severity)} text-white`}>
                      {event.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(event.status)}>
                      {event.status.replace('-', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="font-semibold">{event.type}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Source: {event.source}</span>
                    {event.assignedTo && <span>• Assigned to: {event.assignedTo}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="outline" onClick={() => handleIncidentCreate(event.id)}>
                    Create Incident
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  ), [securityEvents, handleIncidentCreate])

  const IncidentResponseWorkflow = useMemo(() => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-sm">Active Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {incidents.map((incident) => (
              <div 
                key={incident.id} 
                className={`p-3 border rounded mb-2 cursor-pointer hover:bg-muted/50 ${
                  selectedIncident === incident.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedIncident(incident.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs`}>
                    {incident.severity}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {incident.status}
                  </Badge>
                </div>
                <h5 className="font-medium text-sm">{incident.title}</h5>
                <p className="text-xs text-muted-foreground">
                  Assigned: {incident.assignee}
                </p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Incident Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedIncident ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Workflow Steps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {incidents.find(i => i.id === selectedIncident)?.steps.map((step) => (
                        <div key={step.id} className="flex items-center gap-3">
                          {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {step.status === 'in-progress' && <Clock className="h-4 w-4 text-blue-500" />}
                          {step.status === 'pending' && <XCircle className="h-4 w-4 text-gray-400" />}
                          {step.status === 'skipped' && <XCircle className="h-4 w-4 text-orange-500" />}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{step.title}</p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Evidence & Artifacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {incidents.find(i => i.id === selectedIncident)?.evidence.map((evidence) => (
                        <div key={evidence.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <FileText className="h-4 w-4" />
                          <div className="flex-1">
                            <p className="text-xs font-medium">{evidence.source}</p>
                            <p className="text-xs text-muted-foreground">{evidence.type}</p>
                          </div>
                          {evidence.preserved && <Lock className="h-3 w-3 text-green-500" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Select an incident to view workflow details
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  ), [incidents, selectedIncident