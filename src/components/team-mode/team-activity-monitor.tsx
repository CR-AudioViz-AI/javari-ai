```tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Users, 
  Filter,
  TrendingUp,
  AlertCircle,
  Bot,
  Zap
} from 'lucide-react';

// Types
interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  currentTask?: string;
  avatar?: string;
}

interface TeamActivity {
  id: string;
  type: 'task_started' | 'task_completed' | 'agent_communication' | 'status_change' | 'error';
  agentId: string;
  agentName: string;
  timestamp: Date;
  message: string;
  metadata?: Record<string, any>;
  priority: 'low' | 'medium' | 'high';
}

interface TeamMetrics {
  totalAgents: number;
  activeAgents: number;
  completedTasks: number;
  averageTaskTime: number;
  messagesExchanged: number;
}

interface TeamActivityMonitorProps {
  teamId: string;
  className?: string;
  maxActivities?: number;
  showFilters?: boolean;
  showMetrics?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Mock hooks - replace with actual implementations
const useTeamActivity = (teamId: string) => {
  const [activities, setActivities] = useState<TeamActivity[]>([
    {
      id: '1',
      type: 'task_started',
      agentId: 'agent-1',
      agentName: 'Audio Analyst',
      timestamp: new Date(Date.now() - 30000),
      message: 'Started analyzing audio segment #1247',
      priority: 'medium'
    },
    {
      id: '2',
      type: 'agent_communication',
      agentId: 'agent-2',
      agentName: 'Pattern Detector',
      timestamp: new Date(Date.now() - 45000),
      message: 'Shared frequency pattern data with Audio Analyst',
      priority: 'low'
    },
    {
      id: '3',
      type: 'task_completed',
      agentId: 'agent-1',
      agentName: 'Audio Analyst',
      timestamp: new Date(Date.now() - 60000),
      message: 'Completed audio segment analysis',
      priority: 'high'
    }
  ]);

  const [agents, setAgents] = useState<Agent[]>([
    { id: 'agent-1', name: 'Audio Analyst', status: 'active', currentTask: 'Analyzing segment #1247' },
    { id: 'agent-2', name: 'Pattern Detector', status: 'busy', currentTask: 'Processing frequency data' },
    { id: 'agent-3', name: 'ML Classifier', status: 'idle' },
    { id: 'agent-4', name: 'Signal Processor', status: 'active', currentTask: 'Noise reduction' }
  ]);

  return { activities, agents, isLoading: false, error: null };
};

const useTeamMetrics = (teamId: string) => {
  const metrics: TeamMetrics = {
    totalAgents: 4,
    activeAgents: 2,
    completedTasks: 23,
    averageTaskTime: 145,
    messagesExchanged: 67
  };

  return { metrics, isLoading: false };
};

// Sub-components
const ActivityItem: React.FC<{ activity: TeamActivity }> = ({ activity }) => {
  const getActivityIcon = () => {
    switch (activity.type) {
      case 'task_started':
        return <Clock className="h-4 w-4" />;
      case 'task_completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'agent_communication':
        return <MessageSquare className="h-4 w-4" />;
      case 'status_change':
        return <Activity className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = () => {
    switch (activity.type) {
      case 'task_completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'agent_communication':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPriorityBadge = () => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };

    return (
      <Badge variant="secondary" className={colors[activity.priority]}>
        {activity.priority}
      </Badge>
    );
  };

  return (
    <div className="flex items-start space-x-3 py-3">
      <div className={`mt-1 ${getActivityColor()}`}>
        {getActivityIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground truncate">
            {activity.agentName}
          </p>
          <div className="flex items-center space-x-2">
            {getPriorityBadge()}
            <span className="text-xs text-muted-foreground">
              {new Date(activity.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {activity.message}
        </p>
      </div>
    </div>
  );
};

const AgentStatusCard: React.FC<{ agent: Agent }> = ({ agent }) => {
  const getStatusColor = () => {
    switch (agent.status) {
      case 'active':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'idle':
        return 'bg-gray-400';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${getStatusColor()}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{agent.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{agent.status}</p>
          {agent.currentTask && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {agent.currentTask}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

const TaskProgressIndicator: React.FC<{ 
  progress: number; 
  label: string;
  className?: string;
}> = ({ progress, label, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

const CommunicationBubble: React.FC<{ 
  message: string;
  sender: string;
  timestamp: Date;
  type: 'sent' | 'received';
}> = ({ message, sender, timestamp, type }) => {
  return (
    <div className={`flex ${type === 'sent' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs px-3 py-2 rounded-lg ${
        type === 'sent' 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-secondary text-secondary-foreground'
      }`}>
        <p className="text-xs font-medium mb-1">{sender}</p>
        <p className="text-sm">{message}</p>
        <p className="text-xs opacity-70 mt-1">
          {timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};

const ActivityFilters: React.FC<{
  filters: string[];
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
}> = ({ filters, activeFilters, onFilterChange }) => {
  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      onFilterChange(activeFilters.filter(f => f !== filter));
    } else {
      onFilterChange([...activeFilters, filter]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter}
          variant={activeFilters.includes(filter) ? "default" : "outline"}
          size="sm"
          onClick={() => toggleFilter(filter)}
          className="text-xs"
        >
          {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Button>
      ))}
    </div>
  );
};

const TeamMetrics: React.FC<{ metrics: TeamMetrics }> = ({ metrics }) => {
  const metricCards = [
    {
      label: 'Active Agents',
      value: `${metrics.activeAgents}/${metrics.totalAgents}`,
      icon: Users,
      color: 'text-green-500'
    },
    {
      label: 'Tasks Completed',
      value: metrics.completedTasks.toString(),
      icon: CheckCircle2,
      color: 'text-blue-500'
    },
    {
      label: 'Avg Task Time',
      value: `${metrics.averageTaskTime}s`,
      icon: Clock,
      color: 'text-yellow-500'
    },
    {
      label: 'Messages',
      value: metrics.messagesExchanged.toString(),
      icon: MessageSquare,
      color: 'text-purple-500'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricCards.map((metric, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center space-x-2">
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
            <div>
              <p className="text-sm font-medium">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

const ActivityFeed: React.FC<{
  activities: TeamActivity[];
  className?: string;
}> = ({ activities, className = '' }) => {
  return (
    <ScrollArea className={`h-96 ${className}`}>
      <div className="space-y-1">
        {activities.map((activity, index) => (
          <React.Fragment key={activity.id}>
            <ActivityItem activity={activity} />
            {index < activities.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  );
};

// Main Component
export const TeamActivityMonitor: React.FC<TeamActivityMonitorProps> = ({
  teamId,
  className = '',
  maxActivities = 50,
  showFilters = true,
  showMetrics = true,
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const { activities, agents, isLoading, error } = useTeamActivity(teamId);
  const { metrics } = useTeamMetrics(teamId);
  
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showAgentStatus, setShowAgentStatus] = useState(true);

  const availableFilters = [
    'task_started',
    'task_completed', 
    'agent_communication',
    'status_change',
    'error'
  ];

  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (activeFilters.length > 0) {
      filtered = filtered.filter(activity => 
        activeFilters.includes(activity.type)
      );
    }
    
    return filtered.slice(0, maxActivities);
  }, [activities, activeFilters, maxActivities]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Trigger refresh - in real implementation, this would call the hook's refresh function
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 animate-spin" />
            <span>Loading team activity...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Unable to load team activity
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showMetrics && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Team Metrics
          </h3>
          <TeamMetrics metrics={metrics} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Activity className="h-5 w-5 mr-2" />
                  Live Activity Feed
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAgentStatus(!showAgentStatus)}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    {showAgentStatus ? 'Hide' : 'Show'} Agents
                  </Button>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                    Live
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {showFilters && (
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filters:</span>
                  </div>
                  <ActivityFilters
                    filters={availableFilters}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                  />
                </div>
              )}
              <ActivityFeed activities={filteredActivities} />
            </CardContent>
          </Card>
        </div>

        {showAgentStatus && (
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Bot className="h-5 w-5 mr-2" />
                  Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {agents.map((agent) => (
                  <AgentStatusCard key={agent.id} agent={agent} />
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Zap className="h-5 w-5 mr-2" />
            Current Tasks Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskProgressIndicator
            progress={75}
            label="Audio Analysis Pipeline"
          />
          <TaskProgressIndicator
            progress={45}
            label="Pattern Recognition"
          />
          <TaskProgressIndicator
            progress={90}
            label="Signal Processing"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamActivityMonitor;
```