'use client';

// components/JavariChatInterface.tsx
// JAVARI AI - Complete Three-Panel Interface v5.0
// Full Autonomous AI Assistant
// Timestamp: 2025-12-13 7:45 AM EST

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Bot, User, Loader2, AlertCircle, Sparkles, Zap, Brain, Globe, 
  Code, MessageSquare, History, Lightbulb, BookOpen, ChevronLeft, 
  ChevronRight, Star, Clock, FileText, Trash2, Plus, Search, Settings,
  PanelLeftClose, PanelRightClose, Cpu, Wand2, TrendingUp, HelpCircle,
  CheckCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================================
// PROVIDER CONFIGURATION - All 6 AI Providers
// ============================================================================
const PROVIDER_CONFIG = {
  auto: { 
    name: 'Auto', 
    color: 'from-cyan-400 to-blue-500', 
    bgColor: 'bg-gradient-to-r from-cyan-400 to-blue-500',
    icon: Wand2, 
    description: 'Smart routing to best AI',
    shortDesc: 'Best AI for task'
  },
  openai: { 
    name: 'GPT-4', 
    color: 'from-green-400 to-green-600', 
    bgColor: 'bg-green-500',
    icon: Sparkles, 
    description: 'Creative & General Purpose',
    shortDesc: 'Creative tasks'
  },
  claude: { 
    name: 'Claude', 
    color: 'from-orange-400 to-orange-600', 
    bgColor: 'bg-orange-500',
    icon: Brain, 
    description: 'Coding & Deep Analysis',
    shortDesc: 'Code & analysis'
  },
  gemini: { 
    name: 'Gemini', 
    color: 'from-blue-400 to-blue-600', 
    bgColor: 'bg-blue-500',
    icon: Zap, 
    description: 'Fast & Multimodal',
    shortDesc: 'Fast responses'
  },
  perplexity: { 
    name: 'Perplexity', 
    color: 'from-cyan-400 to-cyan-600', 
    bgColor: 'bg-cyan-500',
    icon: Globe, 
    description: 'Search & Real-time Research',
    shortDesc: 'Web search'
  },
  mistral: { 
    name: 'Mistral', 
    color: 'from-purple-400 to-purple-600', 
    bgColor: 'bg-purple-500',
    icon: Cpu, 
    description: 'Multilingual & Efficient',
    shortDesc: 'Multilingual'
  },
} as const;

type ProviderName = keyof typeof PROVIDER_CONFIG;

// ============================================================================
// TYPES
// ============================================================================
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: ProviderName;
  model?: string;
  latency?: number;
  tokensUsed?: number;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  starred?: boolean;
}

interface Suggestion {
  id: string;
  type: 'tip' | 'action' | 'insight';
  title: string;
  content: string;
  icon: typeof Lightbulb;
}

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  relevance: number;
}

interface JavariChatInterfaceProps {
  projectId?: string;
  sessionId?: string;
  userId?: string;
  showProviderInfo?: boolean;
  initialProvider?: ProviderName;
}

// ============================================================================
// QUICK PROMPTS
// ============================================================================
const QUICK_PROMPTS = [
  { icon: '💻', label: 'Write code', prompt: 'Help me write a ' },
  { icon: '📄', label: 'Create document', prompt: 'Create a professional ' },
  { icon: '🎨', label: 'Design', prompt: 'Design a modern ' },
  { icon: '📊', label: 'Analyze', prompt: 'Analyze this data: ' },
  { icon: '🔍', label: 'Research', prompt: 'Research and summarize ' },
  { icon: '✍️', label: 'Write', prompt: 'Write a compelling ' },
  { icon: '🧠', label: 'Explain', prompt: 'Explain in simple terms: ' },
  { icon: '🚀', label: 'Build', prompt: 'Build me a complete ' },
];

const SAMPLE_PROMPTS = [
  { category: 'Business Strategy', prompt: 'Create a quarterly OKR framework with 3 objectives, 9 key results, and weekly milestone tracking' },
  { category: 'Development', prompt: 'Build a full-stack authentication system with JWT, refresh tokens, and role-based access control' },
  { category: 'Marketing', prompt: 'Design a 30-day social media content calendar for a SaaS product launch' },
  { category: 'Data Analysis', prompt: 'Create a Python script to analyze sales data and generate insights with visualizations' },
  { category: 'Creative', prompt: 'Write a compelling brand story for a sustainable fashion startup' },
];

