```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  MessageCircle,
  GitBranch,
  Activity,
  Clock,
  Zap,
  Network,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Settings,
} from 'lucide-react';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  currentTask?: string;
  performance: number;
  connections: string[];
  position: { x: number; y: number };
}

interface TaskAssignment {
  id: string;
  title: string;
  assignedTo: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  progress: number;
  dependencies: string[];
  estimatedTime: number;
  actualTime?: number;
}

interface CommunicationMessage {
  id: string;
  from: string;
  to: string[];
  type: 'direct' | 'broadcast' | 'decision' | 'status';
  content: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

interface DecisionNode {
  id: string;
  title: string;
  type: 'choice' | 'outcome' | 'condition';
  participants: string[];
  decision?: string;
  reasoning: string;
  timestamp: Date;
  confidence: number;
  alternatives: string[];
}

interface CollaborationMetrics {
  totalAgents: number;
  activeConnections: number;
  tasksCompleted: number;
  avgResponseTime: number;
  collaborationScore: number;
  efficiency: number;
  communicationVolume: number;
  decisionLatency: number;
}

interface ActivityEvent {
  id: string;
  type: 'task_assigned' | 'message_sent' | 'decision_made' | 'agent_joined' | 'status_changed';
  agentId: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface RealTimeTeamViewerProps {
  teamId: string;
  className?: string;
  onAgentSelect?: (agentId: string) => void;
  onTaskSelect?: (taskId: string) => void;
  onMessageSelect?: (messageId: string) => void;
  refreshInterval?: number;
  maxHistoryItems?: number;
  enableInteractions?: boolean;
  showMetrics?: boolean;
  graphLayout?: 'force' | 'circular' | 'hierarchical';
}

const RealTimeTeamViewer: React.FC<RealTimeTeamViewerProps> = ({
  teamId,
  className = '',
  onAgentSelect,
  onTaskSelect,
  onMessageSelect,
  refreshInterval = 1000,
  maxHistoryItems = 100,
  enableInteractions = true,
  showMetrics = true,
  graphLayout = 'force',
}) => {
  // State management
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [decisions, setDecisions] = useState<DecisionNode[]>([]);
  const [metrics, setMetrics] = useState<CollaborationMetrics>({
    totalAgents: 0,
    activeConnections: 0,
    tasksCompleted: 0,
    avgResponseTime: 0,
    collaborationScore: 0,
    efficiency: 0,
    communicationVolume: 0,
    decisionLatency: 0,
  });
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'network' | 'tasks' | 'communication' | 'decisions'>('network');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Simulate real-time data updates
  useEffect(() => {
    if (!isRealTimeEnabled) return;

    const interval = setInterval(() => {
      // Simulate agent updates
      setAgents(prev => prev.map(agent => ({
        ...agent,
        status: Math.random() > 0.8 ? 
          (['active', 'idle', 'busy'] as const)[Math.floor(Math.random() * 3)] : 
          agent.status,
        performance: Math.max(0, Math.min(100, agent.performance + (Math.random() - 0.5) * 10)),
      })));

      // Simulate new messages
      if (Math.random() > 0.7 && agents.length > 1) {
        const fromAgent = agents[Math.floor(Math.random() * agents.length)];
        const toAgent = agents[Math.floor(Math.random() * agents.length)];
        
        if (fromAgent.id !== toAgent.id) {
          const newMessage: CommunicationMessage = {
            id: `msg_${Date.now()}_${Math.random()}`,
            from: fromAgent.id,
            to: [toAgent.id],
            type: (['direct', 'status'] as const)[Math.floor(Math.random() * 2)],
            content: `Message from ${fromAgent.name} to ${toAgent.name}`,
            timestamp: new Date(),
            priority: 'normal',
          };

          setMessages(prev => [newMessage, ...prev.slice(0, maxHistoryItems - 1)]);
          
          const activity: ActivityEvent = {
            id: `activity_${Date.now()}`,
            type: 'message_sent',
            agentId: fromAgent.id,
            description: `Sent message to ${toAgent.name}`,
            timestamp: new Date(),
          };
          
          setActivities(prev => [activity, ...prev.slice(0, maxHistoryItems - 1)]);
        }
      }

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        activeConnections: agents.filter(a => a.status === 'active').length,
        collaborationScore: Math.max(0, Math.min(100, prev.collaborationScore + (Math.random() - 0.5) * 5)),
        communicationVolume: messages.length,
        efficiency: Math.max(0, Math.min(100, prev.efficiency + (Math.random() - 0.5) * 3)),
      }));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isRealTimeEnabled, refreshInterval, agents, messages, maxHistoryItems]);

  // Initialize mock data
  useEffect(() => {
    const initializeData = () => {
      setIsLoading(true);
      
      // Mock agents
      const mockAgents: AgentNode[] = [
        {
          id: 'agent-1',
          name: 'Alpha',
          role: 'coordinator',
          status: 'active',
          currentTask: 'Task coordination',
          performance: 85,
          connections: ['agent-2', 'agent-3'],
          position: { x: 0, y: 0 },
        },
        {
          id: 'agent-2',
          name: 'Beta',
          role: 'analyzer',
          status: 'busy',
          currentTask: 'Data analysis',
          performance: 92,
          connections: ['agent-1', 'agent-3', 'agent-4'],
          position: { x: 100, y: 50 },
        },
        {
          id: 'agent-3',
          name: 'Gamma',
          role: 'executor',
          status: 'active',
          currentTask: 'Process execution',
          performance: 78,
          connections: ['agent-1', 'agent-2'],
          position: { x: 50, y: 100 },
        },
        {
          id: 'agent-4',
          name: 'Delta',
          role: 'validator',
          status: 'idle',
          performance: 88,
          connections: ['agent-2'],
          position: { x: 150, y: 75 },
        },
      ];

      // Mock tasks
      const mockTasks: TaskAssignment[] = [
        {
          id: 'task-1',
          title: 'Data Processing Pipeline',
          assignedTo: ['agent-1', 'agent-2'],
          priority: 'high',
          status: 'in_progress',
          progress: 65,
          dependencies: [],
          estimatedTime: 120,
          actualTime: 78,
        },
        {
          id: 'task-2',
          title: 'Quality Validation',
          assignedTo: ['agent-4'],
          priority: 'medium',
          status: 'pending',
          progress: 0,
          dependencies: ['task-1'],
          estimatedTime: 45,
        },
      ];

      setAgents(mockAgents);
      setTasks(mockTasks);
      
      setMetrics({
        totalAgents: mockAgents.length,
        activeConnections: mockAgents.filter(a => a.status === 'active').length,
        tasksCompleted: 8,
        avgResponseTime: 1.2,
        collaborationScore: 85,
        efficiency: 92,
        communicationVolume: 24,
        decisionLatency: 0.8,
      });
      
      setIsLoading(false);
    };

    initializeData();
  }, [teamId]);

  // Handlers
  const handleAgentClick = useCallback((agentId: string) => {
    setSelectedAgent(prev => prev === agentId ? null : agentId);
    onAgentSelect?.(agentId);
  }, [onAgentSelect]);

  const toggleRealTime = useCallback(() => {
    setIsRealTimeEnabled(prev => !prev);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'idle': return 'bg-blue-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  }, []);

  // Computed values
  const filteredMessages = useMemo(() => {
    return messages.slice(0, maxHistoryItems);
  }, [messages, maxHistoryItems]);

  const recentActivities = useMemo(() => {
    return activities.slice(0, 10);
  }, [activities]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          <span className="text-sm text-muted-foreground">Loading team collaboration data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold">Team Collaboration Viewer</h2>
            <Badge variant="outline" className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isRealTimeEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span>{isRealTimeEnabled ? 'Live' : 'Paused'}</span>
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="6h">6h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
                <SelectItem value="7d">7d</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRealTime}
              className="flex items-center space-x-1"
            >
              {isRealTimeEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isRealTimeEnabled ? 'Pause' : 'Resume'}</span>
            </Button>
            
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        {showMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Agents</p>
                  <p className="text-lg font-semibold">{metrics.totalAgents}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <Network className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-semibold">{metrics.activeConnections}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="text-lg font-semibold">{metrics.tasksCompleted}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Response</p>
                  <p className="text-lg font-semibold">{metrics.avgResponseTime}s</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-lg font-semibold">{Math.round(metrics.collaborationScore)}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Efficiency</p>
                  <p className="text-lg font-semibold">{Math.round(metrics.efficiency)}%</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Messages</p>
                  <p className="text-lg font-semibold">{metrics.communicationVolume}</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Latency</p>
                  <p className="text-lg font-semibold">{metrics.decisionLatency}s</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="network" className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span>Network</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="communication" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Communication</span>
            </TabsTrigger>
            <TabsTrigger value="decisions" className="flex items-center space-x-2">
              <GitBranch className="h-4 w-4" />
              <span>Decisions</span>
            </TabsTrigger>
          </TabsList>

          {/* Network Graph Tab */}
          <TabsContent value="network" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Network Visualization */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Network className="h-5 w-5" />
                    <span>Agent Network</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-96 bg-muted/20 rounded-lg overflow-hidden">
                    {/* Simple network visualization */}
                    <svg className="w-full h-full">
                      {/* Connections */}
                      {agents.map(agent =>
                        agent.connections.map(connectionId => {
                          const targetAgent = agents.find(a => a.id === connectionId);
                          if (!targetAgent) return null;
                          
                          return (
                            <line
                              key={`${agent.id}-${connectionId}`}
                              x1={agent.position.x + 200}
                              y1={agent.position.y + 150}
                              x2={targetAgent.position.x + 200}
                              y2={targetAgent.position.y + 150}
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-muted-foreground opacity-50"
                            />
                          );
                        })
                      )}
                      
                      {/* Agents */}
                      {agents.map(agent => (
                        <g
                          key={agent.id}
                          className="cursor-pointer"
                          onClick={() => handleAgentClick(agent.id)}
                        >
                          <circle
                            cx={agent.position.x + 200}
                            cy={agent.position.y + 150}
                            r={selectedAgent === agent.id ? "20" : "16"}
                            className={`${getStatusColor(agent.status)} transition-all duration-200`}
                          />
                          <text
                            x={agent.position.x + 200}
                            y={agent.position.y + 175}
                            textAnchor="middle"
                            className="text-xs font-medium fill-current"
                          >
                            {agent.name}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Details Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Agent Status</span>