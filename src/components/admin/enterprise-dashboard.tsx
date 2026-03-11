'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Shield,
  Users,
  Activity,
  FileText,
  Server,
  Search,
  Bell,
  BarChart3,
  Settings,
  Download,
  Eye,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Database,
  Lock,
  Globe,
  Filter,
  Calendar,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Key,
  Monitor,
  Wifi,
  HardDrive,
  Cpu,
  Memory,
  Network,
  Zap,
  CloudUpload,
  FileCheck,
  AlertCircle,
  Info
} from 'lucide-react';

// Types and Interfaces
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  lastActive: Date;
  status: 'active' | 'inactive' | 'suspended';
  permissions: Permission[];
  createdAt: Date;
  lastLogin?: Date;
  mfaEnabled: boolean;
  ssoProvider?: string;
}

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  level: number;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  timestamp: Date;
  trend: 'up' | 'down' | 'stable';
}

interface ComplianceReport {
  id: string;
  type: 'GDPR' | 'SOC2' | 'ISO27001' | 'HIPAA';
  status: 'compliant' | 'non-compliant' | 'pending';
  lastAudit: Date;
  nextAudit: Date;
  score: number;
  findings: ComplianceFinding[];
  generatedAt: Date;
}

interface ComplianceFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  remediation: string;
  status: 'open' | 'in-progress' | 'resolved';
  assignedTo?: string;
  dueDate?: Date;
}

interface Deployment {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  region: string;
  status: 'healthy' | 'degraded' | 'offline';
  version: string;
  lastDeployed: Date;
  instances: number;
  activeUsers: number;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  riskLevel: 'low' | 'medium' | 'high';
}

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'permission_change' | 'data_access' | 'system_change' | 'threat_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  userId?: string;
  description: string;
  source: string;
  resolved: boolean;
  investigator?: string;
}

interface Notification {
  id: string;
  type: 'system' | 'security' | 'compliance' | 'user' | 'deployment';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired: boolean;
  relatedResource?: string;
}

interface EnterpriseAdminDashboardProps {
  userRole: UserRole;
  permissions: Permission[];
  onUserAction?: (action: string, userId: string) => void;
  onSystemAction?: (action: string, data: any) => void;
  onExportReport?: (type: string, format: string) => Promise<void>;
  className?: string;
}

// Role-based Access Control HOC
const withRoleBasedAccess = <P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: string[]
) => {
  return (props: P & { userPermissions: Permission[] }) => {
    const { userPermissions, ...componentProps } = props;
    
    const hasAccess = requiredPermissions.every(permission =>
      userPermissions.some(p => p.name === permission)
    );

    if (!hasAccess) {
      return (
        <Card className="p-6">
          <div className="text-center">
            <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You don't have permission to view this section.
            </p>
          </div>
        </Card>
      );
    }

    return <Component {...(componentProps as P)} />;
  };
};

// User Management Panel Component
const UserManagementPanel: React.FC<{
  users: User[];
  roles: UserRole[];
  onUserUpdate: (user: User) => void;
  onUserDelete: (userId: string) => void;
  onRoleCreate: (role: UserRole) => void;
}> = ({ users, roles, onUserUpdate, onUserDelete, onRoleCreate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.role.id === roleFilter;
      
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  const getStatusBadge = (status: User['status']) => {
    const variants = {
      active: { variant: 'default' as const, label: 'Active' },
      inactive: { variant: 'secondary' as const, label: 'Inactive' },
      suspended: { variant: 'destructive' as const, label: 'Suspended' }
    };
    
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage users, roles, and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsRoleDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create Role
          </Button>
          <Button onClick={() => setIsUserDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role-filter">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setRoleFilter('all');
              }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      {user.department && (
                        <div className="text-xs text-muted-foreground">{user.department}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role.name}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.lastActive.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.mfaEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedUser(user);
                          setIsUserDialogOpen(true);
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUserUpdate({ ...user, mfaEnabled: !user.mfaEnabled })}>
                          <Key className="mr-2 h-4 w-4" />
                          {user.mfaEnabled ? 'Disable' : 'Enable'} MFA
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onUserDelete(user.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete User
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
  );
};

// System Health Monitor Component
const SystemHealthMonitor: React.FC<{
  metrics: SystemMetric[];
  deployments: Deployment[];
  onRefresh: () => void;
}> = ({ metrics, deployments, onRefresh }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  const getMetricStatusIcon = (status: SystemMetric['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getDeploymentStatusBadge = (status: Deployment['status']) => {
    const variants = {
      healthy: { variant: 'default' as const, label: 'Healthy' },
      degraded: { variant: 'destructive' as const, label: 'Degraded' },
      offline: { variant: 'secondary' as const, label: 'Offline' }
    };
    
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const overallHealth = useMemo(() => {
    const criticalCount = metrics.filter(m => m.status === 'critical').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'healthy';
  }, [metrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health</h2>
          <p className="text-muted-foreground">Real-time system monitoring and alerts</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getMetricStatusIcon(overallHealth)}
              <div>
                <h3 className="text-lg font-medium">Overall System Health</h3>
                <p className="text-muted-foreground capitalize">{overallHealth}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{deployments.filter(d => d.status === 'healthy').length}/{deployments.length}</div>
              <div className="text-sm text-muted-foreground">Healthy Deployments</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(metric => (
          <Card key={metric.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{metric.name}</div>
                {getMetricStatusIcon(metric.status)}
              </div>
              <div className="text-2xl font-bold mb-1">
                {metric.value.toFixed(1)}{metric.unit}
              </div>
              <Progress 
                value={(metric.value / metric.threshold.critical) * 100} 
                className="mb-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Warning: {metric.threshold.warning}{metric.unit}</span>
                <span>Critical: {metric.threshold.critical}{metric.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Status</CardTitle>
          <CardDescription>Current status of all deployments across environments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Instances</TableHead>
                <TableHead>Active Users</TableHead>
                <TableHead>Resource Usage</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map(deployment => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deployment.name}</div>
                      <div className="text-sm text-muted-foreground">{deployment.region}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {deployment.environment}
                    </Badge>
                  </TableCell>
                  <TableCell>{getDeploymentStatusBadge(deployment.status)}</TableCell>
                  <TableCell className="font-mono text-sm">{deployment.version}</TableCell>
                  <TableCell>{deployment.instances}</TableCell>
                  <TableCell>{deployment.activeUsers.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <Cpu className="w-3 h-3" />
                        <span>CPU: {deployment.resources.cpu}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Memory className="w-3 h-3" />
                        <span>RAM: {deployment.resources.memory}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <HardDrive className="w-3 h-3" />
                        <span>Storage: {deployment.resources.storage}%</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrig