'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/javari/ChatInterface';
import { ChatHistory } from '@/components/javari/ChatHistory';
import { ProjectManager } from '@/components/javari/ProjectManager';
import { BuildHealthMonitor } from '@/components/javari/BuildHealthMonitor';
import { Settings } from '@/components/javari/Settings';
import { Menu, X, GitBranch } from 'lucide-react';

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
  numeric_id: number;
  title: string;
  summary?: string;
  messages: Message[];
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  parent_id?: string;
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [creatingContinuation, setCreatingContinuation] = useState(false);
  const [continuationParent, setContinuationParent] = useState<Conversation | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Load conversations count
      const conversationsResponse = await fetch(`/api/javari/conversations?userId=${userId}&limit=1`);
      if (conversationsResponse.ok) {
        const conversationsData = await conversationsResponse.json();
        setStats(prev => ({ ...prev, activeChats: conversationsData.total || 0 }));
      }

      // Load projects count
      const projectsResponse = await fetch('/api/projects');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setStats(prev => ({ ...prev, totalProjects: projectsData.projects?.length || 0 }));
      }

      // TODO: Load actual health and builds data
      setStats(prev => ({ ...prev, healthScore: 100, buildsToday: 0 }));
      
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setContinuationParent(null);
    // Convert timestamp strings to Date objects
    const messagesWithDates = conversation.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp).toISOString()
    }));
    setCurrentConversation({
      ...conversation,
      messages: messagesWithDates as any
    });
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setContinuationParent(null);
  };

  const handleConversationCreated = (conversationId: string) => {
    // Refresh the sidebar to show new conversation
    setRefreshTrigger(prev => prev + 1);
    loadStats(); // Update stats
  };

  const handleCreateContinuation = async (parentConversation: Conversation) => {
    setCreatingContinuation(true);
    setContinuationParent(parentConversation);
    
    try {
      // Generate summary if doesn't exist
      if (!parentConversation.summary) {
        const summaryResponse = await fetch('/api/javari/conversations/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: parentConversation.id })
        });
        
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          parentConversation.summary = summaryData.summary;
        }
      }

      // Create new conversation as continuation
      const response = await fetch('/api/javari/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          parentId: parentConversation.id,
          title: `${parentConversation.title} (continued)`,
          summary: parentConversation.summary,
          messages: [],
          model: 'gpt-4-turbo-preview'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newConversation = data.conversation;
        
        // Set the new conversation as current
        setCurrentConversation(newConversation);
        setRefreshTrigger(prev => prev + 1);
      } else {
        throw new Error('Failed to create continuation');
      }
    } catch (error) {
      console.error('Error creating continuation:', error);
      alert('Failed to create continuation. Please try again.');
    } finally {
      setCreatingContinuation(false);
    }
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
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  {sidebarOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
                </button>
              )}
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Javari AI
                  </h1>
                  <p className="text-sm text-gray-400">Autonomous Development Assistant</p>
                </div>
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

      {/* Continuation Banner */}
      {continuationParent && (
        <div className="bg-blue-900/30 border-b border-blue-500/30 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-300">
              <GitBranch size={16} />
              <span>
                Continuing from: <strong>{continuationParent.title}</strong>
              </span>
            </div>
            <button
              onClick={() => setContinuationParent(null)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
                onCreateContinuation={handleCreateContinuation}
                currentConversationId={currentConversation?.id}
                refreshTrigger={refreshTrigger}
              />
            </aside>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {continuationParent?.summary && (
                <div className="bg-gray-900/50 border-b border-gray-800 px-6 py-4">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">Context from previous conversation:</h3>
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">
                    {continuationParent.summary}
                  </div>
                </div>
              )}
              
              {creatingContinuation ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Creating continuation...</p>
                  </div>
                </div>
              ) : (
                <ChatInterface
                  userId={userId}
                  conversationId={currentConversation?.id}
                  initialMessages={currentConversation?.messages as any || []}
                  onConversationCreated={handleConversationCreated}
                  parentId={continuationParent?.id}
                />
              )}
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
