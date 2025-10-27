'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/javari/ChatInterface';
import { ProjectManager } from '@/components/javari/ProjectManager';
import { BuildHealthMonitor } from '@/components/javari/BuildHealthMonitor';
import { Settings } from '@/components/javari/Settings';

type TabType = 'chat' | 'projects' | 'health' | 'settings';

interface Stats {
  totalProjects: number;
  activeChats: number;
  healthScore: number;
  buildsToday: number;
}

export default function JavariDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [stats, setStats] = useState<Stats>({
    totalProjects: 0,
    activeChats: 0,
    healthScore: 100,
    buildsToday: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalProjects: data.totalProjects || 0,
            activeChats: data.activeChats || 0,
            healthScore: data.overallHealth || 100,
            buildsToday: data.buildsToday || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'chat' as TabType, name: 'AI Chat', icon: '💬' },
    { id: 'projects' as TabType, name: 'Projects', icon: '📊' },
    { id: 'health' as TabType, name: 'Health', icon: '🏥' },
    { id: 'settings' as TabType, name: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🤖</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Javari AI</h1>
                <p className="text-sm text-blue-300">Autonomous Development Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Stats Mini Display */}
              <div className="hidden md:flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Projects:</span>
                  <span className="text-white font-semibold">{stats.totalProjects}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Chats:</span>
                  <span className="text-white font-semibold">{stats.activeChats}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Health:</span>
                  <span className={`font-semibold ${
                    stats.healthScore >= 80 ? 'text-green-400' : 
                    stats.healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{stats.healthScore}%</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium text-sm">Operational</span>
              </div>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="mt-4 flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-white text-lg">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'chat' && <ChatInterface />}
            {activeTab === 'projects' && <ProjectManager />}
            {activeTab === 'health' && <BuildHealthMonitor />}
            {activeTab === 'settings' && <Settings />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/30 backdrop-blur-sm border-t border-blue-500/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm">
            Javari AI v1.0 • Built for CR AudioViz AI • Powered by Next.js, TypeScript & Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
