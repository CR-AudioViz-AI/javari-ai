```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Controls, 
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Badge,
  BadgeProps
} from '@/components/ui/badge';
import {
  Progress
} from '@/components/ui/progress';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Button
} from '@/components/ui/button';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Layers,
  GitBranch,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

// Types
interface PipelineStage {
  id: string;
  name: string;
  type: 'build' | 'test' | 'deploy' | 'verify' | 'rollback';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration: number;
  success_rate: number;
  error_count: number;
  position: { x: number; y: number };
  dependencies: string[];
  metrics: {
    avg_duration: number;
    success_rate: number;
    throughput: number;
    queue_time: number;
  };
}

interface Pipeline {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'paused';
  stages: PipelineStage[];
  created_at: string;
  updated_at: string;
  total_duration: number;
  success_rate: number;
}

interface BottleneckData {
  stage_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'duration' | 'failure_rate' | 'queue_time' | 'resource';
  impact_score: number;
  description: string;
}

interface OptimizationSuggestion {
  id: string;
  stage_id: string;
  type: 'performance' | 'reliability' | 'cost' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  potential_improvement: string;
  estimated_impact: number;
}

interface StageExecution {
  id: string;
  stage_id: string;
  status: string;
  duration: number;
  started_at: string;
  completed_at: string;
  logs: string[];
  metrics: Record<string, number>;
}

interface PipelineVisualizationProps {
  pipelineId: string;
  className?: string;
  onStageClick?: (stageId: string) => void;
  onOptimizationApply?: (suggestion: OptimizationSuggestion) => void;
  realTimeUpdates?: boolean;
}

// Zustand Store
interface PipelineStore {
  pipelines: Record<string, Pipeline>;
  bottlenecks: Record<string, BottleneckData[]>;
  suggestions: Record<string, OptimizationSuggestion[]>;
  executions: Record<string, StageExecution[]>;
  setPipeline: (id: string, pipeline: Pipeline) => void;
  setBottlenecks: (pipelineId: string, bottlenecks: BottleneckData[]) => void;
  setSuggestions: (pipelineId: string, suggestions: OptimizationSuggestion[]) => void;
  setExecutions: (stageId: string, executions: StageExecution[]) => void;
}

const usePipelineStore = create<PipelineStore>()(
  subscribeWithSelector((set) => ({
    pipelines: {},
    bottlenecks: {},
    suggestions: {},
    executions: {},
    setPipeline: (id, pipeline) =>
      set((state) => ({
        pipelines: { ...state.pipelines, [id]: pipeline }
      })),
    setBottlenecks: (pipelineId, bottlenecks) =>
      set((state) => ({
        bottlenecks: { ...state.bottlenecks, [pipelineId]: bottlenecks }
      })),
    setSuggestions: (pipelineId, suggestions) =>
      set((state) => ({
        suggestions: { ...state.suggestions, [pipelineId]: suggestions }
      })),
    setExecutions: (stageId, executions) =>
      set((state) => ({
        executions: { ...state.executions, [stageId]: executions }
      }))
  }))
);

// Supabase client setup (replace with your actual config)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Custom Node Components
const StageNode: React.FC<{ data: PipelineStage & { onClick: () => void } }> = ({ data }) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-blue-500';
      case 'pending': return 'bg-gray-400';
      case 'skipped': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-white" />;
      case 'failed': return <XCircle className="h-4 w-4 text-white" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-white animate-spin" />;
      case 'pending': return <Clock className="h-4 w-4 text-white" />;
      default: return <Pause className="h-4 w-4 text-white" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className="relative"
    >
      <Card 
        className="w-48 cursor-pointer border-2 hover:border-blue-400 transition-colors"
        onClick={data.onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{data.name}</CardTitle>
            <div className={`p-1 rounded-full ${getStatusColor(data.status)}`}>
              {getStatusIcon(data.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Success Rate</span>
              <span>{Math.round(data.success_rate)}%</span>
            </div>
            <Progress value={data.success_rate} className="h-1" />
            
            <div className="flex justify-between text-xs text-gray-600">
              <span>Avg Duration</span>
              <span>{Math.round(data.metrics.avg_duration)}s</span>
            </div>
            
            {data.error_count > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.error_count} errors
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Bottleneck Indicator */}
      <BottleneckIndicator stageId={data.id} />
    </motion.div>
  );
};

// Bottleneck Indicator Component
const BottleneckIndicator: React.FC<{ stageId: string }> = ({ stageId }) => {
  const bottlenecks = usePipelineStore((state) => 
    Object.values(state.bottlenecks).flat().filter(b => b.stage_id === stageId)
  );

  if (bottlenecks.length === 0) return null;

  const highestSeverity = bottlenecks.reduce((max, b) => {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityOrder[b.severity] > severityOrder[max.severity] ? b : max;
  }, bottlenecks[0]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${getSeverityColor(highestSeverity.severity)} flex items-center justify-center`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AlertTriangle className="h-3 w-3 text-white" />
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">Bottleneck Detected</p>
          <p className="text-sm">{highestSeverity.description}</p>
          <p className="text-xs text-gray-400">Impact Score: {highestSeverity.impact_score}</p>
        </div>
      </TooltipContent>
    </UITooltip>
  );
};

// Stage Metrics Component
const StageMetrics: React.FC<{ stage: PipelineStage }> = ({ stage }) => {
  const metrics = [
    { label: 'Success Rate', value: `${Math.round(stage.metrics.success_rate)}%`, trend: 'up' },
    { label: 'Avg Duration', value: `${Math.round(stage.metrics.avg_duration)}s`, trend: 'down' },
    { label: 'Throughput', value: `${stage.metrics.throughput}/hr`, trend: 'up' },
    { label: 'Queue Time', value: `${Math.round(stage.metrics.queue_time)}s`, trend: 'down' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{metric.label}</p>
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
            <div className={`p-2 rounded-full ${
              metric.trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {metric.trend === 'up' ? 
                <TrendingUp className="h-4 w-4" /> : 
                <TrendingDown className="h-4 w-4" />
              }
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

// Performance Chart Component
const PerformanceChart: React.FC<{ stageId: string }> = ({ stageId }) => {
  const executions = usePipelineStore((state) => state.executions[stageId] || []);

  const chartData = executions.slice(-20).map((execution, index) => ({
    execution: index + 1,
    duration: execution.duration,
    timestamp: execution.started_at,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="execution" />
          <YAxis />
          <Tooltip 
            formatter={(value) => [`${value}s`, 'Duration']}
            labelFormatter={(label) => `Execution ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="duration" 
            stroke="#8884d8" 
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Optimization Suggestions Component
const OptimizationSuggestions: React.FC<{ 
  pipelineId: string;
  onApply?: (suggestion: OptimizationSuggestion) => void;
}> = ({ pipelineId, onApply }) => {
  const suggestions = usePipelineStore((state) => state.suggestions[pipelineId] || []);

  const getPriorityColor = (priority: string): BadgeProps['variant'] => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance': return <Zap className="h-4 w-4" />;
      case 'reliability': return <Target className="h-4 w-4" />;
      case 'cost': return <TrendingDown className="h-4 w-4" />;
      case 'security': return <Activity className="h-4 w-4" />;
      default: return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {getTypeIcon(suggestion.type)}
                <h4 className="font-medium">{suggestion.title}</h4>
                <Badge variant={getPriorityColor(suggestion.priority)}>
                  {suggestion.priority}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
              <p className="text-sm font-medium text-green-600">
                Expected improvement: {suggestion.potential_improvement}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onApply?.(suggestion)}
              className="ml-4"
            >
              Apply
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

// Drill Down Panel Component
const DrillDownPanel: React.FC<{
  stage: PipelineStage | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ stage, isOpen, onClose }) => {
  if (!stage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <GitBranch className="h-5 w-5" />
            <span>{stage.name} - Detailed Analytics</span>
          </DialogTitle>
          <DialogDescription>
            Comprehensive performance metrics and execution history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stage Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
            <StageMetrics stage={stage} />
          </div>

          {/* Performance Chart */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Execution History</h3>
            <PerformanceChart stageId={stage.id} />
          </div>

          {/* Recent Executions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Executions</h3>
            <DeploymentTimeline stageId={stage.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Deployment Timeline Component
const DeploymentTimeline: React.FC<{ stageId: string }> = ({ stageId }) => {
  const executions = usePipelineStore((state) => state.executions[stageId] || []);

  return (
    <div className="space-y-3">
      {executions.slice(0, 10).map((execution) => (
        <div key={execution.id} className="flex items-center space-x-4 p-3 border rounded-lg">
          <div className={`w-3 h-3 rounded-full ${
            execution.status === 'success' ? 'bg-green-500' :
            execution.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
          }`} />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="font-medium">
                Execution {execution.id.slice(0, 8)}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(execution.started_at).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Duration: {Math.round(execution.duration)}s
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Main Component
const PipelineVisualization: React.FC<PipelineVisualizationProps> = ({
  pipelineId,
  className = '',
  onStageClick,
  onOptimizationApply,
  realTimeUpdates = true
}) => {
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const pipeline = usePipelineStore((state) => state.pipelines[pipelineId]);
  const bottlenecks = usePipelineStore((state) => state.bottlenecks[pipelineId] || []);
  const suggestions = usePipelineStore((state) => state.suggestions[pipelineId] || []);

  const { setPipeline, setBottlenecks, setSuggestions, setExecutions } = usePipelineStore();

  // Convert stages to React Flow nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleStageClick = useCallback((stage: PipelineStage) => {
    setSelectedStage(stage);
    setShowDrillDown(true);
    onStageClick?.(stage.id);
  }, [onStageClick]);

  // Convert pipeline stages to React Flow format
  useEffect(() => {
    if (!pipeline) return;

    const flowNodes: Node[] = pipeline.stages.map((stage) => ({
      id: stage.id,
      type: 'custom',
      position: stage.position,
      data: {
        ...stage,
        onClick: () => handleStageClick(stage)
      }
    }));

    const flowEdges: Edge[] = pipeline.stages.flatMap((stage) =>
      stage.dependencies.map((depId) => ({
        id: `${depId}-${stage.id}`,
        source: depId,
        target: stage.id,
        type: 'smoothstep',
        animated: stage.status === 'running'
      }))
    );

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [pipeline, handleStageClick, setNodes, setEdges]);

  // Fetch initial data
  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        // Fetch pipeline data
        const { data: pipelineData } = await supabase
          .from('deployment_pipelines')
          .select(`
            *,
            stages:pipeline_stages(*)
          `)
          .eq('id', pipelineId)
          .single();

        if (pipelineData) {
          setPipeline(pipelineId, pipelineData);
        }

        // Fetch bottlenecks
        const { data: bottleneckData } = await supabase
          .from('pipeline_analytics')
          .select('*')
          .eq('pipeline_id', pipelineId);

        if (bottleneckData) {
          setBottlenecks(pipelineId, bottleneckData);
        }

        // Fetch optimization suggestions
        const { data: suggestionData } = await supabase
          .from('ml_insights')
          .select('*')
          .eq('pipeline_id', pipelineId)
          .eq('type', 'optimization');

        if (suggestionData) {
          setSuggestions(pipelineId, suggestionData);
        }

      } catch (error) {
        console.error('Error fetching pipeline data:', error);
      }