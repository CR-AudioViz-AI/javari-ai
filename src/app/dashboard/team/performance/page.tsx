'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  Activity,
  Zap,
  GitBranch,
  MessageSquare,
  Download,
  Settings,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Circle,
  Play,
  Pause,
  MoreVertical,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  productivity: number;
  tasksCompleted: number;
  activeTime: number;
  skills: string[];
  currentTask?: string;
  lastActivity: Date;
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignee: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours: number;
  actualHours: number;
  dueDate: Date;
}

interface Interaction {
  from: string;
  to: string;
  count: number;
  type: 'message' | 'mention' | 'collaboration';
}

interface ProductivityMetric {
  date: string;
  velocity: number;
  burndown: number;
  efficiency: number;
  commitCount: number;
  codeReviews: number;
}

interface OptimizationSuggestion {
  id: string;
  type: 'workload' | 'skills' | 'communication' | 'process';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  affectedMembers: string[];
}

interface TeamComposition {
  id: string;
  name: string;
  members: string[];
  skills: string[];
  effectiveness: number;
}

interface TeamPerformanceProps {
  teamId?: string;
  refreshInterval?: number;
  showOptimizations?: boolean;
}

const DRAG_TYPES = {
  TEAM_MEMBER: 'team_member',
  TASK: 'task',
};

const STATUS_COLORS = {
  online: 'bg-green-500',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

const PRIORITY_COLORS = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

// Mock data - replace with real API calls
const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    avatar: '/avatars/alice.jpg',
    role: 'Senior Frontend Developer',
    status: 'online',
    productivity: 92,
    tasksCompleted: 23,
    activeTime: 7.5,
    skills: ['React', 'TypeScript', 'UI/UX'],
    currentTask: 'Implementing dashboard components',
    lastActivity: new Date(),
  },
  {
    id: '2',
    name: 'Bob Smith',
    avatar: '/avatars/bob.jpg',
    role: 'Backend Engineer',
    status: 'busy',
    productivity: 88,
    tasksCompleted: 19,
    activeTime: 8.2,
    skills: ['Node.js', 'Python', 'Database'],
    currentTask: 'API optimization',
    lastActivity: new Date(Date.now() - 300000),
  },
  {
    id: '3',
    name: 'Carol Davis',
    avatar: '/avatars/carol.jpg',
    role: 'DevOps Engineer',
    status: 'away',
    productivity: 85,
    tasksCompleted: 15,
    activeTime: 6.8,
    skills: ['AWS', 'Docker', 'CI/CD'],
    currentTask: 'Infrastructure deployment',
    lastActivity: new Date(Date.now() - 900000),
  },
];

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'User authentication system',
    status: 'in-progress',
    assignee: '1',
    priority: 'high',
    estimatedHours: 16,
    actualHours: 12,
    dueDate: new Date(Date.now() + 86400000 * 3),
  },
  {
    id: '2',
    title: 'API rate limiting',
    status: 'review',
    assignee: '2',
    priority: 'medium',
    estimatedHours: 8,
    actualHours: 6,
    dueDate: new Date(Date.now() + 86400000 * 1),
  },
  {
    id: '3',
    title: 'Database migration',
    status: 'done',
    assignee: '3',
    priority: 'critical',
    estimatedHours: 12,
    actualHours: 14,
    dueDate: new Date(Date.now() - 86400000),
  },
];

const mockProductivityData: ProductivityMetric[] = [
  { date: '2024-01-01', velocity: 85, burndown: 78, efficiency: 92, commitCount: 45, codeReviews: 12 },
  { date: '2024-01-02', velocity: 88, burndown: 82, efficiency: 89, commitCount: 52, codeReviews: 15 },
  { date: '2024-01-03', velocity: 92, burndown: 85, efficiency: 94, commitCount: 48, codeReviews: 18 },
  { date: '2024-01-04', velocity: 87, burndown: 79, efficiency: 91, commitCount: 41, codeReviews: 14 },
  { date: '2024-01-05', velocity: 90, burndown: 88, efficiency: 96, commitCount: 55, codeReviews: 20 },
];

const mockOptimizations: OptimizationSuggestion[] = [
  {
    id: '1',
    type: 'workload',
    title: 'Redistribute high-priority tasks',
    description: 'Alice is handling 40% more critical tasks than team average. Consider redistributing to improve team balance.',
    impact: 'high',
    effort: 'low',
    affectedMembers: ['1', '2'],
  },
  {
    id: '2',
    type: 'skills',
    title: 'Cross-training opportunity',
    description: 'Bob could benefit from React training to provide better frontend support during peak periods.',
    impact: 'medium',
    effort: 'medium',
    affectedMembers: ['2'],
  },
];

const TeamMemberCard: React.FC<{
  member: TeamMember;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}> = ({ member, isSelected, onSelect }) => {
  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPES.TEAM_MEMBER,
    item: { id: member.id, type: DRAG_TYPES.TEAM_MEMBER },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const formatLastActivity = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div
      ref={drag}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      className={`
        cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
        ${isDragging ? 'rotate-3' : ''}
      `}
      onClick={() => onSelect?.(member.id)}
    >
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatar} alt={member.name} />
                <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${STATUS_COLORS[member.status]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{member.name}</h4>
              <p className="text-sm text-muted-foreground truncate">{member.role}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Productivity</span>
            <span className="font-medium">{member.productivity}%</span>
          </div>
          <Progress value={member.productivity} className="h-2" />
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Tasks</span>
              <p className="font-medium">{member.tasksCompleted}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Active</span>
              <p className="font-medium">{member.activeTime}h</p>
            </div>
          </div>

          {member.currentTask && (
            <div className="text-sm">
              <span className="text-muted-foreground">Current: </span>
              <span className="font-medium truncate">{member.currentTask}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {member.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {member.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{member.skills.length - 3}
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Last activity: {formatLastActivity(member.lastActivity)}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const TaskProgressVisualization: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const tasksByStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusLabels = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'review': 'In Review',
    'done': 'Completed'
  };

  const data = Object.entries(tasksByStatus).map(([status, count]) => ({
    name: statusLabels[status as keyof typeof statusLabels],
    value: count,
    color: status === 'done' ? '#22c55e' : 
           status === 'in-progress' ? '#3b82f6' :
           status === 'review' ? '#f59e0b' : '#6b7280'
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Task Progress Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          {tasks.filter(t => t.status !== 'done').map((task) => (
            <div key={task.id} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50">
              <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.actualHours}h / {task.estimatedHours}h
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const InteractionHeatmap: React.FC<{
  members: TeamMember[];
  interactions: Interaction[];
}> = ({ members, interactions }) => {
  const maxInteractions = Math.max(...interactions.map(i => i.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          Team Interaction Patterns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interactions.slice(0, 8).map((interaction) => {
            const fromMember = members.find(m => m.id === interaction.from);
            const toMember = members.find(m => m.id === interaction.to);
            const intensity = (interaction.count / maxInteractions) * 100;
            
            return (
              <div key={`${interaction.from}-${interaction.to}`} className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {fromMember?.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{fromMember?.name} → {toMember?.name}</span>
                    <span className="text-muted-foreground">{interaction.count}</span>
                  </div>
                  <Progress value={intensity} className="h-1" />
                </div>
                <Badge variant="outline" className="text-xs">
                  {interaction.type}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const ProductivityMetricsPanel: React.FC<{
  data: ProductivityMetric[];
}> = ({ data }) => {
  const [activeMetric, setActiveMetric] = useState<keyof ProductivityMetric>('velocity');

  const metricConfig = {
    velocity: { color: '#3b82f6', label: 'Velocity' },
    burndown: { color: '#f59e0b', label: 'Burndown' },
    efficiency: { color: '#22c55e', label: 'Efficiency' },
    commitCount: { color: '#8b5cf6', label: 'Commits' },
    codeReviews: { color: '#ef4444', label: 'Reviews' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Productivity Metrics
        </CardTitle>
        <div className="flex space-x-2">
          {Object.entries(metricConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={activeMetric === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveMetric(key as keyof ProductivityMetric)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <RechartsTooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke={metricConfig[activeMetric].color}
                fill={metricConfig[activeMetric].color}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

const DragDropTeamComposer: React.FC<{
  members: TeamMember[];
  compositions: TeamComposition[];
  onCompositionChange?: (composition: TeamComposition) => void;
}> = ({ members, compositions, onCompositionChange }) => {
  const [selectedComposition, setSelectedComposition] = useState<TeamComposition | null>(null);

  const [{ isOver }, drop] = useDrop({
    accept: DRAG_TYPES.TEAM_MEMBER,
    drop: (item: { id: string }) => {
      if (selectedComposition) {
        const updatedComposition = {
          ...selectedComposition,
          members: [...selectedComposition.members, item.id]
        };
        setSelectedComposition(updatedComposition);
        onCompositionChange?.(updatedComposition);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Team Composition Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          onValueChange={(value) => {
            const composition = compositions.find(c => c.id === value);
            setSelectedComposition(composition || null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select team composition" />
          </SelectTrigger>
          <SelectContent>
            {compositions.map((comp) => (
              <SelectItem key={comp.id} value={comp.id}>
                {comp.name} (Effectiveness: {comp.effectiveness}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedComposition && (
          <div
            ref={drop}
            className={`
              border-2 border-dashed rounded-lg p-4 min-h-32 transition-colors
              ${isOver ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25'}
            `}
          >
            <h4 className="font-medium mb-2">{selectedComposition.name}</h4>
            <div className="grid grid-cols-2 gap-2">
              {selectedComposition.members.map((memberId) => {
                const member = members.find(m => m.id === memberId);
                return member ? (
                  <div key={memberId} className="flex items-center space-x-2 p-2 bg-muted rounded">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{member.name}</span>
                  </div>
                ) : null;
              }