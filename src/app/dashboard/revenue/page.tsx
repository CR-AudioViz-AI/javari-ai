```tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import {
  useSortable,
  SortableContext as SortableProvider
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Calendar,
  Settings,
  GripVertical,
  Plus,
  Minus,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Share2
} from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';

// Types
interface RevenueData {
  id: string;
  date: string;
  actual: number;
  forecast: number;
  goal: number;
}

interface GoalData {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
  status: 'on-track' | 'at-risk' | 'behind' | 'achieved';
}

interface ScenarioData {
  id: string;
  name: string;
  growth_rate: number;
  conversion_rate: number;
  churn_rate: number;
  forecast: number[];
}

interface WidgetConfig {
  id: string;
  type: 'chart' | 'metrics' | 'goals' | 'scenarios';
  title: string;
  size: 'small' | 'medium' | 'large';
  config: Record<string, any>;
}

interface TimeRange {
  start: Date;
  end: Date;
  period: 'monthly' | 'quarterly' | 'yearly';
}

// Mock data
const mockRevenueData: RevenueData[] = Array.from({ length: 12 }, (_, i) => {
  const date = format(addMonths(subMonths(new Date(), 6), i), 'yyyy-MM');
  const base = 50000 + Math.random() * 20000;
  return {
    id: `revenue-${i}`,
    date,
    actual: base + Math.random() * 10000,
    forecast: base * 1.1 + Math.random() * 5000,
    goal: base * 1.15,
  };
});

const mockGoals: GoalData[] = [
  {
    id: 'goal-1',
    title: 'Q4 Revenue Target',
    target: 1000000,
    current: 750000,
    deadline: '2024-12-31',
    status: 'on-track'
  },
  {
    id: 'goal-2',
    title: 'New Customer Revenue',
    target: 250000,
    current: 180000,
    deadline: '2024-11-30',
    status: 'at-risk'
  },
  {
    id: 'goal-3',
    title: 'Product Line Growth',
    target: 500000,
    current: 520000,
    deadline: '2024-12-15',
    status: 'achieved'
  }
];

const mockScenarios: ScenarioData[] = [
  {
    id: 'scenario-1',
    name: 'Conservative',
    growth_rate: 5,
    conversion_rate: 2.5,
    churn_rate: 3,
    forecast: [60000, 63000, 66150, 69457]
  },
  {
    id: 'scenario-2',
    name: 'Optimistic',
    growth_rate: 15,
    conversion_rate: 4.5,
    churn_rate: 2,
    forecast: [60000, 69000, 79350, 91252]
  },
  {
    id: 'scenario-3',
    name: 'Realistic',
    growth_rate: 8,
    conversion_rate: 3.2,
    churn_rate: 2.8,
    forecast: [60000, 64800, 69984, 75583]
  }
];

// Draggable Widget Component
const DraggableWidget: React.FC<{
  widget: WidgetConfig;
  children: React.ReactNode;
  isDragging?: boolean;
}> = ({ widget, children, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? 'z-50' : ''}`}
      {...attributes}
    >
      <div
        {...listeners}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
};

