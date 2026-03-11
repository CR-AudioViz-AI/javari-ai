```tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Types and interfaces
export interface Integration {
  id: string;
  name: string;
  type: 'sap' | 'salesforce' | 'workday' | 'oracle' | 'custom';
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  lastSync: string;
  endpoint: string;
  health: number;
  errorCount: number;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  integrationId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

export interface ConnectionTest {
  id: string;
  integrationId: string;
  status: 'running' | 'success' | 'failed';
  results: {
    latency?: number;
    authentication?: boolean;
    connectivity?: boolean;
    permissions?: boolean;
    errors?: string[];
  };
  timestamp: string;
}

export interface EnterpriseIntegrationDashboardProps {
  /** Enterprise tenant ID for data isolation */
  tenantId: string;
  /** User permissions for integration management */
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canTest: boolean;
  };
  /** Real-time updates enabled */
  realTimeEnabled?: boolean;
  /** Custom integration types */
  customIntegrationTypes?: Array<{
    value: string;
    label: string;
    icon?: React.ReactNode;
  }>;
  /** Event handlers */
  onIntegrationCreate?: (integration: Partial<Integration>) => Promise<void>;
  onIntegrationUpdate?: (id: string, updates: Partial<Integration>) => Promise<void>;
  onIntegrationDelete?: (id: string) => Promise<void>;
  onConnectionTest?: (id: string) => Promise<ConnectionTest>;
  onConfigurationSave?: (id: string, config: Record<string, any>) => Promise<void>;
  /** Custom styling */
  className?: string;
}

// Form schemas
const integrationConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  endpoint: z.string().url("Must be a valid URL"),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  timeout: z.number().min(1000).max(300000).default(30000),
  retryAttempts: z.number().min(0).max(10).default(3),
  enabled: z.boolean().default(true),
});

type IntegrationConfigFormData = z.infer<typeof integrationConfigSchema>;

export const EnterpriseIntegrationDashboard: React.FC<EnterpriseIntegrationDashboardProps> = ({
  tenantId,
  permissions,
  realTimeEnabled = true,
  customIntegrationTypes = [],
  onIntegrationCreate,
  onIntegrationUpdate,
  onIntegrationDelete,
  onConnectionTest,
  onConfigurationSave,
  className,
}) => {
  // State management
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionTests, setConnectionTests] = useState<ConnectionTest[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [logFilter, setLogFilter] = useState<{
    level: string;
    search: string;
    integrationId: string;
  }>({ level: 'all', search: '', integrationId: 'all' });

  // Form management
  const form = useForm<IntegrationConfigFormData>({
    resolver: zodResolver(integrationConfigSchema),
    defaultValues: {
      enabled: true,
      timeout: 30000,
      retryAttempts: 3,
    },
  });

  // Integration types
  const integrationTypes = [
    { value: 'sap', label: 'SAP', icon: <Database className="h-4 w-4" /> },
    { value: 'salesforce', label: 'Salesforce', icon: <Zap className="h-4 w-4" /> },
    { value: 'workday', label: 'Workday', icon: <Shield className="h-4 w-4" /> },
    { value: 'oracle', label: 'Oracle', icon: <Database className="h-4 w-4" /> },
    { value: 'custom', label: 'Custom', icon: <Settings className="h-4 w-4" /> },
    ...customIntegrationTypes,
  ];

  // Status badge mapping
  const getStatusBadge = (status: Integration['status']) => {
    const statusConfig = {
      connected: { variant: 'default' as const, icon: CheckCircle, text: 'Connected' },
      disconnected: { variant: 'secondary' as const, icon: XCircle, text: 'Disconnected' },
      error: { variant: 'destructive' as const, icon: AlertCircle, text: 'Error' },
      testing: { variant: 'outline' as const, icon: Loader2, text: 'Testing' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
        {config.text}
      </Badge>
    );
  };

  // Health indicator
  const getHealthIndicator = (health: number) => {
    const color = health >= 90 ? 'bg-green-500' : health >= 70 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm text-muted-foreground">{health}%</span>
      </div>
    );
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesLevel = logFilter.level === 'all' || log.level === logFilter.level;
      const matchesSearch = !logFilter.search || 
        log.message.toLowerCase().includes(logFilter.search.toLowerCase());
      const matchesIntegration = logFilter.integrationId === 'all' || 
        log.integrationId === logFilter.integrationId;
      
      return matchesLevel && matchesSearch && matchesIntegration;
    });
  }, [logs, logFilter]);

  // Handle connection test
  const handleConnectionTest = async (integration: Integration) => {
    if (!permissions.canTest || !onConnectionTest) return;

    setTesting(integration.id);
    try {
      const result = await onConnectionTest(integration.id);
      setConnectionTests(prev => [result, ...prev]);
      
      // Update integration status based on test result
      const updatedStatus = result.status === 'success' ? 'connected' : 'error';
      setIntegrations(prev => 
        prev.map(int => 
          int.id === integration.id 
            ? { ...int, status: updatedStatus }
            : int
        )
      );
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTesting(null);
    }
  };

  // Handle integration deletion
  const handleDeleteIntegration = async (integration: Integration) => {
    if (!permissions.canDelete || !onIntegrationDelete) return;
    
    if (confirm(`Are you sure you want to delete "${integration.name}"?`)) {
      try {
        await onIntegrationDelete(integration.id);
        setIntegrations(prev => prev.filter(int => int.id !== integration.id));
        if (selectedIntegration?.id === integration.id) {
          setSelectedIntegration(null);
        }
      } catch (error) {
        console.error('Failed to delete integration:', error);
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (data: IntegrationConfigFormData) => {
    try {
      if (selectedIntegration) {
        // Update existing integration
        if (permissions.canUpdate && onIntegrationUpdate) {
          await onIntegrationUpdate(selectedIntegration.id, data);
          setIntegrations(prev => 
            prev.map(int => 
              int.id === selectedIntegration.id 
                ? { ...int, ...data, updatedAt: new Date().toISOString() }
                : int
            )
          );
        }
      } else {
        // Create new integration
        if (permissions.canCreate && onIntegrationCreate) {
          await onIntegrationCreate(data);
          // Integration will be added to state via real-time updates or refresh
        }
      }
      form.reset();
      setSelectedIntegration(null);
    } catch (error) {
      console.error('Failed to save integration:', error);
    }
  };

  // Mock data for demonstration
  useEffect(() => {
    const mockIntegrations: Integration[] = [
      {
        id: '1',
        name: 'SAP ERP Production',
        type: 'sap',
        status: 'connected',
        lastSync: '2024-01-15T10:30:00Z',
        endpoint: 'https://sap.company.com/api',
        health: 95,
        errorCount: 0,
        configuration: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        name: 'Salesforce CRM',
        type: 'salesforce',
        status: 'error',
        lastSync: '2024-01-15T09:15:00Z',
        endpoint: 'https://company.salesforce.com',
        health: 45,
        errorCount: 12,
        configuration: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T09:15:00Z',
      },
    ];

    const mockLogs: LogEntry[] = [
      {
        id: '1',
        integrationId: '1',
        timestamp: '2024-01-15T10:30:00Z',
        level: 'info',
        message: 'Successfully synced 1,250 records from SAP ERP',
      },
      {
        id: '2',
        integrationId: '2',
        timestamp: '2024-01-15T09:15:00Z',
        level: 'error',
        message: 'Authentication failed for Salesforce API',
      },
    ];

    setTimeout(() => {
      setIntegrations(mockIntegrations);
      setLogs(mockLogs);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Enterprise Integrations</h2>
          <p className="text-muted-foreground">
            Manage and monitor your enterprise system integrations
          </p>
        </div>
        
        {permissions.canCreate && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Integration</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Integration Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., SAP Production" />
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
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {integrationTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    {type.icon}
                                    {type.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="endpoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endpoint URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://api.example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password (Optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field} 
                                type={showPassword['new'] ? 'text' : 'password'}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(prev => ({
                                  ...prev,
                                  new: !prev.new
                                }))}
                              >
                                {showPassword['new'] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="timeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timeout (ms)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              onChange={e => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="retryAttempts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retry Attempts</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              onChange={e => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 pt-6">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Enabled</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => form.reset()}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Integration</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{integrations.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connected</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrations.filter(i => i.status === 'connected').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {integrations.filter(i => i.status === 'error').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(integrations.reduce((acc, i) => acc + i.health,