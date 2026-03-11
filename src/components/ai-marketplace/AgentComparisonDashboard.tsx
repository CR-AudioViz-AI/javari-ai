'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Button 
} from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Checkbox 
} from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  Search, 
  Download, 
  Save, 
  Share2, 
  Star, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Zap,
  Filter,
  X,
  Eye,
  Heart,
  MessageSquare,
  BarChart3,
  FileText,
  Settings
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Types
interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing_model: 'free' | 'freemium' | 'paid' | 'enterprise';
  base_price: number;
  currency: string;
  rating: number;
  total_reviews: number;
  total_installs: number;
  creator_id: string;
  creator_name: string;
  logo_url?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface AgentFeature {
  id: string;
  agent_id: string;
  feature_name: string;
  feature_category: string;
  is_supported: boolean;
  feature_value?: string;
  feature_limit?: number;
}

interface AgentReview {
  id: string;
  agent_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  title: string;
  content: string;
  helpful_count: number;
  created_at: string;
}

interface AgentMetric {
  id: string;
  agent_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

interface ComparisonFilters {
  search: string;
  categories: string[];
  pricing_models: string[];
  min_rating: number;
  features: string[];
}

interface AgentComparisonDashboardProps {
  initialAgentIds?: string[];
  maxComparisons?: number;
  enableExport?: boolean;
  enableSave?: boolean;
  className?: string;
}

// Mock data (replace with actual Supabase integration)
const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'DataAnalyzer Pro',
    description: 'Advanced data analysis and visualization AI agent',
    category: 'Analytics',
    pricing_model: 'freemium',
    base_price: 29.99,
    currency: 'USD',
    rating: 4.8,
    total_reviews: 245,
    total_installs: 1250,
    creator_id: 'creator1',
    creator_name: 'TechCorp',
    logo_url: '/api/placeholder/64/64',
    tags: ['analytics', 'visualization', 'data'],
    created_at: '2024-01-15',
    updated_at: '2024-02-20'
  },
  {
    id: '2',
    name: 'ContentWriter AI',
    description: 'Professional content generation and editing assistant',
    category: 'Writing',
    pricing_model: 'paid',
    base_price: 19.99,
    currency: 'USD',
    rating: 4.6,
    total_reviews: 189,
    total_installs: 890,
    creator_id: 'creator2',
    creator_name: 'WriteBot Inc',
    logo_url: '/api/placeholder/64/64',
    tags: ['writing', 'content', 'editing'],
    created_at: '2024-02-01',
    updated_at: '2024-02-25'
  },
  {
    id: '3',
    name: 'CodeAssist Plus',
    description: 'Intelligent code review and optimization tool',
    category: 'Development',
    pricing_model: 'enterprise',
    base_price: 99.99,
    currency: 'USD',
    rating: 4.9,
    total_reviews: 156,
    total_installs: 430,
    creator_id: 'creator3',
    creator_name: 'DevTools Ltd',
    logo_url: '/api/placeholder/64/64',
    tags: ['coding', 'development', 'optimization'],
    created_at: '2024-01-20',
    updated_at: '2024-02-18'
  }
];

const mockFeatures: AgentFeature[] = [
  { id: '1', agent_id: '1', feature_name: 'Data Visualization', feature_category: 'Core', is_supported: true },
  { id: '2', agent_id: '1', feature_name: 'Real-time Analytics', feature_category: 'Core', is_supported: true },
  { id: '3', agent_id: '1', feature_name: 'API Integration', feature_category: 'Integration', is_supported: true },
  { id: '4', agent_id: '1', feature_name: 'Custom Reports', feature_category: 'Reports', is_supported: true, feature_limit: 10 },
  { id: '5', agent_id: '2', feature_name: 'Content Generation', feature_category: 'Core', is_supported: true },
  { id: '6', agent_id: '2', feature_name: 'Grammar Check', feature_category: 'Core', is_supported: true },
  { id: '7', agent_id: '2', feature_name: 'SEO Optimization', feature_category: 'SEO', is_supported: true },
  { id: '8', agent_id: '2', feature_name: 'Multi-language', feature_category: 'Language', is_supported: false },
  { id: '9', agent_id: '3', feature_name: 'Code Review', feature_category: 'Core', is_supported: true },
  { id: '10', agent_id: '3', feature_name: 'Performance Optimization', feature_category: 'Core', is_supported: true },
  { id: '11', agent_id: '3', feature_name: 'Security Scanning', feature_category: 'Security', is_supported: true },
  { id: '12', agent_id: '3', feature_name: 'Team Collaboration', feature_category: 'Collaboration', is_supported: true }
];

const mockMetrics: AgentMetric[] = [
  { id: '1', agent_id: '1', metric_name: 'Response Time', metric_value: 1.2, metric_unit: 'seconds', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '2', agent_id: '1', metric_name: 'Accuracy', metric_value: 94.5, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '3', agent_id: '1', metric_name: 'Uptime', metric_value: 99.9, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '4', agent_id: '2', metric_name: 'Response Time', metric_value: 0.8, metric_unit: 'seconds', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '5', agent_id: '2', metric_name: 'Accuracy', metric_value: 91.2, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '6', agent_id: '2', metric_name: 'Uptime', metric_value: 98.7, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '7', agent_id: '3', metric_name: 'Response Time', metric_value: 2.1, metric_unit: 'seconds', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '8', agent_id: '3', metric_name: 'Accuracy', metric_value: 96.8, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' },
  { id: '9', agent_id: '3', metric_name: 'Uptime', metric_value: 99.5, metric_unit: 'percent', period_start: '2024-02-01', period_end: '2024-02-29', created_at: '2024-02-29' }
];

const mockReviews: AgentReview[] = [
  { id: '1', agent_id: '1', user_id: 'user1', user_name: 'John D.', rating: 5, title: 'Excellent tool!', content: 'Great for data analysis', helpful_count: 12, created_at: '2024-02-15' },
  { id: '2', agent_id: '1', user_id: 'user2', user_name: 'Sarah M.', rating: 4, title: 'Very useful', content: 'Good features but could be faster', helpful_count: 8, created_at: '2024-02-10' },
  { id: '3', agent_id: '2', user_id: 'user3', user_name: 'Mike R.', rating: 5, title: 'Amazing writing assistant', content: 'Saves me hours of work', helpful_count: 15, created_at: '2024-02-12' },
  { id: '4', agent_id: '3', user_id: 'user4', user_name: 'Lisa K.', rating: 5, title: 'Code quality improved', content: 'Excellent for code reviews', helpful_count: 20, created_at: '2024-02-14' }
];

export default function AgentComparisonDashboard({
  initialAgentIds = [],
  maxComparisons = 4,
  enableExport = true,
  enableSave = true,
  className = ''
}: AgentComparisonDashboardProps) {
  // State
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(initialAgentIds);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [features, setFeatures] = useState<AgentFeature[]>([]);
  const [metrics, setMetrics] = useState<AgentMetric[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showFilters, setShowFilters] = useState(false);

  // Form
  const { register, watch, setValue, reset } = useForm<ComparisonFilters>({
    defaultValues: {
      search: '',
      categories: [],
      pricing_models: [],
      min_rating: 0,
      features: []
    }
  });

  const filters = watch();

  // Load data
  useEffect(() => {
    loadData();
  }, [selectedAgentIds]);

  const loadData = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from Supabase
      const selectedAgents = mockAgents.filter(agent => 
        selectedAgentIds.length === 0 || selectedAgentIds.includes(agent.id)
      );
      
      setAgents(selectedAgents);
      setFeatures(mockFeatures.filter(f => selectedAgentIds.includes(f.agent_id)));
      setMetrics(mockMetrics.filter(m => selectedAgentIds.includes(m.agent_id)));
      setReviews(mockReviews.filter(r => selectedAgentIds.includes(r.agent_id)));
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const availableAgents = useMemo(() => {
    return mockAgents.filter(agent => {
      if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.categories.length && !filters.categories.includes(agent.category)) {
        return false;
      }
      if (filters.pricing_models.length && !filters.pricing_models.includes(agent.pricing_model)) {
        return false;
      }
      if (filters.min_rating && agent.rating < filters.min_rating) {
        return false;
      }
      return true;
    });
  }, [filters]);

  const featureMatrix = useMemo(() => {
    const allFeatures = Array.from(
      new Set(features.map(f => f.feature_name))
    ).sort();

    return allFeatures.map(featureName => {
      const row: any = { feature: featureName };
      agents.forEach(agent => {
        const feature = features.find(f => 
          f.agent_id === agent.id && f.feature_name === featureName
        );
        row[agent.id] = feature?.is_supported ? 'Yes' : 'No';
        if (feature?.feature_limit) {
          row[agent.id] += ` (${feature.feature_limit})`;
        }
      });
      return row;
    });
  }, [agents, features]);

  const performanceData = useMemo(() => {
    const metricNames = Array.from(new Set(metrics.map(m => m.metric_name)));
    return metricNames.map(metricName => {
      const dataPoint: any = { metric: metricName };
      agents.forEach(agent => {
        const metric = metrics.find(m => 
          m.agent_id === agent.id && m.metric_name === metricName
        );
        dataPoint[agent.name] = metric?.metric_value || 0;
      });
      return dataPoint;
    });
  }, [agents, metrics]);

  const radarData = useMemo(() => {
    return agents.map(agent => {
      const agentMetrics = metrics.filter(m => m.agent_id === agent.id);
      return {
        agent: agent.name,
        'Response Time': 100 - (agentMetrics.find(m => m.metric_name === 'Response Time')?.metric_value || 0) * 20,
        'Accuracy': agentMetrics.find(m => m.metric_name === 'Accuracy')?.metric_value || 0,
        'Uptime': agentMetrics.find(m => m.metric_name === 'Uptime')?.metric_value || 0,
        'Rating': agent.rating * 20,
        'Popularity': Math.min(agent.total_installs / 10, 100)
      };
    });
  }, [agents, metrics]);

  // Actions
  const addAgent = (agentId: string) => {
    if (selectedAgentIds.length < maxComparisons && !selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const removeAgent = (agentId: string) => {
    setSelectedAgentIds(selectedAgentIds.filter(id => id !== agentId));
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Agent Comparison Report', 20, 20);
    
    // Add agents summary
    let yPosition = 40;
    agents.forEach((agent, index) => {
      doc.text(`${index + 1}. ${agent.name} - ${agent.category}`, 20, yPosition);
      doc.text(`   Price: $${agent.base_price} | Rating: ${agent.rating}/5`, 20, yPosition + 10);
      yPosition += 20;
    });

    // Add feature matrix (simplified)
    yPosition += 10;
    doc.text('Feature Comparison:', 20, yPosition);
    yPosition += 10;

    const tableData = featureMatrix.slice(0, 10).map(row => [
      row.feature,
      ...agents.map(agent => row[agent.id] || 'N/A')
    ]);

    (doc as any).autoTable({
      head: [['Feature', ...agents.map(a => a.name)]],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] }
    });

    doc.save('agent-comparison.pdf');
  };

  const exportToCSV = () => {
    const csvData = [
      ['Feature', ...agents.map(a => a.name)],
      ...featureMatrix.map(row => [
        row.feature,
        ...agents.map(agent => row[agent.id] || 'N/A')
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-comparison.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const saveComparison = async () => {
    // In real implementation, save to Supabase
    console.log('Saving comparison:', selectedAgentIds);
    // Show success toast
  };

  const shareComparison = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('agents', selectedAgentIds.join(','));
    navigator.clipboard.writeText(url.toString());
    // Show success toast
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Agent Comparison Dashboard</CardTitle>
              <p className="text-muted-foreground mt-2">
                Compare AI agents side-by-side to find the perfect solution for your needs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              {enableExport && (
                <Select onValueChange={(value) => {
                  if (value === 'pdf') exportToPDF();
                  if (value === 'csv') exportToCSV();
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Export" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        CSV
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              {enableSave && (
                <Button variant="outline" size="sm" onClick={saveComparison}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={shareComparison}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filters */}
        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Agents</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name..."
                    className="pl-10"
                    {...register('search')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(value) => {
                  const current = filters.categories;
                  if (current.includes(value)) {
                    setValue('categories', current.filter(c => c !== value));
                  } else {
                    setValue('categories', [...current, value]);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectT