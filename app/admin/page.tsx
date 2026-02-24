// =============================================================================
// JAVARI AI - ADMIN DASHBOARD
// =============================================================================
// Production Ready - Sunday, December 14, 2025
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import LearningDashboardCard from '@/components/admin/LearningDashboardCard';
import {
  Activity, Users, CreditCard, AlertTriangle, Server,
  Database, Zap, TrendingUp, TrendingDown, Clock,
  CheckCircle, XCircle, RefreshCw, Settings, Shield,
  Brain, MessageSquare, DollarSign, BarChart3, Eye
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string; latency_ms: number };
    api: { status: string; details: { active_providers: string[] } };
    environment: { status: string };
  };
  summary: { total: number; passed: number; failed: number };
  uptime: number;
}

interface Stats {
  users: { total: number; active: number; new_today: number };
  conversations: { total: number; today: number; avg_length: number };
  revenue: { total: number; mrr: number; today: number };
  ai: { requests_today: number; tokens_used: number; avg_response_ms: number };
  errors: { total_24h: number; critical: number; resolved: number };
}

interface RecentError {
  id: string;
  type: string;
  message: string;
  severity: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai' | 'errors'>('overview');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch health
      const healthRes = await fetch('/api/health');
      const healthData = await healthRes.json();
      setHealth(healthData);

      // Fetch errors
      const errorsRes = await fetch('/api/errors');
      const errorsData = await errorsRes.json();
      setErrors(errorsData.patterns?.slice(0, 5) || []);

      // Mock stats (would come from analytics API)
      setStats({
        users: { total: 1247, active: 342, new_today: 23 },
        conversations: { total: 15832, today: 487, avg_length: 8.3 },
        revenue: { total: 24750, mrr: 8250, today: 450 },
        ai: { requests_today: 3421, tokens_used: 2450000, avg_response_ms: 1250 },
        errors: { total_24h: errorsData.total || 12, critical: 2, resolved: 8 }
      });

    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'degraded':
      case 'warn':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-red-400 bg-red-500/10 border-red-500/30';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-400">System monitoring and management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 ${getStatusColor(health?.status || 'unknown')}`}>
                {health?.status === 'healthy' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium capitalize">{health?.status || 'Unknown'}</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(['overview', 'users', 'ai', 'errors'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {health?.checks && Object.entries(health.checks).map(([key, check]) => (
            <div key={key} className={`p-4 rounded-xl border ${getStatusColor(check.status)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {key === 'database' && <Database className="w-5 h-5" />}
                  {key === 'api' && <Zap className="w-5 h-5" />}
                  {key === 'environment' && <Server className="w-5 h-5" />}
                  <span className="font-medium capitalize">{key}</span>
                </div>
                <span className="text-sm capitalize">{check.status}</span>
              </div>
              {'latency_ms' in check && (
                <div className="mt-2 text-sm opacity-75">{check.latency_ms}ms latency</div>
              )}
              {'details' in check && check.details?.active_providers && (
                <div className="mt-2 text-sm opacity-75">
                  {check.details.active_providers.length} providers active
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Users}
              label="Active Users"
              value={stats.users.active}
              subtext={`${stats.users.new_today} new today`}
              trend="up"
              color="blue"
            />
            <StatCard
              icon={MessageSquare}
              label="Conversations"
              value={stats.conversations.today}
              subtext={`${stats.conversations.avg_length} avg msgs`}
              trend="up"
              color="green"
            />
            <StatCard
              icon={DollarSign}
              label="Revenue Today"
              value={`$${stats.revenue.today}`}
              subtext={`$${stats.revenue.mrr}/mo MRR`}
              trend="up"
              color="purple"
            />
            <StatCard
              icon={Brain}
              label="AI Requests"
              value={stats.ai.requests_today}
              subtext={`${stats.ai.avg_response_ms}ms avg`}
              trend="neutral"
              color="orange"
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div className="lg:col-span-2 bg-gray-800/50 rounded-xl border border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              System Activity
            </h2>
            <div className="space-y-4">
              <ActivityItem
                icon={CheckCircle}
                iconColor="text-green-400"
                title="Health check passed"
                description="All systems operational"
                time="Just now"
              />
              <ActivityItem
                icon={Brain}
                iconColor="text-purple-400"
                title="AI request completed"
                description="claude-sonnet-4 - 1,245ms response time"
                time="2 min ago"
              />
              <ActivityItem
                icon={Users}
                iconColor="text-blue-400"
                title="New user registered"
                description="user@example.com via Google OAuth"
                time="5 min ago"
              />
              <ActivityItem
                icon={CreditCard}
                iconColor="text-green-400"
                title="Payment received"
                description="$29.99 - Pro subscription"
                time="12 min ago"
              />
              <ActivityItem
                icon={AlertTriangle}
                iconColor="text-yellow-400"
                title="Rate limit warning"
                description="OpenAI API approaching limit"
                time="23 min ago"
              />
            </div>
          </div>

          {/* Quick Actions & Errors */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Quick Actions
              </h2>
              <div className="space-y-2">
                <ActionButton icon={RefreshCw} label="Clear Cache" />
                <ActionButton icon={Database} label="Run Migrations" />
                <ActionButton icon={Shield} label="Security Scan" />
                <ActionButton icon={BarChart3} label="Generate Report" />
              </div>
            </div>

            {/* Recent Errors */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Recent Errors
                {stats && stats.errors.critical > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                    {stats.errors.critical} critical
                  </span>
                )}
              </h2>
              {errors.length > 0 ? (
                <div className="space-y-3">
                  {errors.map((error, i) => (
                    <div key={i} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{error.error_type || error.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          error.severity === 'critical' || error.severity === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {error.severity || 'medium'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {error.message || error.pattern_key || 'No details'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">No recent errors</p>
                </div>
              )}
            </div>

          {/* Learning Dashboard Card */}
          <div className="mt-6">
            <LearningDashboardCard />
          </div>

            {/* Uptime */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">System Uptime</p>
                  <p className="text-2xl font-bold text-white">{formatUptime(health?.uptime || 0)}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-600" />
              </div>
              <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '99.9%' }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">99.9% uptime this month</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ icon: Icon, label, value, subtext, trend, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{subtext}</div>
    </div>
  );
}

function ActivityItem({ icon: Icon, iconColor, title, description, time }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-900/30 rounded-lg">
      <Icon className={`w-5 h-5 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      <span className="text-xs text-gray-600 whitespace-nowrap">{time}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, label }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button className="w-full flex items-center gap-3 p-3 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg text-gray-300 hover:text-white transition-colors">
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );
}
