```tsx
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Users,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Database,
  Network,
  Cpu,
  HardDrive,
  Bell,
  Plus,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  Upload,
  Download,
  RefreshCw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { checkUserRole } from '@/lib/auth/rbac'
import { toast } from 'sonner'

interface UserRole {
  id: string
  name: string
  permissions: string[]
}

interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_throughput: number
  active_connections: number
  response_time: number
  error_rate: number
  uptime: number
}

interface Integration {
  id: string
  name: string
  type: string
  status: 'active' | 'inactive' | 'error' | 'pending'
  last_sync: string
  error_message?: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  status: 'active' | 'inactive' | 'suspended'
  last_login: string
  created_at: string
}

interface SecurityPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  policy_type: string
  rules: Record<string, any>
  created_at: string
  updated_at: string
}

interface ActivityLog {
  id: string
  action: string
  user_email: string
  timestamp: string
  resource_type: string
  resource_id: string
  details: Record<string, any>
}

interface AdminNotification {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  timestamp: string
  read: boolean
}

interface EnterpriseAdminDashboardProps {
  className?: string
}

interface RoleBasedAccessWrapperProps {
  children: React.ReactNode
  requiredRole: string
  userRole?: string
  fallback?: React.ReactNode
}

const RoleBasedAccessWrapper: React.FC<RoleBasedAccessWrapperProps> = ({
  children,
  requiredRole,
  userRole,
  fallback
}) => {
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const hasPermission = await checkUserRole(requiredRole)
        setHasAccess(hasPermission)
      } catch (error) {
        console.error('Error checking user role:', error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [requiredRole])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      fallback || (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this section.
          </AlertDescription>
        </Alert>
      )
    )
  }

  return <>{children}</>
}

const AdminMetricsCards: React.FC<{ metrics: SystemMetrics }> = ({ metrics }) => {
  const metricCards = [
    {
      title: 'CPU Usage',
      value: `${metrics.cpu_usage}%`,
      icon: Cpu,
      color: metrics.cpu_usage > 80 ? 'destructive' : metrics.cpu_usage > 60 ? 'warning' : 'default'
    },
    {
      title: 'Memory Usage',
      value: `${metrics.memory_usage}%`,
      icon: HardDrive,
      color: metrics.memory_usage > 80 ? 'destructive' : metrics.memory_usage > 60 ? 'warning' : 'default'
    },
    {
      title: 'Active Connections',
      value: metrics.active_connections.toLocaleString(),
      icon: Network,
      color: 'default'
    },
    {
      title: 'Response Time',
      value: `${metrics.response_time}ms`,
      icon: Clock,
      color: metrics.response_time > 1000 ? 'destructive' : metrics.response_time > 500 ? 'warning' : 'default'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metricCards.map((metric, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </p>
                <p className="text-2xl font-bold">{metric.value}</p>
              </div>
              <metric.icon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const IntegrationsPanel: React.FC<{ integrations: Integration[] }> = ({ integrations }) => {
  const getStatusBadge = (status: Integration['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive',
      pending: 'outline'
    } as const

    const icons = {
      active: CheckCircle,
      inactive: XCircle,
      error: AlertTriangle,
      pending: Clock
    }

    const Icon = icons[status]

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Enterprise Integrations</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
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
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">{integration.name}</TableCell>
                  <TableCell>{integration.type}</TableCell>
                  <TableCell>{getStatusBadge(integration.status)}</TableCell>
                  <TableCell>
                    {new Date(integration.last_sync).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Now
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const UserProvisioningPanel: React.FC<{ users: UserProfile[] }> = ({ users }) => {
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [bulkAction, setBulkAction] = useState<string>('')

  const getStatusBadge = (status: UserProfile['status']) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive'
    } as const

    return <Badge variant={variants[status]}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Provisioning</h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Users
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bulkAction} onValueChange={setBulkAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Bulk actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activate">Activate Users</SelectItem>
            <SelectItem value="suspend">Suspend Users</SelectItem>
            <SelectItem value="export">Export Users</SelectItem>
            <SelectItem value="delete">Delete Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input type="checkbox" className="rounded" />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <input type="checkbox" className="rounded" />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    {new Date(user.last_login).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Shield className="h-4 w-4 mr-2" />
                          Manage Permissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const SecurityPoliciesPanel: React.FC<{ policies: SecurityPolicy[] }> = ({ policies }) => {
  const handleTogglePolicy = async (policyId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('security_policies')
        .update({ enabled })
        .eq('id', policyId)

      if (error) throw error
      toast.success('Policy updated successfully')
    } catch (error) {
      toast.error('Failed to update policy')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Security Policies</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Policy
        </Button>
      </div>

      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">{policy.name}</CardTitle>
                <CardDescription>{policy.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={policy.enabled}
                  onCheckedChange={(enabled) => handleTogglePolicy(policy.id, enabled)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Policy
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type: {policy.policy_type}</span>
                <span className="text-muted-foreground">
                  Updated: {new Date(policy.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const SystemMonitoringPanel: React.FC<{ metrics: SystemMetrics }> = ({ metrics }) => {
  const [timeRange, setTimeRange] = useState('24h')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">System Monitoring</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>CPU Usage</span>
                <span>{metrics.cpu_usage}%</span>
              </div>
              <Progress value={metrics.cpu_usage} className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Memory Usage</span>
                <span>{metrics.memory_usage}%</span>
              </div>
              <Progress value={metrics.memory_usage} className="mt-1" />
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Disk Usage</span>
                <span>{metrics.disk_usage}%</span>
              </div>
              <Progress value={metrics.disk_usage} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Network Throughput</span>
              <span className="font-medium">{metrics.network_throughput} MB/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Error Rate</span>
              <span className="font-medium">{metrics.error_rate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="font-medium">{metrics.uptime}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Real-time Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Real-time monitoring charts would be displayed here
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const ActivityFeedWidget: React.FC<{ activities: ActivityLog[] }> = ({ activities }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user_email} • {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

const AdminNotifications: React.FC<{ notifications: AdminNotification[] }> = ({ notifications }) => {
  const getNotificationIcon = (type: AdminNotification['type']) => {
    const icons = {
      info: