```tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Square, 
  Settings, 
  Monitor, 
  BarChart3, 
  History, 
  Download, 
  Share, 
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Database,
  Cpu,
  MemoryStick,
  Trash2,
  Copy,
  Eye,
  Code
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  parameters: AgentParameter[];
  inputTypes: string[];
  outputTypes: string[];
  maxExecutionTime: number;
  resourceLimits: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

interface AgentParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

interface ExecutionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

interface ExecutionResult {
  id: string;
  agentId: string;
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, any>;
  output?: any;
  metrics: {
    executionTime: number;
    cpuUsage: number[];
    memoryUsage: number[];
    resourceCost: number;
  };
  logs: ExecutionLog[];
  error?: string;
}

interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  throughput: number;
}

// Zustand Store
interface SandboxStore {
  currentAgent: Agent | null;
  parameters: Record<string, any>;
  executions: ExecutionResult[];
  currentExecution: ExecutionResult | null;
  isExecuting: boolean;
  setAgent: (agent: Agent) => void;
  setParameters: (params: Record<string, any>) => void;
  addExecution: (execution: ExecutionResult) => void;
  setCurrentExecution: (execution: ExecutionResult | null) => void;
  setExecuting: (executing: boolean) => void;
  clearHistory: () => void;
}

const useSandboxStore = create<SandboxStore>()(
  persist(
    (set) => ({
      currentAgent: null,
      parameters: {},
      executions: [],
      currentExecution: null,
      isExecuting: false,
      setAgent: (agent) => set({ currentAgent: agent, parameters: {} }),
      setParameters: (params) => set({ parameters: params }),
      addExecution: (execution) => set((state) => ({ 
        executions: [execution, ...state.executions.slice(0, 49)] 
      })),
      setCurrentExecution: (execution) => set({ currentExecution: execution }),
      setExecuting: (executing) => set({ isExecuting: executing }),
      clearHistory: () => set({ executions: [] })
    }),
    {
      name: 'agent-sandbox-storage'
    }
  )
);

// Main Component Props
interface AgentPreviewSandboxProps {
  agent: Agent;
  onPurchase?: () => void;
  onClose?: () => void;
  className?: string;
}

// Sandbox Controls Component
const SandboxControls: React.FC<{
  agent: Agent;
  parameters: Record<string, any>;
  onParametersChange: (params: Record<string, any>) => void;
  onExecute: () => void;
  onStop: () => void;
  isExecuting: boolean;
}> = ({ agent, parameters, onParametersChange, onExecute, onStop, isExecuting }) => {
  const handleParameterChange = (name: string, value: any) => {
    onParametersChange({
      ...parameters,
      [name]: value
    });
  };

  const renderParameterInput = (param: AgentParameter) => {
    const value = parameters[param.name] ?? param.defaultValue;

    switch (param.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={param.name}
              checked={value || false}
              onChange={(e) => handleParameterChange(param.name, e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor={param.name}>{param.name}</Label>
          </div>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
            min={param.validation?.min}
            max={param.validation?.max}
            placeholder={`Enter ${param.name}`}
          />
        );
      case 'array':
      case 'object':
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleParameterChange(param.name, parsed);
              } catch {
                handleParameterChange(param.name, e.target.value);
              }
            }}
            placeholder={`Enter ${param.type} as JSON`}
            rows={3}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={`Enter ${param.name}`}
            pattern={param.validation?.pattern}
          />
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Agent Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {agent.parameters.map((param) => (
            <div key={param.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={param.name} className="text-sm font-medium">
                  {param.name}
                  {param.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {param.type}
                </Badge>
              </div>
              {renderParameterInput(param)}
              <p className="text-xs text-gray-500">{param.description}</p>
            </div>
          ))}
        </div>
        
        <Separator />
        
        <div className="flex gap-2">
          <Button
            onClick={onExecute}
            disabled={isExecuting}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            {isExecuting ? 'Executing...' : 'Run Agent'}
          </Button>
          {isExecuting && (
            <Button onClick={onStop} variant="outline">
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Execution Monitor Component
const ExecutionMonitor: React.FC<{
  execution: ExecutionResult | null;
  isExecuting: boolean;
}> = ({ execution, isExecuting }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [execution?.logs]);

  const getStatusIcon = (status: ExecutionResult['status']) => {
    switch (status) {
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Monitor className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogIcon = (level: ExecutionLog['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'warn':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-3 w-3 text-blue-500" />;
      default:
        return <Code className="h-3 w-3 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Execution Monitor
          {execution && (
            <Badge variant={execution.status === 'completed' ? 'default' : 'secondary'}>
              {getStatusIcon(execution.status)}
              {execution.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80" ref={scrollRef}>
          <div className="space-y-2">
            {execution?.logs?.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {getLogIcon(log.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {log.level}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono break-words">{log.message}</p>
                  {log.metadata && (
                    <pre className="text-xs text-gray-600 mt-1 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            {(!execution?.logs || execution.logs.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                {isExecuting ? 'Waiting for execution logs...' : 'No execution logs yet'}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Output Visualizer Component
const OutputVisualizer: React.FC<{
  execution: ExecutionResult | null;
}> = ({ execution }) => {
  const renderOutput = () => {
    if (!execution?.output) {
      return (
        <div className="text-center text-gray-500 py-8">
          No output available
        </div>
      );
    }

    if (typeof execution.output === 'string') {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
          {execution.output}
        </pre>
      );
    }

    return (
      <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded overflow-auto">
        {JSON.stringify(execution.output, null, 2)}
      </pre>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Output
          </div>
          {execution?.output && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(
                  typeof execution.output === 'string' 
                    ? execution.output 
                    : JSON.stringify(execution.output, null, 2)
                )}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {renderOutput()}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Metrics Panel Component
const MetricsPanel: React.FC<{
  execution: ExecutionResult | null;
}> = ({ execution }) => {
  const metricsData: MetricPoint[] = execution?.metrics ? 
    execution.metrics.cpuUsage.map((cpu, index) => ({
      timestamp: `${index}s`,
      cpu,
      memory: execution.metrics.memoryUsage[index] || 0,
      throughput: Math.random() * 100 // Mock throughput data
    })) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {execution?.metrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <Clock className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-sm text-gray-600">Execution Time</p>
                <p className="font-bold">{execution.metrics.executionTime}ms</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <Cpu className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-gray-600">Avg CPU</p>
                <p className="font-bold">
                  {Math.round(execution.metrics.cpuUsage.reduce((a, b) => a + b, 0) / execution.metrics.cpuUsage.length)}%
                </p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <MemoryStick className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
                <p className="text-sm text-gray-600">Peak Memory</p>
                <p className="font-bold">{Math.max(...execution.metrics.memoryUsage)}MB</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <Zap className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                <p className="text-sm text-gray-600">Cost</p>
                <p className="font-bold">${execution.metrics.resourceCost.toFixed(4)}</p>
              </div>
            </div>

            {metricsData.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">CPU Usage Over Time</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={metricsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Memory Usage Over Time</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={metricsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
        
        {!execution && (
          <div className="text-center text-gray-500 py-8">
            Run an execution to see performance metrics
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Results History Component
const ResultsHistory: React.FC<{
  executions: ExecutionResult[];
  onSelectExecution: (execution: ExecutionResult) => void;
  onClearHistory: () => void;
  currentExecution: ExecutionResult | null;
}> = ({ executions, onSelectExecution, onClearHistory, currentExecution }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Execution History
          </div>
          {executions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClearHistory}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {executions.map((execution) => (
              <div
                key={execution.id}
                onClick={() => onSelectExecution(execution)}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  currentExecution?.id === execution.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge 
                    variant={execution.status === 'completed' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {execution.status}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(execution.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {Object.entries(execution.input).map(([key, value]) => 
                    `${key}: ${String(value).slice(0, 30)}...`
                  ).join(', ')}
                </p>
                {execution.metrics && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{execution.metrics.executionTime}ms</span>
                    <span>${execution.metrics.resourceCost.toFixed(4)}</span>
                  </div>
                )}
              </div>
            ))}
            {executions.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No execution history yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Sandbox Toolbar Component
const SandboxToolbar: React.FC<{
  agent: Agent;
  onPurchase?: () => void;
  onClose?: () => void;
  onShare: () => void;
  onExport: () => void;
}> = ({ agent, onPurchase, onClose, onShare, onExport }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">{agent.name}</h2>
          <p className="text-sm text-gray-500">v{agent.version} • {agent.category}</p>
        </div>
        <Badge variant="outline">{agent.category}</Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        {onPurchase && (
          <Button onClick={onPurchase}>
            Purchase Agent
          </Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );