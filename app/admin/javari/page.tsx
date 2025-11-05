/**
 * Javari AI - Admin Overview Dashboard
 * Main control center for all Javari autonomous operations
 * 
 * Created: November 4, 2025 - 7:40 PM EST
 * Part of Phase 3: Admin Dashboard Integration
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Sparkles,
  Activity, 
  Brain, 
  GitCommit,
  Rocket,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface SystemStatus {
  selfHealing: {
    total: number;
    successful: number;
    successRate: number;
    lastRun: string;
  };
  learning: {
    total: number;
    avgConfidence: number;
    sources: number;
  };
  deployments: {
    total: number;
    successful: number;
    lastDeployment: string;
  };
  github: {
    totalCommits: number;
    autoCommits: number;
    lastCommit: string;
  };
}

export default function JavariOverview() {
  const [status, setStatus] = useState<SystemStatus>({
    selfHealing: {
      total: 0,
      successful: 0,
      successRate: 0,
      lastRun: new Date().toISOString()
    },
    learning: {
      total: 0,
      avgConfidence: 0,
      sources: 0
    },
    deployments: {
      total: 0,
      successful: 0,
      lastDeployment: new Date().toISOString()
    },
    github: {
      totalCommits: 0,
      autoCommits: 0,
      lastCommit: new Date().toISOString()
    }
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const response = await fetch('/api/admin/javari/overview');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  }

  const healthIndicators = [
    {
      name: 'Self-Healing',
      status: status.selfHealing.successRate >= 70 ? 'healthy' : 'warning',
      value: `${status.selfHealing.successRate.toFixed(1)}%`,
      description: 'Auto-fix success rate',
      link: '/admin/javari/self-healing'
    },
    {
      name: 'Learning',
      status: status.learning.sources >= 3 ? 'healthy' : 'warning',
      value: status.learning.total.toString(),
      description: 'Total learnings',
      link: '/admin/javari/learning'
    },
    {
      name: 'Deployments',
      status: 'healthy',
      value: status.deployments.total.toString(),
      description: 'Successful deployments',
      link: '/admin/javari/deployments'
    },
    {
      name: 'GitHub',
      status: 'healthy',
      value: status.github.autoCommits.toString(),
      description: 'Autonomous commits',
      link: '/admin/javari/github'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-600" />
              Javari AI Control Center
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor and control all autonomous operations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-sm font-medium">{lastUpdate.toLocaleTimeString()}</p>
            </div>
            <Button onClick={loadStatus} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Status Banner */}
        <Card className="border-l-4 border-l-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  All Systems Operational
                </h3>
                <p className="text-sm text-gray-600">
                  Javari is fully autonomous and performing optimally
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthIndicators.map((indicator) => (
            <Link key={indicator.name} href={indicator.link}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {indicator.name}
                    </CardTitle>
                    <div className={`w-3 h-3 rounded-full ${
                      indicator.status === 'healthy' ? 'bg-green-500' :
                      indicator.status === 'warning' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {indicator.value}
                  </div>
                  <p className="text-xs text-gray-500">{indicator.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Main Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Self-Healing Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    Self-Healing
                  </CardTitle>
                  <CardDescription>Autonomous error detection and fixing</CardDescription>
                </div>
                <Link href="/admin/javari/self-healing">
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Events</span>
                <Badge variant="outline">{status.selfHealing.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Successful Fixes</span>
                <Badge className="bg-green-100 text-green-700">
                  {status.selfHealing.successful}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <Badge className={
                  status.selfHealing.successRate >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }>
                  {status.selfHealing.successRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Run</span>
                <span className="text-sm text-gray-900">
                  {new Date(status.selfHealing.lastRun).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Learning Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Continuous Learning
                  </CardTitle>
                  <CardDescription>Knowledge base and data sources</CardDescription>
                </div>
                <Link href="/admin/javari/learning">
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Learnings</span>
                <Badge variant="outline">{status.learning.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Sources</span>
                <Badge className="bg-blue-100 text-blue-700">
                  {status.learning.sources}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Avg Confidence</span>
                <Badge className="bg-purple-100 text-purple-700">
                  {(status.learning.avgConfidence * 100).toFixed(1)}%
                </Badge>
              </div>
              <div className="pt-2">
                <Link href="/admin/javari/learning">
                  <Button size="sm" variant="outline" className="w-full">
                    Feed Knowledge
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* GitHub Activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitCommit className="w-5 h-5 text-green-600" />
                    GitHub Activity
                  </CardTitle>
                  <CardDescription>Autonomous code commits</CardDescription>
                </div>
                <Link href="/admin/javari/github">
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Commits</span>
                <Badge variant="outline">{status.github.totalCommits}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Autonomous Commits</span>
                <Badge className="bg-green-100 text-green-700">
                  {status.github.autoCommits}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Commit</span>
                <span className="text-sm text-gray-900">
                  {new Date(status.github.lastCommit).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Deployment Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-orange-600" />
                    Deployments
                  </CardTitle>
                  <CardDescription>Autonomous deployment activity</CardDescription>
                </div>
                <Link href="/admin/javari/deployments">
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Deployments</span>
                <Badge variant="outline">{status.deployments.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Successful</span>
                <Badge className="bg-green-100 text-green-700">
                  {status.deployments.successful}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Deployment</span>
                <span className="text-sm text-gray-900">
                  {new Date(status.deployments.lastDeployment).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <span className="font-semibold">Trigger Healing Check</span>
                <span className="text-xs text-gray-500">Run error detection now</span>
              </Button>

              <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Feed Knowledge</span>
                <span className="text-xs text-gray-500">Add manual insights</span>
              </Button>

              <Button variant="outline" className="h-auto py-4 flex flex-col items-start gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="font-semibold">View Analytics</span>
                <span className="text-xs text-gray-500">Performance metrics</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
