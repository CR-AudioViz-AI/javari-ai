'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Settings, 
  Shield, 
  Activity, 
  FileText, 
  Building, 
  CreditCard, 
  Bell,
  Server,
  Database,
  Cpu,
  HardDrive,
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Download
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
  permissions: string[];
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  responseTime: number;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  timestamp: string;
  ip: string;
  status: 'success' | 'failed' | 'warning';
  details: string;
}

interface Organization {
  id: string;
  name: string;
  domain: string;
  plan: 'starter' | 'professional' | 'enterprise';
  users: number;
  storage: number;
  status: 'active' | 'suspended' | 'trial';
  billingStatus: 'paid' | 'overdue' | 'cancelled';
}

interface AdminDashboardProps {
  className?: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 65,
    memory: 78,
    disk: 45,
    network: 32,
    activeConnections: 1247,
    totalRequests: 156789,
    errorRate: 0.12,
    responseTime: 245
  });

  const [users] = useState<User[]>([
    {
      id: '1',
      email: 'admin@company.com',
      name: 'Sarah Johnson',
      role: 'super_admin',
      status: 'active',
      lastLogin: '2024-01-15T10:30:00Z',
      createdAt: '2023-12-01T00:00:00Z',
      permissions: ['all']
    },
    {
      id: '2',
      email: 'manager@company.com',
      name: 'Mike Chen',
      role: 'manager',
      status: 'active',
      lastLogin: '2024-01-15T09:15:00Z',
      createdAt: '2023-12-15T00:00:00Z',
      permissions: ['user_management', 'view_analytics']
    },
    {
      id: '3',
      email: 'user@company.com',
      name: 'Emily Davis',
      role: 'user',
      status: 'inactive',
      lastLogin: '2024-01-10T14:20:00Z',
      createdAt: '2024-01-05T00:00:00Z',
      permissions: ['view_dashboard']
    }
  ]);

  const [auditLogs] = useState<AuditLog[]>([
    {
      id: '1',
      userId: '1',
      userName: 'Sarah Johnson',
      action: 'User Created',
      resource: 'users/3',
      timestamp: '2024-01-15T10:30:00Z',
      ip: '192.168.1.100',
      status: 'success',
      details: 'Created user account for Emily Davis'
    },
    {
      id: '2',
      userId: '2',
      userName: 'Mike Chen',
      action: 'Permission Updated',
      resource: 'permissions/user_2',
      timestamp: '2024-01-15T09:15:00Z',
      ip: '192.168.1.101',
      status: 'success',
      details: 'Updated user permissions for analytics access'
    },
    {
      id: '3',
      userId: '1',
      userName: 'Sarah Johnson',
      action: 'Login Failed',
      resource: 'auth/login',
      timestamp: '2024-01-15T08:45:00Z',
      ip: '10.0.0.50',
      status: 'failed',
      details: 'Failed login attempt - invalid credentials'
    }
  ]);

  const [organizations] = useState<Organization[]>([
    {
      id: '1',
      name: 'Acme Corporation',
      domain: 'acme.com',
      plan: 'enterprise',
      users: 250,
      storage: 500,
      status: 'active',
      billingStatus: 'paid'
    },
    {
      id: '2',
      name: 'TechStart Inc',
      domain: 'techstart.io',
      plan: 'professional',
      users: 50,
      storage: 100,
      status: 'trial',
      billingStatus: 'paid'
    },
    {
      id: '3',
      name: 'Global Dynamics',
      domain: 'globaldyn.com',
      plan: 'starter',
      users: 15,
      storage: 25,
      status: 'suspended',
      billingStatus: 'overdue'
    }
  ]);

  const chartData = [
    { name: 'Mon', requests: 4000, errors: 24 },
    { name: 'Tue', requests: 3000, errors: 13 },
    { name: 'Wed', requests: 2000, errors: 8 },
    { name: 'Thu', requests: 2780, errors: 19 },
    { name: 'Fri', requests: 1890, errors: 7 },
    { name: 'Sat', requests: 2390, errors: 12 },
    { name: 'Sun', requests: 3490, errors: 16 }
  ];

  const planDistribution = [
    { name: 'Starter', value: 45, color: '#8884d8' },
    { name: 'Professional', value: 35, color: '#82ca9d' },
    { name: 'Enterprise', value: 20, color: '#ffc658' }
  ];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-orange-100 text-orange-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAuditStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    // Simulate real-time metrics updates
    const interval = setInterval(() => {
      setSystemMetrics(prev => ({
        ...prev,
        cpu: Math.max(0, Math.min(100, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(0, Math.min(100, prev.memory + (Math.random() - 0.5) * 5)),
        network: Math.max(0, Math.min(100, prev.network + (Math.random() - 0.5) * 15)),
        activeConnections: Math.max(0, prev.activeConnections + Math.floor((Math.random() - 0.5) * 100)),
        responseTime: Math.max(100, prev.responseTime + (Math.random() - 0.5) * 50)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${className}`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Enterprise Control Panel</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm font-medium">System Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-10 lg:w-fit">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Resources</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissions</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="organizations" className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Orgs</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2,847</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics.activeConnections.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Real-time connections</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Load</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics.cpu}%</div>
                  <Progress value={systemMetrics.cpu} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(systemMetrics.responseTime)}ms</div>
                  <p className="text-xs text-muted-foreground">Average response time</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Request Volume</CardTitle>
                  <CardDescription>Daily API requests and errors</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="requests" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="errors" stroke="#ff7c7c" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Plan Distribution</CardTitle>
                  <CardDescription>Customer plan breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center space-x-4 mt-4">
                    {planDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm">{entry.name}: {entry.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent System Activity</CardTitle>
                <CardDescription>Latest system events and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start space-x-4 p-3 bg-gray-50 rounded-lg">
                      {getAuditStatusIcon(log.status)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{log.action}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{log.details}</p>
                        <p className="text-xs text-muted-foreground">by {log.userName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage user accounts, roles, and permissions</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>