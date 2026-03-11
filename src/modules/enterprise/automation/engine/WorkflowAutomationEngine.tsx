import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Database, 
  Play, 
  Pause, 
  Stop, 
  Settings, 
  Users, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  Filter,
  Search,
  Activity,
  Bell,
  GitBranch,
  Zap,
  FileText,
  Link,
  User,
  Calendar,
  ArrowRight,
  RotateCcw,
  Target
} from 'lucide-react';

/**
 * Workflow node types for visual designer
 */
export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  ACTION = 'action',
  CONDITION = 'condition',
  APPROVAL = 'approval',
  DELAY = 'delay',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  USER_TASK = 'user_task',
  PARALLEL = 'parallel',
  MERGE = 'merge'
}

/**
 * Workflow execution status
 */
export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task status for human tasks
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  ESCALATED = 'escalated'
}

/**
 * Approval status
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated'
}

/**
 * Integration system types
 */
export enum IntegrationType {
  CRM = 'crm',
  ERP = 'erp',
  HRIS = 'hris',
  EMAIL = 'email',
  SMS = 'sms',
  DOCUMENT = 'document',
  DATABASE = 'database',
  API = 'api',
  WEBHOOK = 'webhook'
}

/**
 * Workflow node interface
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
  metadata?: Record<string, any>;
}

/**
 * Workflow connection interface
 */
export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string;
  targetHandle: string;
  condition?: string;
  label?: string;
}

/**
 * Workflow definition interface
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: WorkflowTrigger[];
  variables: Record<string, any>;
  settings: WorkflowSettings;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Workflow trigger interface
 */
export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'webhook' | 'file';
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Workflow settings interface
 */
export interface WorkflowSettings {
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffType: 'linear' | 'exponential';
    initialDelay: number;
  };
  errorHandling?: 'stop' | 'continue' | 'rollback';
  notifications?: {
    onStart?: boolean;
    onComplete?: boolean;
    onError?: boolean;
    recipients?: string[];
  };
}

/**
 * Workflow execution instance
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  version: string;
  status: WorkflowStatus;
  startedAt: string;
  completedAt?: string;
  context: Record<string, any>;
  currentNodeId?: string;
  executedNodes: ExecutedNode[];
  error?: string;
  triggeredBy: string;
  metadata?: Record<string, any>;
}

/**
 * Executed node information
 */
export interface ExecutedNode {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount?: number;
}

/**
 * Approval chain definition
 */
export interface ApprovalChain {
  id: string;
  workflowId: string;
  nodeId: string;
  stages: ApprovalStage[];
  escalationRules?: EscalationRule[];
  settings: ApprovalSettings;
}

/**
 * Approval stage
 */
export interface ApprovalStage {
  id: string;
  name: string;
  approvers: string[];
  requiredApprovals: number;
  timeoutMinutes?: number;
  order: number;
}

/**
 * Escalation rule
 */
export interface EscalationRule {
  id: string;
  stageId: string;
  timeoutMinutes: number;
  escalateTo: string[];
  action: 'escalate' | 'auto_approve' | 'auto_reject';
}

/**
 * Approval settings
 */
export interface ApprovalSettings {
  allowDelegation: boolean;
  requireComments: boolean;
  notifyOnEscalation: boolean;
  parallelApproval: boolean;
}

/**
 * User task interface
 */
export interface UserTask {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  title: string;
  description?: string;
  assignedTo: string;
  status: TaskStatus;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  form?: TaskForm;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  result?: Record<string, any>;
}

/**
 * Task form definition
 */
export interface TaskForm {
  fields: TaskFormField[];
  validation?: Record<string, any>;
}

/**
 * Task form field
 */
export interface TaskFormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'date' | 'file';
  label: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
}

/**
 * Integration connector interface
 */
export interface IntegrationConnector {
  id: string;
  name: string;
  type: IntegrationType;
  config: Record<string, any>;
  enabled: boolean;
  lastSync?: string;
  status: 'active' | 'inactive' | 'error';
}

/**
 * Workflow template interface
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: WorkflowDefinition;
  tags: string[];
  popularity: number;
  createdAt: string;
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id: string;
  workflowExecutionId: string;
  nodeId?: string;
  action: string;
  details: Record<string, any>;
  userId: string;
  timestamp: string;
  ipAddress?: string;
}

/**
 * Props for WorkflowAutomationEngine component
 */
export interface WorkflowAutomationEngineProps {
  className?: string;
  userId: string;
  permissions: string[];
  onWorkflowExecute?: (execution: WorkflowExecution) => void;
  onTaskAssign?: (task: UserTask) => void;
  onApprovalRequest?: (approval: ApprovalChain) => void;
}

/**
 * Workflow Designer Component - Visual drag-drop workflow builder
 */
