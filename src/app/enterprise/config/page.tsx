```tsx
'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Settings, 
  Key, 
  Activity, 
  Shield, 
  Users, 
  Monitor, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  RotateCcw, 
  Plus, 
  ExternalLink,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'

interface EnterpriseConfig {
  id: string
  organizationId: string
  settings: Record<string, any>
  integrations: Integration[]
  apiKeys: ApiKey[]
  complianceSettings: ComplianceSettings
  auditSettings: AuditSettings
  lastUpdated: string
}

interface Integration {
  id: string
  name: string
  type: 'slack' | 'teams' | 'ldap' | 'sso' | 'webhook'
  status: 'active' | 'inactive' | 'error' | 'pending'
  configuration: Record<string, any>
  lastSync: string
  errorMessage?: string
}

interface ApiKey {
  id: string
  name: string
  environment: 'production' | 'staging' | 'development'
  permissions: string[]
  lastUsed: string
  expiresAt: string
  isActive: boolean
  usageCount: number
}

interface ComplianceSettings {
  frameworks: ('SOC2' | 'HIPAA' | 'GDPR' | 'ISO27001')[]
  reportingFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  autoGenerate: boolean
  retentionPeriod: number
  encryptionRequired: boolean
}

interface AuditSettings {
  enabledEvents: string[]
  retentionDays: number
  realTimeAlerts: boolean
  exportFormat: 'json' | 'csv' | 'pdf'
}

interface DataFlowMetrics {
  totalRequests: number
  successRate: number
  averageLatency: number
  errorRate: number
  throughput: number
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  uptime: number
  lastCheck: string
  services: Array<{
    name: string
    status: 'up' | 'down' | 'degraded'
    responseTime: number
  }>
}

export default function EnterpriseConfigDashboard() {
  const [config, setConfig] = useState<EnterpriseConfig | null>(null)
  const [dataFlowMetrics, setDataFlowMetrics] = useState<DataFlowMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('integrations')
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        // Mock data - replace with actual Supabase calls
        const mockConfig: EnterpriseConfig = {
          id: '1',
          organizationId: 'org-123',
          settings: {},
          integrations: [
            {
              id: '1',
              name: 'Slack Integration',
              type: 'slack',
              status: 'active',
              configuration: { webhookUrl: 'https://hooks.slack.com/...' },
              lastSync: '2024-01-15T10:30:00Z'
            },
            {
              id: '2',
              name: 'Microsoft Teams',
              type: 'teams',
              status: 'error',
              configuration: { tenantId: 'tenant-123' },
              lastSync: '2024-01-14T15:20:00Z',
              errorMessage: 'Authentication failed'
            }
          ],
          apiKeys: [
            {
              id: '1',
              name: 'Production API Key',
              environment: 'production',
              permissions: ['read', 'write'],
              lastUsed: '2024-01-15T08:45:00Z',
              expiresAt: '2024-12-31T23:59:59Z',
              isActive: true,
              usageCount: 15420
            },
            {
              id: '2',
              name: 'Staging API Key',
              environment: 'staging',
              permissions: ['read'],
              lastUsed: '2024-01-10T12:30:00Z',
              expiresAt: '2024-06-30T23:59:59Z',
              isActive: true,
              usageCount: 892
            }
          ],
          complianceSettings: {
            frameworks: ['SOC2', 'GDPR'],
            reportingFrequency: 'monthly',
            autoGenerate: true,
            retentionPeriod: 2555,
            encryptionRequired: true
          },
          auditSettings: {
            enabledEvents: ['login', 'api_access', 'config_change'],
            retentionDays: 365,
            realTimeAlerts: true,
            exportFormat: 'json'
          },
          lastUpdated: '2024-01-15T10:30:00Z'
        }

        const mockMetrics: DataFlowMetrics = {
          totalRequests: 125000,
          successRate: 99.2,
          averageLatency: 145,
          errorRate: 0.8,
          throughput: 1200
        }

        const mockHealth: SystemHealth = {
          status: 'healthy',
          uptime: 99.9,
          lastCheck: '2024-01-15T10:30:00Z',
          services: [
            { name: 'API Gateway', status: 'up', responseTime: 45 },
            { name: 'Database', status: 'up', responseTime: 23 },
            { name: 'Cache', status: 'up', responseTime: 12 },
            { name: 'Message Queue', status: 'degraded', responseTime: 156 }
          ]
        }

        setConfig(mockConfig)
        setDataFlowMetrics(mockMetrics)
        setSystemHealth(mockHealth)
      } catch (error) {
        console.error('Failed to load configuration:', error)
      } finally {
        setLoading(false)
      }
    }

    loadConfiguration()
  }, [])

  const handleIntegrationToggle = async (integrationId: string, enabled: boolean) => {
    // Implementation for toggling integration status
    console.log('Toggle integration:', integrationId, enabled)
  }

  const handleApiKeyRotation = async (keyId: string) => {
    // Implementation for API key rotation
    console.log('Rotate API key:', keyId)
  }

  const handleGenerateComplianceReport = async (framework: string) => {
    // Implementation for generating compliance reports
    console.log('Generate compliance report for:', framework)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'up':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'degraded':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
      case 'down':
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!config || !dataFlowMetrics || !systemHealth) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load enterprise configuration. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Configuration</h1>
          <p className="text-muted-foreground">
            Manage integrations, API keys, compliance settings, and system monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(systemHealth.status)}>
            System {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <div className="text-sm font-medium">Total Requests</div>
            </div>
            <div className="text-2xl font-bold">{dataFlowMetrics.totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="text-sm font-medium">Success Rate</div>
            </div>
            <div className="text-2xl font-bold">{dataFlowMetrics.successRate}%</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-sm font-medium">Avg Latency</div>
            </div>
            <div className="text-2xl font-bold">{dataFlowMetrics.averageLatency}ms</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium">Uptime</div>
            </div>
            <div className="text-2xl font-bold">{systemHealth.uptime}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="integrations" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="data-flows" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Data Flows</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center space-x-2">
            <Monitor className="h-4 w-4" />
            <span>Audit</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Management</CardTitle>
              <CardDescription>
                Configure and monitor third-party integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Integration
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Integration</DialogTitle>
                      <DialogDescription>
                        Configure a new third-party integration
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="integration-type">Integration Type</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select integration type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slack">Slack</SelectItem>
                            <SelectItem value="teams">Microsoft Teams</SelectItem>
                            <SelectItem value="ldap">LDAP</SelectItem>
                            <SelectItem value="sso">Single Sign-On</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="integration-name">Name</Label>
                        <Input id="integration-name" placeholder="Enter integration name" />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline">Cancel</Button>
                        <Button>Add Integration</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">{integration.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {integration.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(integration.status)}>
                          {integration.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(integration.lastSync).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={integration.status === 'active'}
                            onCheckedChange={(checked) => 
                              handleIntegrationToggle(integration.id, checked)
                            }
                            aria-label={`Toggle ${integration.name}`}
                          />
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Key Vault</CardTitle>
              <CardDescription>
                Manage API keys with automatic rotation and usage monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate New Key
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            apiKey.environment === 'production' 
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : apiKey.environment === 'staging'
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }
                        >
                          {apiKey.environment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <code className="text-sm">
                            {showApiKey[apiKey.id] 
                              ? `sk_${apiKey.id}_full_key_here`
                              : `sk_${apiKey.id}_****`
                            }
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(apiKey.id)}
                          >
                            {showApiKey[apiKey.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {apiKey.permissions.map((permission) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{apiKey.usageCount.toLocaleString()}</TableCell>
                      <TableCell>
                        {new Date(apiKey.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApiKeyRotation(apiKey.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-flows" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Real-time system status monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemHealth.services.map((service) => (
                    <div key={service.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          service.status === 'up' ? 'bg-green-500' :
                          service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {service.responseTime}ms
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Data flow performance overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span>{dataFlowMetrics.successRate}%</span>
                    </div>
                    <Progress value={dataFlowMetrics.successRate} className="h-2" />