// ============================================================================
// PROVIDER BADGE COMPONENT
// ============================================================================
function ProviderBadge({ provider, latency }: { provider?: ProviderName; latency?: number }) {
  if (!provider || provider === 'auto') return null;
  const config = PROVIDER_CONFIG[provider];
  if (!config) return null;
  
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
      <span className={`w-2 h-2 rounded-full ${config.bgColor}`} />
      <Icon className="w-3 h-3 text-gray-400" />
      <span className="text-xs text-gray-400">{config.name}</span>
      {latency && <span className="text-xs text-gray-300">• {latency}ms</span>}
    </div>
  );
}

// ============================================================================
// LEFT PANEL - Conversation History
// ============================================================================
function LeftPanel({ 
  conversations, 
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onToggleStar,
  isCollapsed,
  onToggleCollapse
}: {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onToggleStar: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Separate active (starred) and completed (unstarred) conversations
  const activeConversations = filteredConversations.filter(c => c.starred);
  const completedConversations = filteredConversations.filter(c => !c.starred);

  if (isCollapsed) {
    return (
      <div className="w-12 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Expand panel"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="mt-4 p-2 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
          title="New chat"
        >
          <Plus className="w-5 h-5" />
        </button>
        <div className="mt-4 flex flex-col gap-2">
          {conversations.slice(0, 5).map((conv, i) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`p-2 rounded-lg transition-colors ${
                conv.id === currentConversationId 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={conv.title}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Conversations
          </h2>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        
        <button
          onClick={onNewConversation}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
        
        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active Conversations (Starred) */}
            {activeConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-yellow-400 uppercase tracking-wide">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  Active ({activeConversations.length})
                </div>
                <div className="space-y-1">
                  {activeConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group p-3 rounded-lg cursor-pointer transition-all ${
                        conv.id === currentConversationId
                          ? 'bg-yellow-500/20 border border-yellow-500/30'
                          : 'hover:bg-slate-800 border border-transparent bg-slate-800/50'
                      }`}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            <h3 className="text-sm font-medium text-white truncate">{conv.title}</h3>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-1">{conv.lastMessage}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(conv.timestamp).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{conv.messageCount} msgs</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleStar(conv.id); }}
                            className="p-1.5 text-yellow-400 hover:text-green-400 transition-colors"
                            title="Mark as complete"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Completed Conversations (Unstarred) */}
            {completedConversations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <CheckCircle className="w-3 h-3" />
                  Completed ({completedConversations.length})
                </div>
                <div className="space-y-1">
                  {completedConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group p-3 rounded-lg cursor-pointer transition-all ${
                        conv.id === currentConversationId
                          ? 'bg-cyan-500/20 border border-cyan-500/30'
                          : 'hover:bg-slate-800 border border-transparent'
                      }`}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-slate-300 truncate">{conv.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-1">{conv.lastMessage}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(conv.timestamp).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{conv.messageCount} msgs</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleStar(conv.id); }}
                            className="p-1.5 text-slate-500 hover:text-yellow-400 transition-colors"
                            title="Reactivate conversation"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RIGHT PANEL - Knowledge & Suggestions
// ============================================================================
function RightPanel({
  suggestions,
  knowledgeItems,
  isCollapsed,
  onToggleCollapse,
  onUseSuggestion
}: {
  suggestions: Suggestion[];
  knowledgeItems: KnowledgeItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUseSuggestion: (prompt: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'knowledge' | 'prompts'>('prompts');

  if (isCollapsed) {
    return (
      <div className="w-12 bg-slate-900 border-l border-slate-700 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Expand panel"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => { onToggleCollapse(); setActiveTab('prompts'); }}
            className="p-2 text-purple-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sample prompts"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onToggleCollapse(); setActiveTab('suggestions'); }}
            className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Suggestions"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onToggleCollapse(); setActiveTab('knowledge'); }}
            className="p-2 text-green-400 hover:text-green-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Knowledge base"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Assistant</h2>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'prompts' 
                ? 'bg-purple-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Prompts
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'suggestions' 
                ? 'bg-yellow-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tips
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'knowledge' 
                ? 'bg-green-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Knowledge
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'prompts' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-4">Click any prompt to use it:</p>
            {SAMPLE_PROMPTS.map((item, i) => (
              <button
                key={i}
                onClick={() => onUseSuggestion(item.prompt)}
                className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 rounded-lg transition-all group"
              >
                <span className="text-xs text-purple-400 font-medium">[{item.category}]</span>
                <p className="text-sm text-slate-300 mt-1 group-hover:text-white transition-colors">
                  {item.prompt}
                </p>
              </button>
            ))}
            
            <button
              onClick={() => onUseSuggestion('')}
              className="w-full mt-4 py-2 text-center text-sm text-cyan-400 hover:text-cyan-300 border border-dashed border-slate-700 hover:border-cyan-500/50 rounded-lg transition-colors"
            >
              View over 100+ prompts →
            </button>
          </div>
        )}
        
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Suggestions appear as you chat</p>
              </div>
            ) : (
              suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <div
                    key={suggestion.id}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${
                        suggestion.type === 'tip' ? 'text-yellow-400' :
                        suggestion.type === 'action' ? 'text-cyan-400' :
                        'text-green-400'
                      }`} />
                      <span className="text-sm font-medium text-white">{suggestion.title}</span>
                    </div>
                    <p className="text-xs text-slate-400">{suggestion.content}</p>
                  </div>
                );
              })
            )}
          </div>
        )}
        
        {activeTab === 'knowledge' && (
          <div className="space-y-3">
            {knowledgeItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Javari learns from your conversations</p>
                <p className="text-xs mt-1 text-slate-600">44 knowledge entries available</p>
              </div>
            ) : (
              knowledgeItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-800 border border-slate-700 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{item.title}</span>
                    <span className="text-xs text-green-400">{Math.round(item.relevance * 100)}%</span>
                  </div>
                  <span className="text-xs text-slate-500">{item.category}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Stats */}
      <div className="p-4 border-t border-slate-700">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-slate-800 rounded-lg">
            <p className="text-lg font-bold text-cyan-400">44</p>
            <p className="text-xs text-slate-500">Knowledge</p>
          </div>
          <div className="p-2 bg-slate-800 rounded-lg">
            <p className="text-lg font-bold text-green-400">6</p>
            <p className="text-xs text-slate-500">Sources</p>
          </div>
          <div className="p-2 bg-slate-800 rounded-lg">
            <p className="text-lg font-bold text-purple-400">6</p>
            <p className="text-xs text-slate-500">AI Models</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function JavariChatInterface({ 
  projectId, 
  sessionId, 
  userId,
  showProviderInfo = true,
  initialProvider = 'auto'
}: JavariChatInterfaceProps) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(initialProvider);
  const [currentProvider, setCurrentProvider] = useState<ProviderName | null>(null);
  
  // Panel states
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // Mock data (replace with real data from API)
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: 'Building Javari UI', lastMessage: 'The three-panel layout is complete', timestamp: new Date(), messageCount: 15, starred: true },
    { id: '2', title: 'Database Setup', lastMessage: 'All autonomous tables created', timestamp: new Date(Date.now() - 86400000), messageCount: 8 },
    { id: '3', title: 'API Integration', lastMessage: 'Stripe webhook configured', timestamp: new Date(Date.now() - 172800000), messageCount: 12 },
  ]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('1');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Load chat history
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/javari/chat/history?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setError(null);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const startTime = Date.now();
      
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          history: messages.slice(-10),
          provider: selectedProvider === 'auto' ? undefined : selectedProvider,
          projectId,
          sessionId,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let provider: ProviderName | undefined;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingMessage(fullContent);
                }
                if (data.provider) {
                  provider = data.provider;
                  setCurrentProvider(provider);
                }
                if (data.done) {
                  const latency = Date.now() - startTime;
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date(),
                    provider,
                    latency,
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                  setStreamingMessage('');
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }
      } else {
        // Handle JSON response
        const data = await response.json();
        const latency = Date.now() - startTime;
        
        if (data.provider) {
          setCurrentProvider(data.provider);
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || data.message || 'I received your message but got an empty response.',
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          latency,
          tokensUsed: data.tokensUsed,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    const newId = Date.now().toString();
    setConversations(prev => [{
      id: newId,
      title: 'New Conversation',
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0,
      starred: true  // Auto-star new conversations as ACTIVE
    }, ...prev]);
    setCurrentConversationId(newId);
    setMessages([]);
  };

  const handleToggleStar = (id: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === id ? { ...conv, starred: !conv.starred } : conv
    ));
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id && conversations.length > 1) {
      setCurrentConversationId(conversations[0].id === id ? conversations[1].id : conversations[0].id);
    }
  };

  const handleUseSuggestion = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-screen bg-slate-950">
      {/* LEFT PANEL - Conversation History */}
      <LeftPanel
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onToggleStar={handleToggleStar}
        isCollapsed={leftPanelCollapsed}
        onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
      />

      {/* CENTER PANEL - Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* AI Provider Selector */}
        <div className="bg-slate-900 border-b border-slate-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-sm text-slate-400 mr-2">Select AI:</span>
              {(Object.entries(PROVIDER_CONFIG) as [ProviderName, typeof PROVIDER_CONFIG[ProviderName]][]).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = selectedProvider === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedProvider(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      isSelected
                        ? `bg-gradient-to-r ${config.color} text-white shadow-lg shadow-${key === 'auto' ? 'cyan' : key === 'openai' ? 'green' : key === 'claude' ? 'orange' : key === 'gemini' ? 'blue' : key === 'perplexity' ? 'cyan' : 'purple'}-500/25`
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                    title={config.description}
                  >
                    <Icon className="w-4 h-4" />
                    {config.name}
                  </button>
                );
              })}
            </div>
            
            {/* Selected provider description */}
            <p className="text-center text-xs text-slate-500 mt-2">
              {PROVIDER_CONFIG[selectedProvider].description}
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="max-w-4xl mx-auto">
            {/* Welcome State */}
            {messages.length === 0 && !streamingMessage && !isLoading && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Hey! I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Javari</span> 👋
                </h1>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                  Your AI assistant powered by 6 models. I can code, create, research, analyze, and help with anything you need.
                </p>
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 justify-center mb-8">
                  {QUICK_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(item.prompt)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all"
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>

                {/* Sample Prompts */}
                <div className="grid gap-2 max-w-2xl mx-auto">
                  {SAMPLE_PROMPTS.slice(0, 3).map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(item.prompt)}
                      className="text-left p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/30 rounded-lg transition-all group"
                    >
                      <span className="text-xs text-cyan-400">[{item.category}]</span>
                      <span className="text-sm text-slate-300 ml-2 group-hover:text-white">{item.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-br-md'
                      : 'bg-slate-800 border border-slate-700 rounded-bl-md'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          code({ inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            
                            return !inline && match ? (
                              <div className="relative">
                                <div className="absolute top-2 right-2 flex gap-2">
                                  <button 
                                    onClick={() => navigator.clipboard.writeText(codeString)}
                                    className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600"
                                  >
                                    Copy
                                  </button>
                                </div>
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-lg !mt-0"
                                  {...props}
                                >
                                  {codeString}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className="bg-slate-700 px-1.5 py-0.5 rounded text-sm text-cyan-300" {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      <ProviderBadge provider={message.provider} latency={message.latency} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-800 border border-slate-700">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-slate-800 border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span className="text-slate-400 text-sm">
                      {currentProvider 
                        ? `${PROVIDER_CONFIG[currentProvider]?.name || 'AI'} is thinking...` 
                        : 'Javari is working on it...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 bg-slate-900 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Javari anything... I'll find a way to help! 🚀"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent min-h-[48px] max-h-[200px]"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg shadow-cyan-500/25 disabled:shadow-none"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-center text-xs text-slate-500 mt-3">
              Javari NEVER says no • Powered by 6 AI models • Fortune 50 quality
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Knowledge & Suggestions */}
      <RightPanel
        suggestions={suggestions}
        knowledgeItems={knowledgeItems}
        isCollapsed={rightPanelCollapsed}
        onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
        onUseSuggestion={handleUseSuggestion}
      />
    </div>
  );
}