const WorkflowDesigner: React.FC<{
  workflow?: WorkflowDefinition;
  onSave: (workflow: WorkflowDefinition) => void;
  onCancel: () => void;
}> = ({ workflow, onSave, onCancel }) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow?.nodes || []);
  const [connections, setConnections] = useState<WorkflowConnection[]>(workflow?.connections || []);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => [
    { type: WorkflowNodeType.START, label: 'Start', icon: Play },
    { type: WorkflowNodeType.ACTION, label: 'Action', icon: Zap },
    { type: WorkflowNodeType.CONDITION, label: 'Condition', icon: GitBranch },
    { type: WorkflowNodeType.APPROVAL, label: 'Approval', icon: CheckCircle },
    { type: WorkflowNodeType.USER_TASK, label: 'User Task', icon: User },
    { type: WorkflowNodeType.DELAY, label: 'Delay', icon: Clock },
    { type: WorkflowNodeType.NOTIFICATION, label: 'Notification', icon: Bell },
    { type: WorkflowNodeType.INTEGRATION, label: 'Integration', icon: Link },
    { type: WorkflowNodeType.END, label: 'End', icon: Stop }
  ], []);

  const handleNodeAdd = useCallback((nodeType: WorkflowNodeType) => {
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: nodeType,
      name: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
      position: { x: 200, y: 200 },
      config: {},
      inputs: nodeType === WorkflowNodeType.START ? [] : ['input'],
      outputs: nodeType === WorkflowNodeType.END ? [] : ['output']
    };

    setNodes(prev => [...prev, newNode]);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(conn => 
      conn.sourceNodeId !== nodeId && conn.targetNodeId !== nodeId
    ));
  }, []);

  const handleSave = useCallback(() => {
    const workflowDefinition: WorkflowDefinition = {
      id: workflow?.id || `workflow_${Date.now()}`,
      name: workflow?.name || 'New Workflow',
      description: workflow?.description || '',
      version: '1.0',
      status: WorkflowStatus.DRAFT,
      nodes,
      connections,
      triggers: workflow?.triggers || [],
      variables: workflow?.variables || {},
      settings: workflow?.settings || {},
      createdAt: workflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: workflow?.createdBy || 'current_user'
    };

    onSave(workflowDefinition);
  }, [nodes, connections, workflow, onSave]);

  return (
    <div className="h-full flex">
      {/* Node Palette */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Node Types</h3>
        <div className="space-y-2">
          {nodeTypes.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleNodeAdd(type)}
              className="w-full flex items-center gap-2 p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <Icon className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-gray-50" ref={canvasRef}>
        <div className="absolute inset-0 overflow-auto">
          {/* Grid Pattern */}
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const NodeIcon = nodeTypes.find(nt => nt.type === node.type)?.icon || Zap;
            return (
              <div
                key={node.id}
                className={`absolute bg-white border-2 rounded-lg p-3 shadow-sm cursor-pointer transition-all ${
                  selectedNode?.id === node.id 
                    ? 'border-blue-500 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  minWidth: '120px'
                }}
                onClick={() => setSelectedNode(node)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <NodeIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">{node.name}</span>
                </div>
                {node.description && (
                  <p className="text-xs text-gray-500">{node.description}</p>
                )}
                
                {/* Connection handles */}
                {node.inputs.length > 0 && (
                  <div className="absolute -left-2 top-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white transform -translate-y-1/2" />
                )}
                {node.outputs.length > 0 && (
                  <div className="absolute -right-2 top-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white transform -translate-y-1/2" />
                )}
              </div>
            );
          })}

          {/* Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {connections.map(connection => {
              const sourceNode = nodes.find(n => n.id === connection.sourceNodeId);
              const targetNode = nodes.find(n => n.id === connection.targetNodeId);
              
              if (!sourceNode || !targetNode) return null;

              const sourceX = sourceNode.position.x + 120;
              const sourceY = sourceNode.position.y + 30;
              const targetX = targetNode.position.x;
              const targetY = targetNode.position.y + 30;

              return (
                <g key={connection.id}>
                  <path
                    d={`M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY} ${targetX - 50} ${targetY} ${targetX} ${targetY}`}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                  {connection.label && (
                    <text
                      x={(sourceX + targetX) / 2}
                      y={(sourceY + targetY) / 2 - 5}
                      textAnchor="middle"
                      className="text-xs fill-gray-600"
                    >
                      {connection.label}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Toolbar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="w-80 bg-white border-l border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Node Properties</h3>
            <button
              onClick={() => handleNodeDelete(selectedNode.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={selectedNode.name}
                onChange={(e) => handleNodeUpdate(selectedNode.id, { name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={selectedNode.description || ''}
                onChange={(e) => handleNodeUpdate(selectedNode.id, { description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20 resize-none"
              />
            </div>

            {/* Node-specific configuration */}
            {selectedNode.type === WorkflowNodeType.CONDITION && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <textarea
                  value={selectedNode.config.condition || ''}
                  onChange={(e) => handleNodeUpdate(selectedNode.id, {
                    config: { ...selectedNode.config, condition: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-16 resize-none"
                  placeholder="e.g., amount > 1000"
                />
              </div>
            )}

            {selectedNode.type === WorkflowNodeType.DELAY && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay (minutes)
                </label>
                <input
                  type="number"
                  value={selectedNode.config.delayMinutes || 0}
                  onChange={(e) => handleNodeUpdate(selectedNode.id, {
                    config: { ...selectedNode.config, delayMinutes: parseInt(e.target.value) }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Workflow Engine - Core execution engine with state management
 */
const WorkflowEngine: React.FC<{
  workflows: WorkflowDefinition[];
  executions: WorkflowExecution[];
  onExecute: (workflowId: string, context?: Record<string, any>) => void;
  onStop: (executionId: string) => void;
  onPause: (executionId: string) => void;
  onResume: (executionId: string) => void;
}> = ({ workflows, executions, onExecute, onStop, onPause, onResume }) => {
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredExecutions = useMemo(() => {
    return executions.filter(execution => {
      if (filter === 'all') return true;
      return execution.status === filter;
    });
  }, [executions, filter]);

  const getStatusIcon = (status: WorkflowStatus) => {
    switch (status) {
      case WorkflowStatus.ACTIVE:
        return <Play className="w-4 h-4 text-green-600" />;
      case WorkflowStatus.PAUSED:
        return <Pause className="w-4 h-4 text-yellow-600" />;
      case WorkflowStatus.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case WorkflowStatus.FAILED:
        return <XCircle className="w-4 h-4 text-red-600" />;
      case WorkflowStatus.