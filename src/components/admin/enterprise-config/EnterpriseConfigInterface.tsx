```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { 
  Settings, 
  Users, 
  GitBranch, 
  Shield, 
  Activity,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Network,
  Database,
  Key,
  Monitor
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

// Types
interface EnterpriseRole {
  id: string
  name: string
  description: string
  permissions: string[]
  userCount: number
  isSystem: boolean
}

interface EnterpriseUser {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: EnterpriseRole[]
  status: 'active' | 'inactive' | 'pending'
  lastLogin?: string
  department?: string
}

interface Integration {
  id: string
  name: string
  type: 'api' | 'database' | 'file' | 'webhook'
  status: 'active' | 'inactive' | 'error'
  lastSync?: string
  errorCount: number
  config: Record<string, unknown>
}

interface DataFlow {
  id: string
  name: string
  source: string
  destination: string
  status: 'running' | 'stopped' | 'error'
  throughput: number
  lastRun?: string
}

interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resource: string
  timestamp: string
  details: Record<string, unknown>
  ipAddress: string
}

interface SystemConfig {
  id: string
  category: string
  key: string
  value: string
  description: string
  isEncrypted: boolean
  lastModified: string
}

interface EnterpriseConfigProps {
  userRole: string
  permissions: string[]
  onConfigChange?: (config: Record<string, unknown>) => void
  className?: string
}

// Form schemas
const integrationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['api', 'database', 'file', 'webhook']),
  config: z.record(z.unknown()),
  description: z.string().optional()
})

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
  department: z.string().optional()
})

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().min(1, 'Description is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required')
})

const configSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  isEncrypted: z.boolean().default(false)
})

// Mock data (replace with actual API calls)
const mockRoles: EnterpriseRole[] = [
  { id: '1', name: 'Super Admin', description: 'Full system access', permissions: ['*'], userCount: 2, isSystem: true },
  { id: '2', name: 'Admin', description: 'Administrative access', permissions: ['admin.*'], userCount: 5, isSystem: false },
  { id: '3', name: 'Manager', description: 'Management access', permissions: ['read.*', 'write.reports'], userCount: 12, isSystem: false },
  { id: '4', name: 'User', description: 'Standard user access', permissions: ['read.basic'], userCount: 150, isSystem: false }
]

const mockUsers: EnterpriseUser[] = [
  { id: '1', email: 'admin@company.com', firstName: 'John', lastName: 'Doe', roles: [mockRoles[0]], status: 'active', lastLogin: '2024-01-15T10:30:00Z', department: 'IT' },
  { id: '2', email: 'manager@company.com', firstName: 'Jane', lastName: 'Smith', roles: [mockRoles[2]], status: 'active', lastLogin: '2024-01-15T09:15:00Z', department: 'Operations' },
  { id: '3', email: 'user@company.com', firstName: 'Bob', lastName: 'Johnson', roles: [mockRoles[3]], status: 'inactive', department: 'Sales' }
]

const mockIntegrations: Integration[] = [
  { id: '1', name: 'Salesforce CRM', type: 'api', status: 'active', lastSync: '2024-01-15T12:00:00Z', errorCount: 0, config: {} },
  { id: '2', name: 'PostgreSQL DB', type: 'database', status: 'active', lastSync: '2024-01-15T11:45:00Z', errorCount: 2, config: {} },
  { id: '3', name: 'Webhook Listener', type: 'webhook', status: 'error', errorCount: 5, config: {} }
]

const mockDataFlows: DataFlow[] = [
  { id: '1', name: 'CRM to Analytics', source: 'Salesforce', destination: 'Data Warehouse', status: 'running', throughput: 1250, lastRun: '2024-01-15T12:00:00Z' },
  { id: '2', name: 'File Import Process', source: 'FTP Server', destination: 'Processing Queue', status: 'stopped', throughput: 0 }
]

const mockAuditLogs: AuditLogEntry[] = [
  { id: '1', userId: '1', action: 'user.create', resource: 'users/2', timestamp: '2024-01-15T10:30:00Z', details: {}, ipAddress: '192.168.1.1' },
  { id: '2', userId: '1', action: 'config.update', resource: 'system/auth', timestamp: '2024-01-15T10:25:00Z', details: {}, ipAddress: '192.168.1.1' }
]

const mockSystemConfigs: SystemConfig[] = [
  { id: '1', category: 'Authentication', key: 'session_timeout', value: '3600', description: 'Session timeout in seconds', isEncrypted: false, lastModified: '2024-01-15T10:00:00Z' },
  { id: '2', category: 'Security', key: 'api_key', value: '***encrypted***', description: 'Main API key', isEncrypted: true, lastModified: '2024-01-14T15:30:00Z' }
]

// Role-based wrapper component
const RoleBasedWrapper: React.FC<{ 
  requiredPermissions: string[]
  userPermissions: string[]
  children: React.ReactNode 
}> = ({ requiredPermissions, userPermissions, children }) => {
  const hasPermission = requiredPermissions.some(perm => 
    userPermissions.includes('*') || 
    userPermissions.includes(perm) ||
    userPermissions.some(userPerm => userPerm.endsWith('.*') && perm.startsWith(userPerm.slice(0, -1)))
  )

  if (!hasPermission) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access this feature.
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

// Integrations Panel Component
const IntegrationsPanel: React.FC<{ userPermissions: string[] }> = ({ userPermissions }) => {
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const form = useForm<z.infer<typeof integrationSchema>>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: '',
      type: 'api',
      config: {},
      description: ''
    }
  })

  const onSubmit = (data: z.infer<typeof integrationSchema>) => {
    const newIntegration: Integration = {
      id: Date.now().toString(),
      name: data.name,
      type: data.type,
      status: 'inactive',
      errorCount: 0,
      config: data.config
    }
    setIntegrations([...integrations, newIntegration])
    setIsDialogOpen(false)
    form.reset()
  }

  const filteredIntegrations = integrations.filter(integration =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Enterprise Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Manage external system connections and data sources
          </p>
        </div>
        <RoleBasedWrapper requiredPermissions={['integrations.create']} userPermissions={userPermissions}>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Integration</DialogTitle>
                <DialogDescription>
                  Configure a new external system integration
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter integration name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Integration Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select integration type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="api">API Integration</SelectItem>
                            <SelectItem value="database">Database Connection</SelectItem>
                            <SelectItem value="file">File System</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe this integration" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Integration</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </RoleBasedWrapper>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search integrations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredIntegrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{integration.name}</CardTitle>
              <Badge variant={integration.status === 'active' ? 'default' : integration.status === 'error' ? 'destructive' : 'secondary'}>
                {integration.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  {integration.type === 'api' && <Network className="h-4 w-4 mr-1" />}
                  {integration.type === 'database' && <Database className="h-4 w-4 mr-1" />}
                  {integration.type === 'webhook' && <GitBranch className="h-4 w-4 mr-1" />}
                  {integration.type}
                </div>
                {integration.lastSync && (
                  <div className="text-xs text-muted-foreground">
                    Last sync: {new Date(integration.lastSync).toLocaleString()}
                  </div>
                )}
                {integration.errorCount > 0 && (
                  <div className="flex items-center text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {integration.errorCount} errors
                  </div>
                )}
                <div className="flex space-x-1 pt-2">
                  <Button size="sm" variant="outline">
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <RoleBasedWrapper requiredPermissions={['integrations.edit']} userPermissions={userPermissions}>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </RoleBasedWrapper>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// User Permissions Manager Component
const UserPermissionsManager: React.FC<{ userPermissions: string[] }> = ({ userPermissions }) => {
  const [users, setUsers] = useState<EnterpriseUser[]>(mockUsers)
  const [roles, setRoles] = useState<EnterpriseRole[]>(mockRoles)
  const [activeTab, setActiveTab] = useState('users')
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)

  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      roles: [],
      department: ''
    }
  })

  const roleForm = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: []
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User & Role Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between">
            <Input placeholder="Search users..." className="max-w-sm" />
            <RoleBasedWrapper requiredPermissions={['users.create']} userPermissions={userPermissions}>
              <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <Form {...userForm}>
                    <form className="space-y-4">
                      <FormField
                        control={userForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={userForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Create User</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </RoleBasedWrapper>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary">{role.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="outline">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <RoleBasedWrapper requiredPermissions={['users.delete']} userPermissions={userPermissions}>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </RoleBasedWrapper>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-between">
            <Input placeholder="Search roles..."