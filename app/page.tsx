// app/page.tsx
// CR AUDIOVIZ AI - Javari AI Main Dashboard
// Session: Tuesday, October 28, 2025 - 11:58 AM EST
// Purpose: Main dashboard with project overview, health metrics, and quick actions

'use client';

import { useEffect, useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Code2, 
  Folder, 
  GitBranch,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Star,
  TrendingUp,
  Zap
} from 'lucide-react';
import Link from 'next/link';

interface ProjectHealth {
  project_id: string;
  name: string;
  health_score: number;
  active_chats: number;
  total_subprojects: number;
  starred: boolean;
  last_activity: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface RecentActivity {
  id: string;
  type: 'chat' | 'build' | 'suggestion' | 'review';
  title: string;
  description: string;
  time: string;
  status: 'success' | 'pending' | 'error';
}

interface QuickStat {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

export default function JavariDashboard() {
  const [projects, setProjects] = useState<ProjectHealth[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load projects with health scores
      // TODO: Replace with real API calls when tables are migrated
      const mockProjects: ProjectHealth[] = [
        {
          project_id: '1',
          name: 'CR AudioViz AI Website',
          health_score: 95,
          active_chats: 3,
          total_subprojects: 8,
          starred: true,
          last_activity: '5 minutes ago',
          status: 'healthy'
        },
        {
          project_id: '2',
          name: 'Javari AI Platform',
          health_score: 88,
          active_chats: 1,
          total_subprojects: 5,
          starred: true,
          last_activity: '2 hours ago',
          status: 'healthy'
        },
        {
          project_id: '3',
          name: 'Gaming Platform',
          health_score: 72,
          active_chats: 0,
          total_subprojects: 3,
          starred: false,
          last_activity: '1 day ago',
          status: 'warning'
        }
      ];

      // Mock recent activity
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'chat',
          title: 'Fixed build errors in website',
          description: 'Added force-dynamic exports to API routes',
          time: '5 minutes ago',
          status: 'success'
        },
        {
          id: '2',
          type: 'build',
          title: 'Deployment successful',
          description: 'craudiovizai-website deployed to production',
          time: '1 hour ago',
          status: 'success'
        },
        {
          id: '3',
          type: 'suggestion',
          title: 'Code optimization suggested',
          description: 'Reduce bundle size by implementing code splitting',
          time: '2 hours ago',
          status: 'pending'
        }
      ];

      // Mock quick stats
      const mockStats: QuickStat[] = [
        {
          label: 'Active Projects',
          value: '14',
          change: '+2 this week',
          trend: 'up',
          icon: <Folder className="w-5 h-5" />
        },
        {
          label: 'Open Chats',
          value: '4',
          change: 'No change',
          trend: 'neutral',
          icon: <MessageSquare className="w-5 h-5" />
        },
        {
          label: 'Health Score',
          value: '85%',
          change: '+3% vs last week',
          trend: 'up',
          icon: <Heart className="w-5 h-5" />
        },
        {
          label: 'Code Reviews',
          value: '0',
          change: 'All clear',
          trend: 'neutral',
          icon: <Code2 className="w-5 h-5" />
        }
      ];

      setProjects(mockProjects);
      setRecentActivity(mockActivity);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getHealthIcon = (status: ProjectHealth['status']) => {
    if (status === 'healthy') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'warning') return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'chat': return <MessageSquare className="w-4 h-4" />;
      case 'build': return <Zap className="w-4 h-4" />;
      case 'suggestion': return <TrendingUp className="w-4 h-4" />;
      case 'review': return <Code2 className="w-4 h-4" />;
    }
  };

  const getActivityStatusColor = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Javari AI Dashboard</h1>
            <p className="text-gray-600 mt-1">Autonomous development companion for CR AudioViz AI</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  {stat.icon}
                </div>
                {stat.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                {stat.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className="text-xs text-gray-500">{stat.change}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Health */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Projects Health</h2>
                <Link href="/projects" className="text-sm text-purple-600 hover:text-purple-700">
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {projects.map((project) => (
                <Link
                  key={project.project_id}
                  href={`/projects/${project.project_id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      {project.starred && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                        <p className="text-sm text-gray-500">Last activity: {project.last_activity}</p>
                      </div>
                    </div>
                    {getHealthIcon(project.status)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Folder className="w-4 h-4" />
                      <span>{project.total_subprojects} subprojects</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span>{project.active_chats} active chats</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4" />
                      <span>{project.health_score}% health</span>
                    </div>
                  </div>

                  {/* Health Score Bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          project.health_score >= 90 ? 'bg-green-500' :
                          project.health_score >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${project.health_score}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6 space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'pending' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}>
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {activity.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/chat"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-100">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Start Chat</h3>
                <p className="text-xs text-gray-500">New conversation</p>
              </div>
            </Link>

            <Link
              href="/projects"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Projects</h3>
                <p className="text-xs text-gray-500">Manage projects</p>
              </div>
            </Link>

            <Link
              href="/health"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="p-2 bg-green-50 rounded-lg text-green-600 group-hover:bg-green-100">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Health Monitor</h3>
                <p className="text-xs text-gray-500">System health</p>
              </div>
            </Link>

            <Link
              href="/settings"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="p-2 bg-gray-100 rounded-lg text-gray-600 group-hover:bg-gray-200">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Settings</h3>
                <p className="text-xs text-gray-500">Configure Javari</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
