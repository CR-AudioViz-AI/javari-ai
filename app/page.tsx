'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/javari/ChatInterface';
import { ChatHistory } from '@/components/javari/ChatHistory';
import { ProjectManager } from '@/components/javari/ProjectManager';
import { BuildHealthMonitor } from '@/components/javari/BuildHealthMonitor';
import { Settings } from '@/components/javari/Settings';
import { Menu, X } from 'lucide-react';

type TabType = 'chat' | 'projects' | 'health' | 'settings';

interface Stats {
  totalProjects: number;
  activeChats: number;
  healthScore: number;
  buildsToday: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export default function JavariDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userId] = useState('demo-user'); // TODO: Get from auth
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

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    // Convert timestamp strings to Date objects
    const messagesWithDates = conversation.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    setCurrentConversation({
      ...conversation,
      messages: messagesWithDates as any
    });
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
  };

  const handleConversationCreated = (conversationId: string) => {
    // Conversation was created, refresh sidebar
    // The ChatHistory component will auto-refresh
  };

  const tabs = [
    { id: 'chat' as TabType, name: 'AI Chat', icon: '💬' },
    { id: 'projects' as TabType, name: 'Projects', icon: '📊' },
    { id: 'health' as TabType, name: 'Health', icon: '🏥' },
    { id: 'settings' as TabType, name: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {activeTab === 'chat' && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors lg:hidden"
                >
                  {sidebarOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
                </button>
              )}
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

      {/* Main Content with Sidebar */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' ? (
          <>
            {/* Sidebar */}
            <aside className={`${
              sidebarOpen ? 'w-80' : 'w-0'
            } transition-all duration-300 overflow-hidden border-r border-gray-800`}>
              <ChatHistory
                userId={userId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                currentConversationId={currentConversation?.id}
              />
            </aside>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                userId={userId}
                conversationId={currentConversation?.id}
                initialMessages={currentConversation?.messages as any || []}
                onConversationCreated={handleConversationCreated}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-white text-lg">Loading...</div>
              </div>
            ) : (
              <>
                {activeTab === 'projects' && <ProjectManager />}
                {activeTab === 'health' && <BuildHealthMonitor />}
                {activeTab === 'settings' && <Settings />}
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/30 backdrop-blur-sm border-t border-blue-500/10 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm">
            Javari AI v1.2 • Phase 1.2 Complete • Built for CR AudioViz AI
          </p>
        </div>
      </footer>
    </div>
  );
}
