```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { 
  Users, 
  Shield, 
  CreditCard, 
  FileText, 
  Settings, 
  Activity, 
  BarChart3, 
  Bell, 
  Download, 
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Server,
  Database,
  Zap
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  permissions: string[];
  department: string;
}

interface Permission {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface BillingMetrics {
  monthlyRevenue: number;
  activeSubscriptions: number;
  usageOverage: number;
  pendingInvoices: number;
}

interface ComplianceReport {
  id: string;
  type: string;
  status: 'completed' | 'pending' | 'failed';
  generatedAt: string;
  reportPeriod: string;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'error' | 'inactive';
  lastSync: string;
}

interface AuditEntry {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  resource: string;
  details: string;
}

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
}

interface AdminPanelProps {
  userRole?: string;
  permissions?: string[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  userRole = 'admin',
  permissions = []
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [billingMetrics, setBillingMetrics] = useState<BillingMetrics>({
    monthlyRevenue: 0,
    activeSubscriptions: 0,
    usageOverage: 0,
    pendingInvoices: 0
  });
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission) || userRole === 'super_admin';
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        // Simulate data loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setUsers([
          {
            id: '1',
            email: 'john.doe@company.com',
            name: 'John Doe',
            role: 'Manager',
            status: 'active',
            lastLogin: '2024-01-15T10:30:00Z',
            permissions: ['user:read', 'user:write'],
            department: 'Engineering'
          }
        ]);

        setBillingMetrics({
          monthlyRevenue: 125000,
          activeSubscriptions: 45,
          usageOverage: 8500,
          pendingInvoices: 12
        });

        setComplianceReports([
          {
            id: '1',
            type: 'SOC 2 Type II',
            status: 'completed',
            generatedAt: '2024-01-15T09:00:00Z',
            reportPeriod: 'Q4 2023'
          }
        ]);

        setIntegrations([
          {
            id: '1',
            name: 'Salesforce',
            type: 'CRM',
            status: 'connected',
            lastSync: '2024-01-15T11:00:00Z'
          }
        ]);

        setAuditLog([
          {
            id: '1',
            action: 'User Permission Updated',
            user: 'admin@company.com',
            timestamp: '2024-01-15T10:45:00Z',
            resource: 'User: john.doe@company.com',
            details: 'Added billing:read permission'
          }
        ]);

        setSystemMetrics([
          {
            name: 'API Response Time',
            value: 142,
            unit: 'ms',
            trend: 'stable',
            status: 'healthy'
          },
          {
            name: 'Database Connections',
            value: 85,
            unit: '%',
            trend: 'up',
            status: 'warning'
          },
          {
            name: 'Storage Usage',
            value: 67,
            unit: '%',
            trend: 'up',
            status: 'healthy'
          }
        ]);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const PermissionGate: React.FC<{ permission: string; children: React.ReactNode }> = ({ 
    permission, 
    children 
  }) => {
    if (!hasPermission(permission)) return null;
    return <>{children}</>;
  };

  const QuickActions: React.FC = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common administrative tasks</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <PermissionGate permission="user:create">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </PermissionGate>
        <PermissionGate permission="report:generate">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Generate Report
          </Button>
        </PermissionGate>
        <PermissionGate permission="system:monitor">
          <Button variant="outline" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            View Alerts
          </Button>
        </PermissionGate>
        <PermissionGate permission="backup:create">
          <Button variant="outline" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup System
          </Button>
        </PermissionGate>
      </CardContent>
    </Card>
  );

  const OverviewCards: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,247</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+12%</span> from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${billingMetrics.monthlyRevenue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600">+8%</span> from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">342</div>
          <p className="text-xs text-muted-foreground">
            <span className="text-orange-600">+2%</span> from last hour
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Healthy
          </div>
          <p className="text-xs text-muted-foreground">All systems operational</p>
        </CardContent>
      </Card>
    </div>
  );

  const UserManagementPanel: React.FC = () => {
    const userColumns = [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: any) => (
          <div>
            <div className="font-medium">{row.getValue('name')}</div>
            <div className="text-sm text-muted-foreground">{row.original.email}</div>
          </div>
        )
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }: any) => (
          <Badge variant="secondary">{row.getValue('role')}</Badge>
        )
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: any) => {
          const status = row.getValue('status');
          return (
            <Badge 
              variant={status === 'active' ? 'default' : status === 'suspended' ? 'destructive' : 'secondary'}
            >
              {status}
            </Badge>
          );
        }
      },
      {
        accessorKey: 'department',
        header: 'Department'
      },
      {
        accessorKey: 'lastLogin',
        header: 'Last Login',
        cell: ({ row }: any) => {
          const date = new Date(row.getValue('lastLogin'));
          return date.toLocaleString();
        }
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: any) => (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    ];

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage enterprise users and their permissions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={userColumns} data={users} />
        </CardContent>
      </Card>
    );
  };

  const BillingOverview: React.FC = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{billingMetrics.activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Usage Overage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${billingMetrics.usageOverage.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {billingMetrics.pendingInvoices}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">96.8%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest billing activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="flex justify-between items-center border-b pb-3">
                <div>
                  <div className="font-medium">Enterprise Plan - Acme Corp</div>
                  <div className="text-sm text-muted-foreground">Invoice #INV-2024-001</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">$2,499.00</div>
                  <Badge variant="default" className="text-xs">Paid</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const ComplianceReports: React.FC = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Compliance Reports</CardTitle>
            <CardDescription>Generate and manage compliance documentation</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {complianceReports.map((report) => (
            <div key={report.id} className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <div className="font-medium">{report.type}</div>
                <div className="text-sm text-muted-foreground">
                  Period: {report.reportPeriod} • Generated: {new Date(report.generatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                  {report.status}
                </Badge>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const IntegrationSettings: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle>System Integrations</CardTitle>
        <CardDescription>Manage third-party integrations and APIs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="flex justify-between items-center p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  integration.status === 'connected' ? 'bg-green-500' :
                  integration.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <div>
                  <div className="font-medium">{integration.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {integration.type} • Last sync: {new Date(integration.lastSync).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={integration.status === 'connected' ? 'default' : 'destructive'}>
                  {integration.status}
                </Badge>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const AuditLogPanel: React.FC = () => (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>System activity and security events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {auditLog.map((entry) => (
            <div key={entry.id} className="flex gap-3 p-3 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{entry.action}</div>
                <div className="text-sm text-muted-foreground">
                  {entry.user} • {entry.resource}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const SystemMetricsPanel: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {systemMetrics.map((metric) => (
        <Card key={metric.name}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              <div className={`w-3 h-3 rounded-full ${
                metric.status === 'healthy' ? 'bg-green-500' :
                metric.status === 'warning' ? 'bg-orange-500' : 'bg-red-500'
              }`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {metric.value}{metric.unit}
              </div>
              {metric.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
              {metric.trend === 'down' && <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Enterprise Admin Control Panel</h1>
          <p className="text-muted-foreground">Comprehensive management interface</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {userRole}
        </Badge>
      </div>

      <QuickActions />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">