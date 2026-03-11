```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { 
  Shield, 
  Users, 
  Activity, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  Download,
  Bell,
  Lock,
  Eye,
  BarChart3,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DateRange } from 'react-day-picker';
import { addDays } from 'date-fns';

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'red' | 'yellow';
}

interface UsageData {
  date: string;
  apiCalls: number;
  activeUsers: number;
  storageUsed: number;
  processingTime: number;
}

interface ComplianceItem {
  framework: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  score: number;
  lastAudit: string;
  requirements: {
    total: number;
    met: number;
  };
}

interface SecurityMetric {
  category: string;
  score: number;
  status: 'good' | 'warning' | 'critical';
  incidents: number;
  trend: 'up' | 'down' | 'stable';
}

interface PolicyViolation {
  id: string;
  type: 'data_access' | 'retention' | 'usage_limit' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  user: string;
  timestamp: string;
  status: 'open' | 'investigating' | 'resolved';
}

interface AuditEvent {
  id: string;
  action: string;
  user: string;
  resource: string;
  timestamp: string;
  outcome: 'success' | 'failure';
  details: string;
}

interface GovernanceAlert {
  id: string;
  type: 'policy_violation' | 'compliance_issue' | 'security_incident' | 'usage_threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

export default function EnterpriseGovernanceDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - replace with actual API calls
  const [metricsData, setMetricsData] = useState<MetricCard[]>([
    {
      title: 'Total Users',
      value: '12,456',
      change: 8.2,
      changeLabel: '+8.2% from last month',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'API Calls',
      value: '2.4M',
      change: 15.3,
      changeLabel: '+15.3% from last month',
      icon: Activity,
      color: 'green'
    },
    {
      title: 'Compliance Score',
      value: '94%',
      change: 2.1,
      changeLabel: '+2.1% from last month',
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: 'Security Incidents',
      value: 3,
      change: -25.0,
      changeLabel: '-25% from last month',
      icon: Shield,
      color: 'red'
    }
  ]);

  const [usageData] = useState<UsageData[]>([
    { date: '2024-01-01', apiCalls: 45000, activeUsers: 1200, storageUsed: 85, processingTime: 245 },
    { date: '2024-01-02', apiCalls: 52000, activeUsers: 1350, storageUsed: 87, processingTime: 231 },
    { date: '2024-01-03', apiCalls: 48000, activeUsers: 1180, storageUsed: 89, processingTime: 267 },
    { date: '2024-01-04', apiCalls: 61000, activeUsers: 1420, storageUsed: 91, processingTime: 198 },
    { date: '2024-01-05', apiCalls: 58000, activeUsers: 1380, storageUsed: 93, processingTime: 223 }
  ]);

  const [complianceData] = useState<ComplianceItem[]>([
    {
      framework: 'SOC 2 Type II',
      status: 'compliant',
      score: 98,
      lastAudit: '2024-01-15',
      requirements: { total: 64, met: 63 }
    },
    {
      framework: 'GDPR',
      status: 'compliant',
      score: 96,
      lastAudit: '2024-01-10',
      requirements: { total: 32, met: 31 }
    },
    {
      framework: 'HIPAA',
      status: 'partial',
      score: 87,
      lastAudit: '2024-01-08',
      requirements: { total: 45, met: 39 }
    },
    {
      framework: 'ISO 27001',
      status: 'compliant',
      score: 94,
      lastAudit: '2024-01-12',
      requirements: { total: 114, met: 107 }
    }
  ]);

  const [securityMetrics] = useState<SecurityMetric[]>([
    {
      category: 'Access Control',
      score: 92,
      status: 'good',
      incidents: 0,
      trend: 'stable'
    },
    {
      category: 'Data Encryption',
      score: 98,
      status: 'good',
      incidents: 0,
      trend: 'up'
    },
    {
      category: 'Network Security',
      score: 89,
      status: 'warning',
      incidents: 2,
      trend: 'down'
    },
    {
      category: 'Vulnerability Management',
      score: 94,
      status: 'good',
      incidents: 1,
      trend: 'up'
    }
  ]);

  const [policyViolations] = useState<PolicyViolation[]>([
    {
      id: 'PV-001',
      type: 'usage_limit',
      severity: 'medium',
      description: 'API rate limit exceeded',
      user: 'john.doe@company.com',
      timestamp: '2024-01-20T14:30:00Z',
      status: 'investigating'
    },
    {
      id: 'PV-002',
      type: 'data_access',
      severity: 'high',
      description: 'Unauthorized access to sensitive data',
      user: 'jane.smith@company.com',
      timestamp: '2024-01-20T12:15:00Z',
      status: 'resolved'
    },
    {
      id: 'PV-003',
      type: 'security',
      severity: 'critical',
      description: 'Failed authentication attempts',
      user: 'unknown@external.com',
      timestamp: '2024-01-20T10:45:00Z',
      status: 'open'
    }
  ]);

  const [auditEvents] = useState<AuditEvent[]>([
    {
      id: 'AE-001',
      action: 'User Login',
      user: 'admin@company.com',
      resource: 'Enterprise Dashboard',
      timestamp: '2024-01-20T15:30:00Z',
      outcome: 'success',
      details: 'Successful authentication from IP 192.168.1.100'
    },
    {
      id: 'AE-002',
      action: 'Policy Update',
      user: 'security@company.com',
      resource: 'Data Retention Policy',
      timestamp: '2024-01-20T14:45:00Z',
      outcome: 'success',
      details: 'Updated retention period to 7 years'
    },
    {
      id: 'AE-003',
      action: 'Data Export',
      user: 'analyst@company.com',
      resource: 'Usage Analytics',
      timestamp: '2024-01-20T13:20:00Z',
      outcome: 'success',
      details: 'Exported 30-day usage report'
    }
  ]);

  const [governanceAlerts] = useState<GovernanceAlert[]>([
    {
      id: 'GA-001',
      type: 'usage_threshold',
      severity: 'medium',
      title: 'Storage Usage Warning',
      description: 'Storage usage has reached 85% of allocated capacity',
      timestamp: '2024-01-20T16:00:00Z',
      acknowledged: false
    },
    {
      id: 'GA-002',
      type: 'compliance_issue',
      severity: 'high',
      title: 'HIPAA Compliance Gap',
      description: 'Missing encryption for data at rest in backup systems',
      timestamp: '2024-01-20T14:30:00Z',
      acknowledged: true
    },
    {
      id: 'GA-003',
      type: 'security_incident',
      severity: 'critical',
      title: 'Suspicious Login Activity',
      description: 'Multiple failed login attempts detected from unusual location',
      timestamp: '2024-01-20T13:15:00Z',
      acknowledged: false
    }
  ]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // Simulate API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        // In a real implementation, make API calls here
        // const [metrics, usage, compliance, security] = await Promise.all([
        //   fetch('/api/enterprise/analytics/metrics').then(r => r.json()),
        //   fetch('/api/enterprise/analytics/usage').then(r => r.json()),
        //   fetch('/api/enterprise/compliance').then(r => r.json()),
        //   fetch('/api/enterprise/security').then(r => r.json())
        // ]);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [dateRange, selectedTimeframe]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Refresh data
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = (type: string) => {
    // Implementation for exporting data
    console.log(`Exporting ${type} data...`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'good':
      case 'success':
        return 'text-green-600';
      case 'partial':
      case 'warning':
        return 'text-yellow-600';
      case 'non-compliant':
      case 'critical':
      case 'failure':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6" role="main">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Governance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor compliance, security, and policy enforcement across your organization
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Button onClick={handleRefresh} disabled={refreshing} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport('dashboard')} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Alerts Panel */}
      {governanceAlerts.filter(alert => !alert.acknowledged).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Active Alerts ({governanceAlerts.filter(alert => !alert.acknowledged).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {governanceAlerts
              .filter(alert => !alert.acknowledged)
              .slice(0, 3)
              .map((alert) => (
                <Alert key={alert.id} className={alert.severity === 'critical' ? 'border-red-200' : ''}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    {alert.title}
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricsData.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 text-${metric.color}-600`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className={`text-xs ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.changeLabel}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>API calls and active users over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="apiCalls" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="activeUsers" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>Compliance status by framework</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {complianceData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          item.status === 'compliant' ? 'bg-green-500' :
                          item.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium">{item.framework}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{item.score}%</div>
                        <div className="text-xs text-muted-foreground">
                          {item.requirements.met}/{item.requirements.total} requirements
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
                <CardDescription>Security posture by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {securityMetrics.map((metric, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{metric.category}</span>
                        <span className="text-sm font-bold">{metric.score}%</span>
                      </div>
                      <Progress value={metric.score} className="h-2" />
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span className={getStatusColor(metric.status)}>
                          {metric.status.toUpperCase()}
                        </span>
                        <span>{metric.incidents} incidents</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Policy Violations</CardTitle>
                <CardDescription>Latest policy enforcement actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {policyViolations.slice(0, 4).map((violation) => (
                    <div key={violation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(violation.severity)}>
                            {violation.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{violation.id}</span>
                        </div>
                        <p className="text-sm font-medium">{violation.description}</p>
                        <p className="text-xs text-muted-foreground">{violation.user}</p>
                      </div>
                      <Badge variant="outline" className={
                        violation.status === 'resolved' ? 'text-green-600' :
                        violation.status === 'investigating' ? 'text-yellow-600' : 'text-red-600'
                      }>
                        {violation.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4">
            <Card>