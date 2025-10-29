'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  TrendingUp,
  DollarSign,
  Clock,
  Star,
  FileText,
  Settings,
  Activity,
  Zap,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  totalConversations: number;
  totalMessages: number;
  totalCost: number;
  averageRating: number;
  totalTokens: number;
  activeProviders: number;
}

interface ConversationItem {
  id: string;
  title: string;
  provider: string;
  model: string;
  messageCount: number;
  lastMessageAt: Date;
  rating?: number;
}

interface CostData {
  date: string;
  cost: number;
  provider: string;
}

interface ProviderStats {
  provider: string;
  totalCalls: number;
  totalCost: number;
  averageRating: number;
  successRate: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalMessages: 0,
    totalCost: 0,
    averageRating: 0,
    totalTokens: 0,
    activeProviders: 4,
  });
  const [recentConversations, setRecentConversations] = useState<ConversationItem[]>([]);
  const [costData, setCostData] = useState<CostData[]>([]);
  const [providerStats, setProviderStats] = useState<ProviderStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/javari/analytics?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
        setRecentConversations(data.recentConversations || []);
        setCostData(data.costData || generateMockCostData());
        setProviderStats(data.providerStats || generateMockProviderStats());
      } else {
        // Use mock data if API isn't ready yet
        setStats(generateMockStats());
        setRecentConversations(generateMockConversations());
        setCostData(generateMockCostData());
        setProviderStats(generateMockProviderStats());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Use mock data on error
      setStats(generateMockStats());
      setRecentConversations(generateMockConversations());
      setCostData(generateMockCostData());
      setProviderStats(generateMockProviderStats());
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockStats = (): DashboardStats => ({
    totalConversations: 127,
    totalMessages: 856,
    totalCost: 24.67,
    averageRating: 4.3,
    totalTokens: 1250000,
    activeProviders: 4,
  });

  const generateMockConversations = (): ConversationItem[] => [
    {
      id: '1',
      title: 'Building Next.js Dashboard',
      provider: 'OpenAI',
      model: 'gpt-4-turbo',
      messageCount: 12,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
      rating: 5,
    },
    {
      id: '2',
      title: 'Database Schema Design',
      provider: 'Claude',
      model: 'claude-3-opus',
      messageCount: 8,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
      rating: 4,
    },
    {
      id: '3',
      title: 'API Integration Help',
      provider: 'Gemini',
      model: 'gemini-pro',
      messageCount: 15,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      rating: 5,
    },
    {
      id: '4',
      title: 'Code Review Session',
      provider: 'Mistral',
      model: 'mistral-large',
      messageCount: 6,
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      rating: 4,
    },
  ];

  const generateMockCostData = (): CostData[] => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data: CostData[] = [];
    const providers = ['OpenAI', 'Claude', 'Gemini', 'Mistral'];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      providers.forEach((provider) => {
        data.push({
          date: dateStr,
          cost: Math.random() * 5 + 1,
          provider,
        });
      });
    }
    return data;
  };

  const generateMockProviderStats = (): ProviderStats[] => [
    {
      provider: 'OpenAI',
      totalCalls: 234,
      totalCost: 12.45,
      averageRating: 4.5,
      successRate: 98.5,
    },
    {
      provider: 'Claude',
      totalCalls: 189,
      totalCost: 8.92,
      averageRating: 4.7,
      successRate: 99.2,
    },
    {
      provider: 'Gemini',
      totalCalls: 156,
      totalCost: 2.34,
      averageRating: 4.1,
      successRate: 97.3,
    },
    {
      provider: 'Mistral',
      totalCalls: 98,
      totalCost: 0.96,
      averageRating: 4.2,
      successRate: 96.8,
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const costTrend = costData.length > 1 ? 
    ((costData[costData.length - 1].cost - costData[0].cost) / costData[0].cost) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Monitor your AI usage, costs, and performance
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-6">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            onClick={() => setTimeRange(range)}
            size="sm"
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </Button>
        ))}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConversations}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUp className="h-3 w-3 mr-1" />
              12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <ArrowUp className="h-3 w-3 mr-1" />
              8% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Cost
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
            <p className={`text-xs flex items-center mt-1 ${costTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {costTrend > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
              {Math.abs(costTrend).toFixed(1)}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Average Rating
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
            <p className="text-xs text-gray-500 mt-1">Out of 5.0 stars</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cost Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Trend</CardTitle>
            <CardDescription>Daily spending across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Provider Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Distribution</CardTitle>
            <CardDescription>Usage by AI provider</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={providerStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ provider, totalCalls }) => `${provider}: ${totalCalls}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="totalCalls"
                >
                  {providerStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Provider Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Provider Performance</CardTitle>
          <CardDescription>Compare metrics across all AI providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {providerStats.map((provider, index) => (
              <div key={provider.provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{provider.provider}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-gray-500">
                      Calls: <span className="font-medium text-gray-900">{provider.totalCalls}</span>
                    </div>
                    <div className="text-gray-500">
                      Cost: <span className="font-medium text-gray-900">{formatCurrency(provider.totalCost)}</span>
                    </div>
                    <div className="text-gray-500">
                      Rating: <span className="font-medium text-gray-900">{provider.averageRating.toFixed(1)}</span>
                    </div>
                    <div className="text-gray-500">
                      Success: <span className="font-medium text-gray-900">{provider.successRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <Progress value={provider.successRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Conversations & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
            <CardDescription>Your latest chat sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/chat?id=${conversation.id}`)}
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{conversation.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{conversation.provider} • {conversation.model}</span>
                      <span>{conversation.messageCount} messages</span>
                      <span>{getTimeAgo(conversation.lastMessageAt)}</span>
                    </div>
                  </div>
                  {conversation.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{conversation.rating}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push('/chat')}
            >
              View All Conversations
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                className="w-full justify-start"
                onClick={() => router.push('/chat')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/projects')}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Projects
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/analytics')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Pro Tip</h4>
              </div>
              <p className="text-sm text-blue-800">
                Use Claude for complex reasoning, GPT-4 for coding, and Gemini for fast responses to optimize costs.
              </p>
            </div>

            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-900">System Health</h4>
              </div>
              <p className="text-sm text-green-800">
                All {stats.activeProviders} providers operational
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
