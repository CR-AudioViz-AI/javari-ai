```tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Database,
  Cloud,
  Webhook,
  BarChart3,
  Zap,
  Filter,
  ArrowRight,
  Plus,
  Settings,
  Play,
  Save,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  GitBranch,
  Clock,
  Users,
  Lock,
  Trash2,
  Copy,
  MoreVertical,
  Code,
  MapPin,
  RefreshCw,
  Target,
  Link,
  Activity,
} from 'lucide-react';

// Types
interface IntegrationNode {
  id: string;
  type: 'source' | 'transform' | 'destination';
  category: string;
  name: string;
  description: string;
  icon: React.ElementType;
  config: Record<string, any>;
  position: { x: number; y: number };
  connections: string[];
  status: 'idle' | 'running' | 'error' | 'success';
  lastRun?: Date;
  errorMessage?: string;
}

interface DataMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string;
  required: boolean;
  dataType: string;
}

interface IntegrationTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: IntegrationNode[];
  mappings: DataMapping[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  deployments: number;
  organization: string;
}

interface ExecutionLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  nodeId?: string;
  duration?: number;
  recordsProcessed?: number;
}

interface ValidationError {
  id: string;
  nodeId: string;
  type: 'connection' | 'configuration' | 'mapping';
  message: string;
  severity: 'error' | 'warning';
}

interface VisualIntegrationBuilderProps {
  organizationId: string;
  userId: string;
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDeploy: boolean;
    canDelete: boolean;
  };
  onSave?: (template: IntegrationTemplate) => void;
  onDeploy?: (templateId: string) => void;
  onTestRun?: (template: IntegrationTemplate) => void;
  className?: string;
}

const CONNECTOR_CATEGORIES = {
  sources: {
    label: 'Data Sources',
    icon: Database,
    color: 'bg-blue-500',
  },
  transforms: {
    label: 'Transformations',
    icon: Zap,
    color: 'bg-purple-500',
  },
  destinations: {
    label: 'Destinations',
    icon: Target,
    color: 'bg-green-500',
  },
};

const DEFAULT_CONNECTORS: Omit<IntegrationNode, 'id' | 'position' | 'connections' | 'status'>[] = [
  // Sources
  {
    type: 'source',
    category: 'sources',
    name: 'Database Query',
    description: 'Execute SQL queries against enterprise databases',
    icon: Database,
    config: { query: '', connection: '', schedule: 'manual' },
  },
  {
    type: 'source',
    category: 'sources',
    name: 'REST API',
    description: 'Fetch data from REST endpoints',
    icon: Cloud,
    config: { url: '', method: 'GET', headers: {}, auth: {} },
  },
  {
    type: 'source',
    category: 'sources',
    name: 'Webhook Listener',
    description: 'Receive real-time data via webhooks',
    icon: Webhook,
    config: { endpoint: '', authentication: 'none' },
  },
  
  // Transforms
  {
    type: 'transform',
    category: 'transforms',
    name: 'Data Filter',
    description: 'Filter records based on conditions',
    icon: Filter,
    config: { conditions: [], operator: 'AND' },
  },
  {
    type: 'transform',
    category: 'transforms',
    name: 'Field Mapper',
    description: 'Transform and map data fields',
    icon: MapPin,
    config: { mappings: [], defaultValues: {} },
  },
  {
    type: 'transform',
    category: 'transforms',
    name: 'Aggregator',
    description: 'Group and aggregate data',
    icon: BarChart3,
    config: { groupBy: [], aggregations: [] },
  },

  // Destinations
  {
    type: 'destination',
    category: 'destinations',
    name: 'Database Insert',
    description: 'Insert data into database tables',
    icon: Database,
    config: { table: '', connection: '', operation: 'insert' },
  },
  {
    type: 'destination',
    category: 'destinations',
    name: 'API Endpoint',
    description: 'Send data to external APIs',
    icon: Cloud,
    config: { url: '', method: 'POST', headers: {} },
  },
];

export function VisualIntegrationBuilder({
  organizationId,
  userId,
  permissions,
  onSave,
  onDeploy,
  onTestRun,
  className,
}: VisualIntegrationBuilderProps) {
  // State management
  const [template, setTemplate] = useState<IntegrationTemplate>({
    id: `template_${Date.now()}`,
    name: 'Untitled Integration',
    description: '',
    version: '1.0.0',
    nodes: [],
    mappings: [],
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    deployments: 0,
    organization: organizationId,
  });

  const [selectedNode, setSelectedNode] = useState<IntegrationNode | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState(DEFAULT_CONNECTORS);
  const [showDataMapping, setShowDataMapping] = useState(false);
  const [testProgress, setTestProgress] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [draggedConnector, setDraggedConnector] = useState<string | null>(null);

  // Load available connectors
  useEffect(() => {
    const loadConnectors = async () => {
      try {
        // Mock API call - replace with actual Supabase query
        // const { data } = await supabase
        //   .from('enterprise_connectors')
        //   .select('*')
        //   .eq('organization_id', organizationId);
        
        setAvailableConnectors(DEFAULT_CONNECTORS);
      } catch (error) {
        console.error('Failed to load connectors:', error);
      }
    };

    loadConnectors();
  }, [organizationId]);

  // Real-time validation
  useEffect(() => {
    const validateIntegration = () => {
      const errors: ValidationError[] = [];

      // Validate node connections
      template.nodes.forEach(node => {
        if (node.type === 'transform' || node.type === 'destination') {
          const hasInput = template.nodes.some(n => n.connections.includes(node.id));
          if (!hasInput) {
            errors.push({
              id: `${node.id}_no_input`,
              nodeId: node.id,
              type: 'connection',
              message: `${node.name} has no input connection`,
              severity: 'error',
            });
          }
        }

        // Validate node configuration
        if (node.type === 'source' && node.category === 'sources') {
          if (node.name === 'Database Query' && !node.config.query) {
            errors.push({
              id: `${node.id}_no_query`,
              nodeId: node.id,
              type: 'configuration',
              message: 'Database query is required',
              severity: 'error',
            });
          }
        }
      });

      setValidationErrors(errors);
    };

    validateIntegration();
  }, [template.nodes]);

  // Drag and drop handlers
  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === 'canvas') {
      // Add new node to canvas
      if (source.droppableId === 'connectors') {
        const connector = availableConnectors.find(c => 
          `${c.category}-${c.name.replace(/\s+/g, '-')}` === draggableId
        );
        
        if (connector) {
          const newNode: IntegrationNode = {
            ...connector,
            id: `node_${Date.now()}`,
            position: { 
              x: Math.random() * 400 + 100, 
              y: Math.random() * 300 + 100 
            },
            connections: [],
            status: 'idle',
          };

          setTemplate(prev => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
            updatedAt: new Date(),
          }));
        }
      }
    }
  }, [availableConnectors]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<IntegrationNode>) => {
    setTemplate(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
      updatedAt: new Date(),
    }));
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setTemplate(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      mappings: prev.mappings.filter(mapping => 
        !mapping.id.includes(nodeId)
      ),
      updatedAt: new Date(),
    }));
    setSelectedNode(null);
  }, []);

  const handleCreateConnection = useCallback((sourceId: string, targetId: string) => {
    setTemplate(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === sourceId
          ? { ...node, connections: [...node.connections, targetId] }
          : node
      ),
      updatedAt: new Date(),
    }));
  }, []);

  const handleTestRun = useCallback(async () => {
    if (!permissions.canEdit || !onTestRun) return;

    setIsRunning(true);
    setTestProgress(0);
    setExecutionLogs([]);

    try {
      // Simulate test run
      const totalSteps = template.nodes.length;
      let currentStep = 0;

      for (const node of template.nodes) {
        currentStep++;
        setTestProgress((currentStep / totalSteps) * 100);

        // Update node status
        handleNodeUpdate(node.id, { status: 'running' });

        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Add execution log
        setExecutionLogs(prev => [...prev, {
          id: `log_${Date.now()}`,
          timestamp: new Date(),
          level: 'info',
          message: `Executed ${node.name}`,
          nodeId: node.id,
          duration: Math.random() * 1000,
          recordsProcessed: Math.floor(Math.random() * 1000),
        }]);

        // Update node status
        handleNodeUpdate(node.id, { 
          status: 'success',
          lastRun: new Date(),
        });
      }

      await onTestRun(template);
    } catch (error) {
      console.error('Test run failed:', error);
      setExecutionLogs(prev => [...prev, {
        id: `log_error_${Date.now()}`,
        timestamp: new Date(),
        level: 'error',
        message: `Test run failed: ${error}`,
      }]);
    } finally {
      setIsRunning(false);
      setTestProgress(100);
    }
  }, [template, permissions.canEdit, onTestRun, handleNodeUpdate]);

  const handleSave = useCallback(async () => {
    if (!permissions.canEdit || !onSave) return;

    try {
      await onSave(template);
      // Show success message
    } catch (error) {
      console.error('Failed to save integration:', error);
      // Show error message
    }
  }, [template, permissions.canEdit, onSave]);

  const handleDeploy = useCallback(async () => {
    if (!permissions.canDeploy || !onDeploy || validationErrors.some(e => e.severity === 'error')) {
      return;
    }

    try {
      await onDeploy(template.id);
      setTemplate(prev => ({
        ...prev,
        status: 'published',
        deployments: prev.deployments + 1,
      }));
    } catch (error) {
      console.error('Failed to deploy integration:', error);
    }
  }, [template, permissions.canDeploy, onDeploy, validationErrors]);

  return (
    <TooltipProvider>
      <div className={`h-screen flex flex-col bg-gray-50 ${className}`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Input
                value={template.name}
                onChange={(e) => setTemplate(prev => ({
                  ...prev,
                  name: e.target.value,
                  updatedAt: new Date(),
                }))}
                className="text-lg font-semibold border-none px-0 focus:ring-0"
                placeholder="Integration Name"
                disabled={!permissions.canEdit}
              />
              <Badge variant={template.status === 'published' ? 'default' : 'secondary'}>
                {template.status}
              </Badge>
              {validationErrors.length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {validationErrors.filter(e => e.severity === 'error').length} errors
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDataMapping(true)}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Data Mapping
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestRun}
                disabled={!permissions.canEdit || isRunning || template.nodes.length === 0}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Test Run
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!permissions.canEdit}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>

              <Button
                size="sm"
                onClick={handleDeploy}
                disabled={
                  !permissions.canDeploy || 
                  validationErrors.some(e => e.severity === 'error') ||
                  template.nodes.length === 0
                }
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Deploy
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Export Template
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Integration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Test Progress */}
          {isRunning && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Running integration test...</span>
                <span>{Math.round(testProgress)}%</span>
              </div>
              <Progress value={testProgress} className="h-2" />
            </div>
          )}
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Connector Library */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Connectors</h3>
              <p className="text-sm text-gray-500 mt-1">
                Drag connectors to the canvas to build your integration
              </p>
            </div>

            <Tabs defaultValue="sources" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="transforms">Transform</TabsTrigger>
                <TabsTrigger value="destinations">Destinations</TabsTrigger>
              </TabsList>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="connectors">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-hidden"
                    >
                      <ScrollArea className="h-full">
                        <div className="p-4 space-y-4">
                          {Object.entries(CONNECTOR_CATEGORIES).map(([key, category]) => (
                            <TabsContent key={key} value={key} className="space-y-2 mt-0">
                              {availableConnectors
                                .filter(connector => connector.category === key)
                                .map((connector, index) => {
                                  const IconComponent = connector.icon;
                                  const dragId = `${connector.category}-${connector.name.replace(/\s+/g, '-')}`;
                                  
                                  return (
                                    <Draggable
                                      key={dragId}
                                      draggableId={dragId}
                                      index={index}
                                      isDragDisabled={!permissions.canEdit}
                                    >
                                      {(provided, snapshot) => (
                                        <Card
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`cursor-grab hover:shadow-md transition-shadow ${
                                            snapshot.isDragging ? 'shadow-lg' : ''
                                          } ${!permissions.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                          <CardContent className="p-3">
                                            <div className="flex items-center space-x-3">
                                              <div className={`p-2 rounded-lg ${category.color} text-white`}>
                                                <IconComponent className="h-4 w-4" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-gray-900 truncate">
                                                  {connector.name}
                                                </p>