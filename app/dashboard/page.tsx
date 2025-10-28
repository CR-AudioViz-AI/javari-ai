'use client';

import { useState, useEffect } from 'react';
import { WorkLogStats } from '@/components/work/WorkLogStats';
import { HealthDashboard } from '@/components/health/HealthDashboard';
import { ScrollingPromptBar } from '@/components/prompts/ScrollingPromptBar';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CodeIcon,
  FileIcon,
  SparklesIcon,
  TrendingUpIcon,
  WrenchIcon,
  PackageIcon,
  EyeIcon,
} from 'lucide-react';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchOverview();
  }, []);
  
  const fetchOverview = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, fetch actual data from APIs
      // For now, showing the structure
      const mockData = {
        totalProjects: 14,
        activeSessions: 3,
        totalWorkLogs: 127,
        buildsPassing: 12,
        buildsFailing: 2,
        outdatedDeps: 8,
        vulnerableDeps: 3,
        pendingReviews: 5,
        pendingSuggestions: 12,
      };
      
      setOverview(mockData);
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <ActivityIcon className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Javari AI Dashboard</h1>
              <p className="text-lg text-blue-100">
                Your autonomous AI development assistant
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-green-500/20 backdrop-blur rounded-lg text-sm font-medium">
                ● System Healthy
              </span>
              <button className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg font-semibold transition-colors">
                New Chat
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 -mt-6">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Projects */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <CodeIcon className="w-8 h-8 text-blue-600" />
              <span className="text-3xl font-bold text-gray-900">{overview?.totalProjects || 0}</span>
            </div>
            <p className="text-sm font-medium text-gray-600">Total Projects</p>
            <p className="text-xs text-gray-500 mt-1">
              {overview?.activeSessions || 0} active sessions
            </p>
          </div>
          
          {/* Work Logs */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <FileIcon className="w-8 h-8 text-green-600" />
              <span className="text-3xl font-bold text-gray-900">{overview?.totalWorkLogs || 0}</span>
            </div>
            <p className="text-sm font-medium text-gray-600">Work Logs</p>
            <p className="text-xs text-green-600 mt-1 font-medium">+24 this week</p>
          </div>
          
          {/* Build Health */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
              <span className="text-3xl font-bold text-gray-900">{overview?.buildsPassing || 0}</span>
            </div>
            <p className="text-sm font-medium text-gray-600">Builds Passing</p>
            {overview?.buildsFailing > 0 && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                {overview.buildsFailing} failing
              </p>
            )}
          </div>
          
          {/* Dependencies */}
          <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <PackageIcon className="w-8 h-8 text-purple-600" />
              <span className="text-3xl font-bold text-gray-900">{overview?.outdatedDeps || 0}</span>
            </div>
            <p className="text-sm font-medium text-gray-600">Outdated Deps</p>
            {overview?.vulnerableDeps > 0 && (
              <p className="text-xs text-orange-600 mt-1 font-medium">
                {overview.vulnerableDeps} vulnerable
              </p>
            )}
          </div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Health & Alerts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Build Health */}
            <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Build Health</h2>
                <WrenchIcon className="w-5 h-5 text-gray-600" />
              </div>
              <HealthDashboard autoRefresh={true} refreshInterval={60000} />
            </div>
            
            {/* Work Log Stats */}
            <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Work Activity</h2>
                <ActivityIcon className="w-5 h-5 text-gray-600" />
              </div>
              <WorkLogStats autoRefresh={true} />
            </div>
          </div>
          
          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Pending Reviews */}
            <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Pending Reviews</h3>
                <EyeIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auth API</p>
                    <p className="text-xs text-gray-600">Security concerns</p>
                  </div>
                  <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full">
                    Urgent
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Payment Flow</p>
                    <p className="text-xs text-gray-600">High complexity</p>
                  </div>
                  <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full">
                    High
                  </span>
                </div>
                <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2">
                  View All Reviews →
                </button>
              </div>
            </div>
            
            {/* Smart Suggestions */}
            <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Smart Suggestions</h3>
                <SparklesIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Optimize Bundle Size
                  </p>
                  <p className="text-xs text-gray-600">
                    Reduce bundle by 30% with code splitting
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-purple-600 font-medium">
                      High confidence
                    </span>
                    <span className="text-xs text-gray-500">2h effort</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Add Error Boundaries
                  </p>
                  <p className="text-xs text-gray-600">
                    Improve error handling in React components
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-blue-600 font-medium">
                      Medium confidence
                    </span>
                    <span className="text-xs text-gray-500">3h effort</span>
                  </div>
                </div>
                <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2">
                  View All Suggestions →
                </button>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-xl p-6 text-white">
              <h3 className="font-bold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-4 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-colors font-medium">
                  📝 New Work Log
                </button>
                <button className="w-full text-left px-4 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-colors font-medium">
                  🔍 Run Security Scan
                </button>
                <button className="w-full text-left px-4 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-colors font-medium">
                  📦 Check Dependencies
                </button>
                <button className="w-full text-left px-4 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg transition-colors font-medium">
                  🚀 Deploy Latest
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { action: 'Created API endpoint', time: '2 min ago', icon: '✅', color: 'green' },
              { action: 'Fixed TypeScript error', time: '15 min ago', icon: '🔧', color: 'blue' },
              { action: 'Updated dependencies', time: '1 hour ago', icon: '📦', color: 'purple' },
              { action: 'Deployed to production', time: '2 hours ago', icon: '🚀', color: 'emerald' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{item.action}</p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
                <TrendingUpIcon className={`w-4 h-4 text-${item.color}-600`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Scrolling Prompt Bar */}
      <ScrollingPromptBar 
        onPromptClick={(prompt) => {
          console.log('User clicked prompt:', prompt);
          // In real implementation, insert into chat input or copy to clipboard
        }}
      />
    </div>
  );
}
