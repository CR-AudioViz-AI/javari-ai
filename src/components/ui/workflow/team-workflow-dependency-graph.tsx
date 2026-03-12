```tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  EdgeChange,
  NodeChange,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Circle,
  Activity,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Agent {
  id: string;
  name: string;
  type: 'coordinator' | 'worker' | 'validator' | 'aggregator';
  status: 'idle' | 'running' | 'blocked' | 'completed' | 'failed';
  dependencies: string[];
  performance: {
    averageExecutionTime: number;
    successRate: number;
    currentLoad: number;
  };
  metadata: {
    description?: string;
    resources?: string[];
    capabilities?: string[];
  };
}

interface WorkflowExecution {
  id: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  isBottleneck?: boolean;
  throughput?: number;
}

interface DataFlow {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  dataType: string;
  volume: number;
  latency: number;
  isActive: boolean;
  bottleneckSeverity?: 'low' | 'medium' | 'high';
}

interface TeamWorkflowDependencyGraphProps {
  agents: Agent[];
  executions: WorkflowExecution[];
  dataFlows: DataFlow[];
  className?: string;
  onAgentSelect?: (agent: Agent) => void;
  onExecutionPathTrace?: (path: string[]) => void;
  enableRealTimeUpdates?: boolean;
  showPerformanceMetrics?: boolean;
  highlightBottlenecks?: boolean;
}

// Custom Node Component
interface WorkflowNodeProps {
  data: {
    agent: Agent;
    execution?: WorkflowExecution;
    isSelected: boolean;
    onSelect: (agent: Agent) => void;
  };
}

const WorkflowNode: React.FC<WorkflowNodeProps> = ({ data }) => {
  const { agent, execution, isSelected, onSelect } = data;

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'blocked':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <AlertTriangle className="h-3 w-3" />;
      case 'blocked':
        return <Clock className="h-3 w-3" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              'min-w-[120px] cursor-pointer transition-all duration-200 hover:shadow-lg',
              isSelected && 'ring-2 ring-blue-500',
              execution?.isBottleneck && 'ring-2 ring-red-400'
            )}
            onClick={() => onSelect(agent)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium truncate">
                  {agent.name}
                </CardTitle>
                <div className={cn('p-1 rounded-full text-white', getStatusColor(agent.status))}>
                  {getStatusIcon(agent.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">
                  {agent.type}
                </Badge>
                {execution && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {execution.duration ? `${execution.duration}ms` : 'Running...'}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Load: {Math.round(agent.performance.currentLoad * 100)}%
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium">{agent.name}</div>
            <div className="text-sm text-muted-foreground">{agent.metadata.description}</div>
            <div className="text-xs">
              Success Rate: {Math.round(agent.performance.successRate * 100)}%
            </div>
            <div className="text-xs">
              Avg Execution: {agent.performance.averageExecutionTime}ms
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Custom Edge Component
const WorkflowEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: any) => {
  const dataFlow = data?.dataFlow as DataFlow;
  
  const getEdgeColor = () => {
    if (!dataFlow?.isActive) return '#94a3b8';
    if (dataFlow.bottleneckSeverity === 'high') return '#ef4444';
    if (dataFlow.bottleneckSeverity === 'medium') return '#f59e0b';
    return '#10b981';
  };

  const getEdgeWidth = () => {
    if (!dataFlow) return 2;
    return Math.max(2, Math.min(8, dataFlow.volume / 10));
  };

  return (
    <g>
      <path
        id={id}
        d={`M${sourceX},${sourceY} L${targetX},${targetY}`}
        stroke={getEdgeColor()}
        strokeWidth={getEdgeWidth()}
        strokeDasharray={dataFlow?.isActive ? '0' : '5,5'}
        fill="none"
        markerEnd="url(#arrowhead)"
      />
      {dataFlow?.isActive && (
        <circle
          r="3"
          fill={getEdgeColor()}
          className="animate-pulse"
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={`M${sourceX},${sourceY} L${targetX},${targetY}`}
          />
        </circle>
      )}
    </g>
  );
};

// Bottleneck Highlight Component
interface BottleneckHighlightProps {
  executions: WorkflowExecution[];
  agents: Agent[];
}

const BottleneckHighlight: React.FC<BottleneckHighlightProps> = ({ executions, agents }) => {
  const bottlenecks = useMemo(() => {
    return executions
      .filter(exec => exec.isBottleneck)
      .map(exec => agents.find(agent => agent.id === exec.agentId))
      .filter(Boolean);
  }, [executions, agents]);

  if (bottlenecks.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-10">
      <Card className="bg-red-50 border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Bottlenecks Detected
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {bottlenecks.map(agent => (
              <div key={agent?.id} className="text-xs text-red-600">
                {agent?.name}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Workflow Controls Component
interface WorkflowControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onToggleBottlenecks: () => void;
  showBottlenecks: boolean;
}

const WorkflowControls: React.FC<WorkflowControlsProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onReset,
  onToggleBottlenecks,
  showBottlenecks,
}) => {
  return (
    <div className="absolute top-4 left-4 z-10">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={showBottlenecks ? "default" : "outline"}
              onClick={onToggleBottlenecks}
            >
              <Zap className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Agent Status Panel Component
interface AgentStatusPanelProps {
  selectedAgent: Agent | null;
  execution?: WorkflowExecution;
}

const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({ selectedAgent, execution }) => {
  if (!selectedAgent) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <Card className="w-64">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{selectedAgent.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant="outline">{selectedAgent.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs">{selectedAgent.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Load</span>
              <span className="text-xs">
                {Math.round(selectedAgent.performance.currentLoad * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Success Rate</span>
              <span className="text-xs">
                {Math.round(selectedAgent.performance.successRate * 100)}%
              </span>
            </div>
            {execution && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Duration</span>
                <span className="text-xs">
                  {execution.duration || 'Running...'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Component
export const TeamWorkflowDependencyGraph: React.FC<TeamWorkflowDependencyGraphProps> = ({
  agents,
  executions,
  dataFlows,
  className,
  onAgentSelect,
  onExecutionPathTrace,
  enableRealTimeUpdates = true,
  showPerformanceMetrics = true,
  highlightBottlenecks = true,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBottleneckHighlight, setShowBottleneckHighlight] = useState(highlightBottlenecks);

  // Convert agents to nodes
  const generateNodes = useCallback(() => {
    return agents.map((agent, index) => {
      const execution = executions.find(exec => exec.agentId === agent.id);
      
      return {
        id: agent.id,
        type: 'workflowNode',
        position: {
          x: (index % 4) * 200 + 100,
          y: Math.floor(index / 4) * 150 + 100,
        },
        data: {
          agent,
          execution,
          isSelected: selectedAgent?.id === agent.id,
          onSelect: (agent: Agent) => {
            setSelectedAgent(agent);
            onAgentSelect?.(agent);
          },
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      } as Node;
    });
  }, [agents, executions, selectedAgent, onAgentSelect]);

  // Convert data flows to edges
  const generateEdges = useCallback(() => {
    return dataFlows.map(dataFlow => ({
      id: dataFlow.id,
      source: dataFlow.sourceAgentId,
      target: dataFlow.targetAgentId,
      type: 'workflowEdge',
      markerEnd: {
        type: MarkerType.Arrow,
        color: dataFlow.isActive ? '#10b981' : '#94a3b8',
      },
      data: { dataFlow },
      animated: dataFlow.isActive,
      style: {
        stroke: dataFlow.bottleneckSeverity === 'high' ? '#ef4444' : 
               dataFlow.bottleneckSeverity === 'medium' ? '#f59e0b' : '#10b981',
        strokeWidth: Math.max(2, Math.min(8, dataFlow.volume / 10)),
      },
    } as Edge));
  }, [dataFlows]);

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(generateNodes());
    setEdges(generateEdges());
  }, [generateNodes, generateEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setIsPlaying(false);
    setSelectedAgent(null);
    // Reset to initial positions
    setNodes(generateNodes());
  };

  const handleToggleBottlenecks = () => {
    setShowBottleneckHighlight(!showBottleneckHighlight);
  };

  const nodeTypes = {
    workflowNode: WorkflowNode,
  };

  const edgeTypes = {
    workflowEdge: WorkflowEdge,
  };

  const selectedExecution = selectedAgent 
    ? executions.find(exec => exec.agentId === selectedAgent.id)
    : undefined;

  return (
    <div className={cn('relative h-full w-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="top-right"
      >
        <Controls />
        <Background />
        
        <WorkflowControls
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onReset={handleReset}
          onToggleBottlenecks={handleToggleBottlenecks}
          showBottlenecks={showBottleneckHighlight}
        />
        
        {showBottleneckHighlight && (
          <BottleneckHighlight executions={executions} agents={agents} />
        )}
        
        <AgentStatusPanel
          selectedAgent={selectedAgent}
          execution={selectedExecution}
        />
      </ReactFlow>
    </div>
  );
};

export default TeamWorkflowDependencyGraph;
```