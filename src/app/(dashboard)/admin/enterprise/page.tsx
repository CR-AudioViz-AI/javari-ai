```tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Settings, 
  Users, 
  Shield, 
  Activity, 
  FileText, 
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  Bell,
  Key,
  Webhook,
  BarChart3,
  Globe
} from 'lucide-react'

interface EnterpriseUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'user'
  status: 'active' | 'inactive' | 'pending'
  lastLogin: string
  permissions: string[]
}

interface Integration {
  id: string
  name: string
  type: 'sso' | 'api' | 'webhook'
  status: 'active' | 'inactive' | 'error'
  lastSync: string
  config: Record<string, any>
}

interface SystemMetric {
  name: string
  value: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
}

interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  resource: string
  details: string
  status: 'success' | 'failure'
}

interface ComplianceReport {
  id: string
  type: string
  period: string
  status: 'generated' | 'pending' | 'failed'
  generatedAt: string
  downloadUrl?: string
}

const MOCK_USERS: EnterpriseUser[] = [
  {
    id: '1',
    email: 'admin@company.com',
    name: 'John Smith',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-01-15T14:30:00Z',
    permissions: ['all']
  },
  {
    id: '2',
    email: 'manager@company.com',
    name: 'Sarah Johnson',
    role: 'manager',
    status: 'active',
    lastLogin: '2024-01-15T10:15:00Z',
    permissions: ['users.read', 'reports.read']
  }
]

const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: '1',
    name: 'Azure AD SSO',
    type: 'sso',
    status: 'active',
    lastSync: '2024-01-15T14:45:00Z',
    config: { tenantId: 'xxx-xxx-xxx', clientId: 'yyy-yyy-yyy' }
  },
  {
    id: '2',
    name: 'Slack Webhook',
    type: 'webhook',
    status: 'active',
    lastSync: '2024-01-15T14:30:00Z',
    config: { url: 'https://hooks.slack.com/xxx', channel: '#alerts' }
  }
]

const MOCK_METRICS: SystemMetric[] = [
  { name: 'CPU Usage', value: 65, unit: '%', status: 'healthy', trend: 'stable' },
  { name: 'Memory Usage', value: 78, unit: '%', status: 'warning', trend: 'up' },
  { name: 'API Requests', value: 1250, unit: '/min', status: 'healthy', trend: 'up' },
  { name: 'Error Rate', value: 0.5, unit: '%', status: 'healthy', trend: 'down' }
]

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: '1',
    timestamp: '2024-01-15T14:45:00Z',
    user: 'john.smith@company.com',
    action: 'user.create',
    resource: 'sarah.johnson@company.com',
    details: 'Created new manager user',
    status: 'success'
  },
  {
    id: '2',
    timestamp: '2024-01-15T14:30:00Z',
    user: 'john.smith@company.com',
    action: 'integration.update',
    resource: 'Azure AD SSO',
    details: 'Updated SSO configuration',
    status: 'success'
  }
]

const MOCK_REPORTS: ComplianceReport[] = [
  {
    id: '1',
    type: 'SOC 2 Type II',
    period: 'Q4 2023',
    status: 'generated',
    generatedAt: '2024-01-15T09:00:00Z',
    downloadUrl: '#'
  },
  {
    id: '2',
    type: 'GDPR Compliance',
    period: 'December 2023',
    status: 'pending',
    generatedAt: '2024-01-15T14:00:00Z'
  }
]

export default function EnterpriseAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState<EnterpriseUser[]>(MOCK_USERS)
  const [integrations, setIntegrations] = useState<Integration[]>(MOCK_INTEGRATIONS)
  const [systemMetrics] = useState<SystemMetric[]>(MOCK_METRICS)
  const [auditLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS)
  const [reports] = useState<ComplianceReport[]>(MOCK_REPORTS)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateIntegration, setShowCreateIntegration] = useState(false)

  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'user' as const,
    permissions: [] as string[]
  })

  const [newIntegration, setNewIntegration] = useState({
    name: '',
    type: 'api' as const,
    config: {}
  })

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'all' || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'warning':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
      case 'error':
      case 'critical':
      case 'failure':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
      case 'success':
        return <CheckCircle className="h-4 w-4" />
      case 'warning':
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'inactive':
      case 'error':
      case 'critical':
      case 'failure':
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const handleCreateUser = () => {
    const user: EnterpriseUser = {
      id: Date.now().toString(),
      ...newUser,
      status: 'pending',
      lastLogin: new Date().toISOString()
    }
    setUsers([...users, user])
    setNewUser({ email: '', name: '', role: 'user', permissions: [] })
    setShowCreateUser(false)
  }

  const handleCreateIntegration = () => {
    const integration: Integration = {
      id: Date.now().toString(),
      ...newIntegration,
      status: 'inactive',
      lastSync: new Date().toISOString()
    }
    setIntegrations([...integrations, integration])
    setNewIntegration({ name: '', type: 'api', config: {} })
    setShowCreateIntegration(false)
  }

  const RoleBasedSidebar = () => (
    <div className="w-64 bg-white border-r border-gray-200 p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold">Enterprise Admin</h2>
        </div>
        <Separator />
        <nav className="space-y-2">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('dashboard')}
            aria-label="Dashboard"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('users')}
            aria-label="User Management"
          >
            <Users className="mr-2 h-4 w-4" />
            Users
          </Button>
          <Button
            variant={activeTab === 'integrations' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('integrations')}
            aria-label="Integrations"
          >
            <Globe className="mr-2 h-4 w-4" />
            Integrations
          </Button>
          <Button
            variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('monitoring')}
            aria-label="System Monitoring"
          >
            <Activity className="mr-2 h-4 w-4" />
            Monitoring
          </Button>
          <Button
            variant={activeTab === 'compliance' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('compliance')}
            aria-label="Compliance"
          >
            <FileText className="mr-2 h-4 w-4" />
            Compliance
          </Button>
          <Button
            variant={activeTab === 'audit' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setActiveTab('audit')}
            aria-label="Audit Logs"
          >
            <Eye className="mr-2 h-4 w-4" />
            Audit Logs
          </Button>
        </nav>
      </div>
    </div>
  )

  const DashboardOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Integrations</p>
                <p className="text-2xl font-bold">{integrations.filter(i => i.status === 'active').length}</p>
              </div>
              <Globe className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold">98.5%</p>
              </div>
              <Activity className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                <p className="text-2xl font-bold">95%</p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start space-x-3">
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-500">{log.details}</p>
                      <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>High Memory Usage</AlertTitle>
                <AlertDescription>
                  Memory usage is at 78%. Consider scaling resources.
                </AlertDescription>
              </Alert>
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertTitle>Backup Completed</AlertTitle>
                <AlertDescription>
                  Daily backup completed successfully at 2:00 AM.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const UserManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">User Management</h3>
        <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to your enterprise account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-name">Name</Label>
                <Input
                  id="user-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Enter user name"
                />
              </div>
              <div>
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            aria-label="Search users"
          />
        </div>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(user.status)}>
                    {getStatusIcon(user.status)}
                    <span className="ml-1">{user.status}</span>
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-500">
                    {new Date(user.lastLogin).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" aria-label={`Edit ${user.name}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" aria-label={`Delete ${user.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )

  const IntegrationManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Integration Management</h3>
        <Dialog open={showCreateIntegration} onOpenChange={setShowCreateIntegration}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Integration</DialogTitle>
              <DialogDescription>
                Configure a new integration for your enterprise.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="integration-name">Name</Label>
                <Input
                  id="integration-name"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                  placeholder="Enter integration name"
                />
              </div>
              <div>
                <Label htmlFor="integration-type">Type</Label>
                <Select value={newIntegration.type} onValue