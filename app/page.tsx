'use client';

import { useState } from 'react';

export default function JavariDashboard() {
  const [stats] = useState({
    totalProjects: 0,
    activeChats: 0,
    healthScore: 100,
    buildsToday: 0
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🤖</div>
              <div>
                <h1 className="text-3xl font-bold text-white">Javari AI</h1>
                <p className="text-blue-300">Autonomous Development Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-medium">Operational</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
            <div className="text-blue-400 text-sm font-medium mb-2">Total Projects</div>
            <div className="text-4xl font-bold text-white">{stats.totalProjects}</div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-green-500/20 p-6">
            <div className="text-green-400 text-sm font-medium mb-2">Active Chats</div>
            <div className="text-4xl font-bold text-white">{stats.activeChats}</div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
            <div className="text-purple-400 text-sm font-medium mb-2">Health Score</div>
            <div className="text-4xl font-bold text-white">{stats.healthScore}</div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-orange-500/20 p-6">
            <div className="text-orange-400 text-sm font-medium mb-2">Builds Today</div>
            <div className="text-4xl font-bold text-white">{stats.buildsToday}</div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-blue-500/20 p-8 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-white mb-4">Javari AI is Operational!</h2>
          <p className="text-gray-400 mb-6">
            Your autonomous development assistant is ready to help you build, monitor, and optimize your projects.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-semibold text-white mb-1">Project Tracking</h3>
              <p className="text-sm text-gray-400">Monitor all your projects in one place</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="text-2xl mb-2">🏥</div>
              <h3 className="font-semibold text-white mb-1">Health Monitoring</h3>
              <p className="text-sm text-gray-400">Real-time build health tracking</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="font-semibold text-white mb-1">Self-Healing</h3>
              <p className="text-sm text-gray-400">Auto-fix build errors automatically</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/30 backdrop-blur-sm border-t border-blue-500/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            Javari AI • Built for CR AudioViz AI • Powered by Next.js, TypeScript & Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