// Revenue Projection Chart Component
const RevenueProjectionChart: React.FC<{
  data: RevenueData[];
  timeRange: TimeRange;
  showForecast: boolean;
  showGoals: boolean;
}> = ({ data, timeRange, showForecast, showGoals }) => {
  const chartData = useMemo(() => 
    data.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MMM yyyy')
    })), [data]
  );

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stackId="1"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.6}
            name="Actual Revenue"
          />
          {showForecast && (
            <Area
              type="monotone"
              dataKey="forecast"
              stackId="2"
              stroke="hsl(var(--secondary))"
              fill="hsl(var(--secondary))"
              fillOpacity={0.4}
              strokeDasharray="5 5"
              name="Forecasted Revenue"
            />
          )}
          {showGoals && (
            <ReferenceLine 
              y={mockGoals[0]?.target} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="3 3"
              label="Target"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Goal Tracking Widget Component
const GoalTrackingWidget: React.FC<{
  goals: GoalData[];
}> = ({ goals }) => {
  const getStatusColor = (status: GoalData['status']) => {
    switch (status) {
      case 'achieved': return 'text-green-600 bg-green-100';
      case 'on-track': return 'text-blue-600 bg-blue-100';
      case 'at-risk': return 'text-yellow-600 bg-yellow-100';
      case 'behind': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: GoalData['status']) => {
    switch (status) {
      case 'achieved': return <CheckCircle2 className="h-4 w-4" />;
      case 'on-track': return <TrendingUp className="h-4 w-4" />;
      case 'at-risk': return <AlertCircle className="h-4 w-4" />;
      case 'behind': return <TrendingDown className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const progress = (goal.current / goal.target) * 100;
        
        return (
          <div key={goal.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{goal.title}</h4>
              <Badge className={getStatusColor(goal.status)}>
                {getStatusIcon(goal.status)}
                <span className="ml-1 capitalize">{goal.status.replace('-', ' ')}</span>
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${goal.current.toLocaleString()}</span>
                <span>${goal.target.toLocaleString()}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.toFixed(1)}% complete</span>
                <span>Due {format(new Date(goal.deadline), 'MMM dd')}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Scenario Modeling Panel Component
const ScenarioModelingPanel: React.FC<{
  scenarios: ScenarioData[];
  activeScenario: string;
  onScenarioChange: (scenarioId: string) => void;
  onUpdateScenario: (scenarioId: string, updates: Partial<ScenarioData>) => void;
}> = ({ scenarios, activeScenario, onScenarioChange, onUpdateScenario }) => {
  const [customScenario, setCustomScenario] = useState<Partial<ScenarioData>>({
    growth_rate: 10,
    conversion_rate: 3,
    churn_rate: 2.5,
  });

  const activeScenarioData = scenarios.find(s => s.id === activeScenario);

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="scenario-select">Select Scenario</Label>
        <Select value={activeScenario} onValueChange={onScenarioChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose scenario" />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((scenario) => (
              <SelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeScenarioData && (
        <div className="space-y-4">
          <h4 className="font-medium">Scenario Parameters</h4>
          
          <div className="space-y-3">
            <div>
              <Label>Growth Rate: {activeScenarioData.growth_rate}%</Label>
              <Slider
                value={[activeScenarioData.growth_rate]}
                onValueChange={([value]) => 
                  onUpdateScenario(activeScenario, { growth_rate: value })
                }
                max={30}
                step={0.5}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label>Conversion Rate: {activeScenarioData.conversion_rate}%</Label>
              <Slider
                value={[activeScenarioData.conversion_rate]}
                onValueChange={([value]) => 
                  onUpdateScenario(activeScenario, { conversion_rate: value })
                }
                max={10}
                step={0.1}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label>Churn Rate: {activeScenarioData.churn_rate}%</Label>
              <Slider
                value={[activeScenarioData.churn_rate]}
                onValueChange={([value]) => 
                  onUpdateScenario(activeScenario, { churn_rate: value })
                }
                max={15}
                step={0.1}
                className="mt-2"
              />
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeScenarioData.forecast.map((value, index) => ({
                month: `Month ${index + 1}`,
                forecast: value
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Forecast']} />
                <Line 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// Revenue Metrics Cards Component
const RevenueMetricsCards: React.FC<{
  data: RevenueData[];
  timeRange: TimeRange;
}> = ({ data, timeRange }) => {
  const metrics = useMemo(() => {
    const currentPeriod = data.slice(-3);
    const previousPeriod = data.slice(-6, -3);
    
    const currentRevenue = currentPeriod.reduce((sum, item) => sum + item.actual, 0);
    const previousRevenue = previousPeriod.reduce((sum, item) => sum + item.actual, 0);
    const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    
    const forecast = currentPeriod.reduce((sum, item) => sum + item.forecast, 0);
    const forecastAccuracy = ((currentRevenue / forecast) * 100);
    
    return {
      totalRevenue: currentRevenue,
      growth: growth,
      forecastAccuracy: forecastAccuracy,
      avgMonthly: currentRevenue / currentPeriod.length,
    };
  }, [data]);

  const cards = [
    {
      title: 'Total Revenue',
      value: `$${metrics.totalRevenue.toLocaleString()}`,
      change: `+${metrics.growth.toFixed(1)}%`,
      changeType: metrics.growth > 0 ? 'positive' : 'negative',
      icon: DollarSign,
    },
    {
      title: 'Forecast Accuracy',
      value: `${metrics.forecastAccuracy.toFixed(1)}%`,
      change: `${metrics.forecastAccuracy > 95 ? '+' : ''}${(metrics.forecastAccuracy - 100).toFixed(1)}%`,
      changeType: metrics.forecastAccuracy > 95 ? 'positive' : 'negative',
      icon: Target,
    },
    {
      title: 'Avg Monthly',
      value: `$${metrics.avgMonthly.toLocaleString()}`,
      change: `+${(metrics.growth / 3).toFixed(1)}%`,
      changeType: metrics.growth > 0 ? 'positive' : 'negative',
      icon: BarChart3,
    },
    {
      title: 'Growth Rate',
      value: `${metrics.growth.toFixed(1)}%`,
      change: 'vs prev period',
      changeType: metrics.growth > 0 ? 'positive' : 'neutral',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className="text-2xl font-bold">
                  {card.value}
                </p>
              </div>
              <card.icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span
                className={`flex items-center ${
                  card.changeType === 'positive' 
                    ? 'text-green-600' 
                    : card.changeType === 'negative' 
                    ? 'text-red-600' 
                    : 'text-muted-foreground'
                }`}
              >
                {card.changeType === 'positive' && <TrendingUp className="mr-1 h-3 w-3" />}
                {card.changeType === 'negative' && <TrendingDown className="mr-1 h-3 w-3" />}
                {card.change}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Time Range Selector Component
const TimeRangeSelector: React.FC<{
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
}> = ({ timeRange, onTimeRangeChange }) => {
  const presets = [
    { label: 'Last 3 months', value: 'last-3-months' },
    { label: 'Last 6 months', value: 'last-6-months' },
    { label: 'Last 12 months', value: 'last-12-months' },
    { label: 'Year to date', value: 'ytd' },
    { label: 'Custom', value: 'custom' },
  ];

  const [selectedPreset, setSelectedPreset] = useState('last-6-months');

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const now = new Date();
    
    switch (preset) {
      case 'last-3-months':
        onTimeRangeChange({
          start: subMonths(now, 3),
          end: now,
          period: 'monthly'
        });
        break;
      case 'last-6-months':
        onTimeRangeChange({
          start: subMonths(now, 6),
          end: now,
          period: 'monthly'
        });
        break;
      case 'last-12-months':
        onTimeRangeChange({
          start: subMonths(now, 12),
          end: now,
          period: 'monthly'
        });
        break;
      case 'ytd':
        onTimeRangeChange({
          start: new Date(now.getFullYear(), 0, 1),
          end: now,
          period: 'monthly'
        });
        break;
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select 
        value={timeRange.period} 
        onValueChange={(period) => 
          onTimeRangeChange({ ...timeRange, period: period as TimeRange['period'] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="quarterly">Quarterly</SelectItem>
          <SelectItem value="yearly">Yearly</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

// Main Dashboard Component
export default function RevenueForecastingDashboard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'metrics', type: 'metrics', title: 'Revenue Metrics', size: 'large', config: {} },
    { id: