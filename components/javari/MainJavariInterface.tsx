'use client';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}



import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChatService } from '@/lib/javari-services';
import { PromptHintsBar } from '@/components/javari/PromptHintsBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Plus,
  Star,
  FolderKanban,
  Globe,
  HelpCircle,
  CreditCard,
  Settings as SettingsIcon,
  FileText,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  MoreVertical,
  Download,
  Printer,
  FileDown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import VoicePanel from '@/components/VoicePanel';

// Brand colors from Bible
const COLORS = {
  navy: '#002B5B',
  red: '#FD201D',
  cyan: '#00BCD4',
  javariCyan: '#00D4FF',
  javaribg: '#0A1628',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  hasArtifacts?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  pinned: boolean;      // User pinned this conversation
  messages: Message[];
  project_id?: string;
  updated_at: string;
  created_at?: string;
  build_status?: 'success' | 'failed' | 'pending' | null;  // Track build status
  message_count?: number;
}

// Group conversations by time period
interface ConversationGroups {
  pinned: Conversation[];
  today: Conversation[];
  yesterday: Conversation[];
  previous7Days: Conversation[];
  older: Conversation[];
}

interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  starred: boolean;
}

interface Artifact {
  id: string;
  name: string;
  type: 'code' | 'document' | 'image' | 'data';
  content: string;
  size: string;
  language?: string; // For code artifacts
}

interface AIProvider {
  id: string;
  name: string;
  credits: number;
  icon: string;
  description: string;
  bestFor: string[];
}

interface AISelectionModal {
  show: boolean;
  currentAI: string;
  newAI: string;
  currentCredits: number;
  newCredits: number;
}

export default function MainJavariInterface() {
  // State management
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true); // Hidden on mobile by default
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true); // Hidden on mobile by default
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [credits, setCredits] = useState({ current: 1250, total: 5000 });
  const [userPlan, setUserPlan] = useState('Pro');
  const [userName, setUserName] = useState('Roy Henderson');
  const [language, setLanguage] = useState('English');
  // Voice listening handled by isListeningToUser
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListeningToUser, setIsListeningToUser] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const [selectedAI, setSelectedAI] = useState<string>('auto');
  const [recommendedAI, setRecommendedAI] = useState<string>('gpt-4');
  const [aiSelectionModal, setAiSelectionModal] = useState<AISelectionModal>({
    show: false,
    currentAI: 'auto',
    newAI: '',
    currentCredits: 0,
    newCredits: 0,
  });
  const [copiedArtifacts, setCopiedArtifacts] = useState<Record<string, boolean>>({});
  const [previewingArtifact, setPreviewingArtifact] = useState<Artifact | null>(null);
  const [artifactViewMode, setArtifactViewMode] = useState<Record<string, 'code' | 'preview'>>({});
  
  // NEW: Better conversation management
  const [searchQuery, setSearchQuery] = useState('');
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Group conversations by time period
  const groupConversations = (convos: Conversation[]): ConversationGroups => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const groups: ConversationGroups = {
      pinned: [],
      today: [],
      yesterday: [],
      previous7Days: [],
      older: [],
    };

    // Filter by search if query exists
    let filtered = convos;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = convos.filter(c => 
        c.title.toLowerCase().includes(query)
      );
    }

    filtered.forEach(conv => {
      const updated = new Date(conv.updated_at);
      
      if (conv.pinned) {
        groups.pinned.push(conv);
      } else if (updated >= today) {
        groups.today.push(conv);
      } else if (updated >= yesterday) {
        groups.yesterday.push(conv);
      } else if (updated >= weekAgo) {
        groups.previous7Days.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const conversationGroups = groupConversations(allConversations);
  // Load all conversations on mount and refresh
  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const conversations = await ChatService.loadConversations();
      setAllConversations(conversations.map(c => ({
        id: c.id,
        title: c.title,
        pinned: c.starred || false, // Using starred as pinned
        messages: [],
        updated_at: c.updated_at,
        created_at: c.created_at,
      })));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load conversations on mount
  
  // Initialize Speech Recognition for voice conversations
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = '';
          let final = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }
          
          setInterimTranscript(interim);
          
          if (final) {
            setInputMessage(prev => prev + final);
            setInterimTranscript('');
          }
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event);
          setIsListeningToUser(false);
        };
        
        recognition.onend = () => {
          // If still supposed to be listening, restart
          if (isListeningToUser) {
            try {
              recognition.start();
            } catch (e) {
              setIsListeningToUser(false);
            }
          }
        };
        
        speechRecognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
    };
  }, [isListeningToUser]);

  // Toggle speech recognition
  const toggleSpeechRecognition = () => {
    if (!speechRecognitionRef.current) {
      alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }
    
    if (isListeningToUser) {
      speechRecognitionRef.current.stop();
      setIsListeningToUser(false);
      // Auto-send if there's text
      if (inputMessage.trim()) {
        handleSendMessage();
      }
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListeningToUser(true);
        setInterimTranscript('');
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  };

useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    const loadMsgs = async () => {
      if (currentConversation && currentConversation.id && !currentConversation.id.startsWith('temp-')) {
        try {
          const msgs = await ChatService.loadMessages(currentConversation.id);
          if (msgs.length > 0) {
            setMessages(msgs.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: m.created_at,
              provider: m.provider,
            })));
          }
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      }
    };
    loadMsgs();
  }, [currentConversation?.id]);

  
  // Ref for auto-scrolling messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Providers with credit costs
  const aiProviders: Record<string, AIProvider> = {
    'gpt-4': { 
      id: 'gpt-4', 
      name: 'GPT-4', 
      credits: 2, 
      icon: '🤖',
      description: 'Best for creative writing, complex reasoning',
      bestFor: ['Writing', 'Analysis', 'General tasks']
    },
    'claude': { 
      id: 'claude', 
      name: 'Claude', 
      credits: 3, 
      icon: '🎯',
      description: 'Best for code, analysis, long context',
      bestFor: ['Coding', 'Research', 'Documentation']
    },
    'gemini': { 
      id: 'gemini', 
      name: 'Gemini', 
      credits: 2, 
      icon: '✨',
      description: 'Best for multimodal tasks, fast responses',
      bestFor: ['Images', 'Video', 'Speed']
    },
    'perplexity': { 
      id: 'perplexity', 
      name: 'Perplexity', 
      credits: 1, 
      icon: '🔍',
      description: 'Best for research, current information',
      bestFor: ['Research', 'News', 'Facts']
    },
  };

  // Enhanced AI detection with multi-factor analysis
  const detectBestAI = (query: string): string => {
    const lowerQuery = query.toLowerCase()
    const scores: Record<string, number> = {
      'gpt-4': 0,
      'claude': 0,
      'gemini': 0,
      'perplexity': 0
    }

    // Claude - Best for code and technical tasks
    const claudeKeywords = ['code', 'function', 'class', 'algorithm', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'react', 'api', 'database', 'sql', 'component', 'analyze', 'technical', 'architecture'];
    const claudeMatches = claudeKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['claude'] = claudeMatches * 3;

    // Perplexity - Best for research and current information
    const perplexityKeywords = ['research', 'latest', 'current', 'news', 'recent', 'today', '2024', '2025', 'search', 'find', 'what is', 'who is', 'trend', 'market', 'statistics'];
    const perplexityMatches = perplexityKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['perplexity'] = perplexityMatches * 3;

    // Gemini - Best for multimodal and visual tasks
    const geminiKeywords = ['image', 'picture', 'photo', 'visual', 'diagram', 'chart', 'graph', 'design', 'ui', 'mockup', 'video', 'audio'];
    const geminiMatches = geminiKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['gemini'] = geminiMatches * 3;

    // GPT-4 - Best for general tasks, writing, creative work
    const gpt4Keywords = ['write', 'essay', 'article', 'blog', 'story', 'content', 'email', 'letter', 'explain', 'summarize', 'brainstorm', 'creative', 'strategy'];
    const gpt4Matches = gpt4Keywords.filter(k => lowerQuery.includes(k)).length;
    scores['gpt-4'] = gpt4Matches * 3;

    // Additional heuristics
    if (lowerQuery.length > 200 && /function|class|import|export|const|let/i.test(query)) {
      scores['claude'] += 5;
    }
    if (/\b(today|now|current|latest|recent)\b/i.test(query)) {
      scores['perplexity'] += 3;
    }
    if (/```|`[\w\s]+`/.test(query)) {
      scores['claude'] += 4;
    }
    if (/feel|imagine|beautiful|wonderful|amazing|creative/i.test(query)) {
      scores['gpt-4'] += 2;
    }

    // Find provider with highest score
    const bestProvider = Object.entries(scores).reduce((best, current) => {
      return current[1] > best[1] ? current : best
    }, ['gpt-4', 0])[0]

    // If no clear winner (all scores low), default to GPT-4
    if (scores[bestProvider] < 2) {
      return 'gpt-4'
    }

    return bestProvider;
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle AI provider change with modal
  const handleAIChange = (newAI: string) => {
    if (newAI === selectedAI) return;

    const current = selectedAI === 'auto' ? recommendedAI : selectedAI;
    const currentCredits = aiProviders[current]?.credits || 0;
    const newCredits = aiProviders[newAI]?.credits || 0;

    // If switching from auto or costs are different, show modal
    if (selectedAI === 'auto' || currentCredits !== newCredits) {
      setAiSelectionModal({
        show: true,
        currentAI: current,
        newAI: newAI,
        currentCredits: currentCredits,
        newCredits: newCredits,
      });
    } else {
      setSelectedAI(newAI);
    }
  };

  // Confirm AI change
  const confirmAIChange = () => {
    setSelectedAI(aiSelectionModal.newAI);
    setAiSelectionModal({ ...aiSelectionModal, show: false });
  };

  // Send message handler with REAL OpenAI API
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage;
    setInputMessage('');

    // Get or create conversation
    let convId = currentConversation?.id;
    let isGuest = false;
    
    if (!convId || convId.startsWith('temp-')) {
      try {
        // Create title from first message (first 50 chars)
        const title = userMessage.substring(0, 50).replace(/[^\w\s]/g, '').trim() || 'New Chat';
        const newConvo = await ChatService.createConversation(title);
        
        if (newConvo) {
          convId = newConvo.id;
          
          // Set as current conversation with pinned=false (not pinned by default, like Claude)
          const newConversation: Conversation = {
            id: newConvo.id,
            title: newConvo.title,
            pinned: false,
            messages: [],
            updated_at: newConvo.updated_at,
          };
          
          setCurrentConversation(newConversation);
          
          // Add to allConversations at the top (most recent)
          setAllConversations(prev => [newConversation, ...prev]);
        } else {
          // Guest mode - chat without saving
          isGuest = true;
          convId = 'guest-' + Date.now();
          console.log('Running in guest mode - chat will not be saved');
        }
      } catch (e) {
        console.error('Error creating conversation:', e);
        isGuest = true;
        convId = 'guest-' + Date.now();
      }
    }

    // Auto-detect best AI if in auto mode
    let aiToUse = selectedAI;
    if (selectedAI === 'auto') {
      const detected = detectBestAI(userMessage);
      setRecommendedAI(detected);
      aiToUse = detected;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Only save to DB if not guest
    if (!isGuest) {
      await ChatService.saveMessage(convId, 'user', userMessage);
    }

    // Create placeholder for AI response
    const aiResponseId = (Date.now() + 1).toString();
    const aiResponse: Message = {
      id: aiResponseId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
      provider: aiToUse,
      hasArtifacts: false,
    };
    setMessages(prev => [...prev, aiResponse]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({
              role: m.role,
              content: m.content
            })),
            { role: 'user', content: userMessage }
          ],
          aiProvider: aiToUse,
          conversationId: isGuest ? undefined : convId
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('API response:', data);

      // Check if autonomous deployment
      if (data.isAutonomous && data.workflowId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiResponseId ? { ...m, content: data.content || 'Starting deployment...', provider: 'javari' } : m
          )
        );

        // Poll for deployment status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/autonomous/status/${data.workflowId}`);
            const statusData = await statusRes.json();
            const workflow = statusData.workflow;

            if (workflow?.status === 'success') {
              clearInterval(pollInterval);
              const successMsg = `✅ Live: https://${workflow.artifacts?.deploymentUrl}\n📁 Repo: ${workflow.artifacts?.repoUrl}`;
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: successMsg,
                timestamp: new Date().toISOString(),
                provider: 'javari',
              }]);
              if (!isGuest) {
                await ChatService.saveMessage(convId, 'assistant', successMsg, 'javari');
              }
            } else if (workflow?.status === 'failed') {
              clearInterval(pollInterval);
              const errorMsg = `❌ Build failed: ${workflow.error?.message || 'Unknown error'}`;
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: errorMsg,
                timestamp: new Date().toISOString(),
                provider: 'error',
              }]);
              if (!isGuest) {
                await ChatService.saveMessage(convId, 'assistant', errorMsg, 'error');
              }
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 5000);
        return;
      }

      // Regular response - update the placeholder with actual content
      const responseContent = data.content || data.message || 'No response received';
      
      setMessages(prev =>
        prev.map(m =>
          m.id === aiResponseId ? { ...m, content: responseContent, provider: data.provider || aiToUse } : m
        )
      );

      // Save assistant message (only if not guest)
      if (!isGuest) {
        await ChatService.saveMessage(convId, 'assistant', responseContent, data.provider || aiToUse);
      }

      // Parse content for artifacts (code blocks)
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const codeBlocks = [...responseContent.matchAll(codeBlockRegex)];
      
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((match, index) => {
          const language = match[1] || 'text';
          const code = match[2];
          const newArtifact: Artifact = {
            id: `${Date.now()}-${index}`,
            name: `${language}_snippet_${index + 1}.${language}`,
            type: 'code',
            content: code,
            size: `${(code.length / 1024).toFixed(1)} KB`,
            language: language,
          };
          setArtifacts(prev => [...prev, newArtifact]);
        });

        // Update message to indicate artifacts were created
        setMessages(prev => 
          prev.map(m => 
            m.id === aiResponseId 
              ? { ...m, hasArtifacts: true }
              : m
          )
        );
      }

    } catch (error: unknown) {
      console.error('Error calling AI API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update message with error
      setMessages(prev => 
        prev.map(m => 
          m.id === aiResponseId 
            ? { 
                ...m, 
                content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
                provider: 'error'
              }
            : m
        )
      );
    }
  };
  
  // Start a new chat
  const handleNewChat = () => {
    // Clear messages and current conversation
    setMessages([]);
    setCurrentConversation(null);
    console.log('New chat ready');
  };

  // Handle Projects - Allow project management and chat organization
  const handleProjects = () => {
    // TODO: Implement projects modal/sidebar
    console.log('Projects clicked - opening project manager');
    alert('Projects feature coming soon! This will let you organize chats by project.');
  };

  // Select a conversation from sidebar
  const selectConversation = async (conv: Conversation) => {
    setCurrentConversation(conv);
    // Messages will be loaded by useEffect
  };

  // Toggle pin status
  const togglePin = async (convId: string, pinned: boolean) => {
    await ChatService.toggleStar(convId, pinned);
    setAllConversations(prev => 
      prev.map(c => c.id === convId ? { ...c, pinned } : c)
    );
  };

  // Delete conversation
  const deleteConversation = async (convId: string) => {
    if (!confirm('Delete this conversation?')) return;
    await ChatService.deleteConversation(convId);
    setAllConversations(prev => prev.filter(c => c.id !== convId));
    if (currentConversation?.id === convId) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  // Conversation Item Component
  const ConversationItem = ({ 
    conv, 
    isActive, 
    onSelect, 
    onPin, 
    onDelete 
  }: { 
    conv: Conversation; 
    isActive: boolean; 
    onSelect: () => void; 
    onPin: () => void; 
    onDelete: () => void;
  }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    return (
      <div 
        className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive 
            ? 'bg-gray-700/50 border border-cyan-500/50' 
            : 'hover:bg-gray-800/50'
        }`}
        onClick={onSelect}
      >
      {/* Voice conversation animations */}
      <style jsx global>{\`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      \`}</style>

        {/* Build status indicator */}
        <div className="flex-shrink-0">
          {conv.build_status === 'success' && (
            <Check className="w-4 h-4 text-green-500" />
          )}
          {conv.build_status === 'failed' && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
          {conv.build_status === 'pending' && (
            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          )}
          {!conv.build_status && (
            <MessageSquare className="w-4 h-4 text-gray-500" />
          )}
        </div>
        
        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{conv.title || 'New Chat'}</div>
        </div>
        
        {/* Pin indicator */}
        {conv.pinned && (
          <Star className="w-3 h-3 flex-shrink-0" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
        )}
        
        {/* Menu button - shows on hover */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-1 rounded hover:bg-gray-700"
                onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
              >
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(); setShowMenu(false); }}>
                <Star className="w-4 h-4 mr-2" />
                {conv.pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                className="text-red-500"
              >
                <X className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  // Copy artifact to clipboard
  const copyArtifact = (artifactId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedArtifacts({ ...copiedArtifacts, [artifactId]: true });
    setTimeout(() => {
      setCopiedArtifacts({ ...copiedArtifacts, [artifactId]: false });
    }, 2000);
  };

  // Download artifact
  const downloadArtifact = (artifact: Artifact, format: string) => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.name}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate preview HTML for React/TSX components
  const generatePreviewHTML = (code: string, language: string): string => {
    const isReact = ['tsx', 'jsx', 'typescript', 'javascript'].includes(language?.toLowerCase() || '');
    
    if (isReact) {
      // Clean the code for preview
      const cleanCode = code
        .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?/g, '// import removed')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+/g, '');
      
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body { margin: 0; padding: 16px; background: #1e293b; color: white; font-family: system-ui, sans-serif; min-height: 100vh; }
    .error { color: #f87171; padding: 16px; background: #7f1d1d; border-radius: 8px; margin: 16px; }
    .loading { color: #94a3b8; padding: 16px; text-align: center; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading preview...</div></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef } = React;
    
    try {
      ${cleanCode}
      
      // Find component to render
      const findComponent = () => {
        const code = \`${cleanCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
        const match = code.match(/(?:const|function)\\s+([A-Z][a-zA-Z0-9]*)/);
        if (match) return match[1];
        return null;
      };
      
      const compName = findComponent();
      const Component = compName ? eval(compName) : null;
      
      if (Component) {
        ReactDOM.createRoot(document.getElementById('root')).render(<Component />);
      } else {
        document.getElementById('root').innerHTML = '<div class="error">Component not found. Check console for errors.</div>';
      }
    } catch (e) {
      document.getElementById('root').innerHTML = '<div class="error"><strong>Preview Error:</strong><br/>' + e.message + '</div>';
      console.error('Preview error:', e);
    }
  <\/script>
</body>
</html>`;
    }
    
    // For HTML
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body { margin: 0; background: #1e293b; color: white; min-height: 100vh; }</style>
</head>
<body>${code}</body>
</html>`;
  };

  // Toggle artifact view mode
  const toggleArtifactView = (artifactId: string) => {
    setArtifactViewMode(prev => ({
      ...prev,
      [artifactId]: prev[artifactId] === 'preview' ? 'code' : 'preview'
    }));
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: COLORS.javaribg }}>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-4 rounded-lg shadow-xl"
        style={{ backgroundColor: COLORS.navy, border: `2px solid ${COLORS.cyan}` }}
      >
        <MessageSquare className="w-7 h-7" style={{ color: COLORS.cyan }} />
      </button>

      {/* Mobile Backdrop */}
      {leftSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setLeftSidebarOpen(false)}
        />
      )}

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - CLAUDE-LIKE CONVERSATION MANAGEMENT */}
        {leftSidebarOpen && (
          <div 
            className="w-full md:w-80 md:relative absolute inset-y-0 left-0 z-40 border-r flex flex-col"
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40'
            }}
          >
            {/* Logo - Top of Sidebar */}
            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <Image
                src="/javariailogo.png"
                alt="Javari AI"
                width={60}
                height={60}
                className="rounded-lg md:w-[80px] md:h-[80px]"
              />
              {/* Mobile close button */}
              <button
                onClick={() => setLeftSidebarOpen(false)}
                className="md:hidden p-2 rounded-lg"
                style={{ backgroundColor: COLORS.navy, border: `1px solid ${COLORS.cyan}` }}
              >
                <X className="w-5 h-5" style={{ color: COLORS.cyan }} />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <Button 
                className="w-full"
                onClick={handleNewChat}
                style={{ 
                  backgroundColor: COLORS.red,
                  color: 'white'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 pl-9 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: COLORS.javaribg, 
                    borderColor: COLORS.cyan + '40',
                    border: '1px solid'
                  }}
                />
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Conversation List - Grouped by Time */}
            <ScrollArea className="flex-1 px-2">
              <div className="space-y-4 py-2">
                
                {/* PINNED Section */}
                {conversationGroups.pinned.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <Star className="w-3 h-3" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pinned</span>
                    </div>
                    {conversationGroups.pinned.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conv={conv} 
                        isActive={currentConversation?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onPin={() => togglePin(conv.id, !conv.pinned)}
                        onDelete={() => deleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* TODAY Section */}
                {conversationGroups.today.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today</span>
                    </div>
                    {conversationGroups.today.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conv={conv} 
                        isActive={currentConversation?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onPin={() => togglePin(conv.id, !conv.pinned)}
                        onDelete={() => deleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* YESTERDAY Section */}
                {conversationGroups.yesterday.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yesterday</span>
                    </div>
                    {conversationGroups.yesterday.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conv={conv} 
                        isActive={currentConversation?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onPin={() => togglePin(conv.id, !conv.pinned)}
                        onDelete={() => deleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* PREVIOUS 7 DAYS Section */}
                {conversationGroups.previous7Days.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Previous 7 Days</span>
                    </div>
                    {conversationGroups.previous7Days.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conv={conv} 
                        isActive={currentConversation?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onPin={() => togglePin(conv.id, !conv.pinned)}
                        onDelete={() => deleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* OLDER Section */}
                {conversationGroups.older.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Older</span>
                    </div>
                    {conversationGroups.older.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conv={conv} 
                        isActive={currentConversation?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onPin={() => togglePin(conv.id, !conv.pinned)}
                        onDelete={() => deleteConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {allConversations.length === 0 && !isLoading && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                    <p className="text-gray-400 text-sm">No conversations yet</p>
                    <p className="text-gray-500 text-xs mt-1">Start a new chat to begin</p>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="text-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-gray-500 border-t-cyan-400 rounded-full mx-auto"></div>
                    <p className="text-gray-400 text-sm mt-2">Loading...</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* User Profile Menu - Bottom Left */}
            <div className="p-4 pb-20 border-t" style={{ borderColor: COLORS.cyan + '40' }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    style={{ borderColor: COLORS.cyan }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: COLORS.red }}>
                        {userName.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="text-white text-sm font-medium">{userName}</div>
                        <div className="text-white/80 text-xs">{userPlan} Plan</div>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem>
                    <Globe className="w-4 h-4 mr-2" />
                    Language: {language}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Help & Support
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Plan
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileText className="w-4 h-4 mr-2" />
                    Asset Library
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Shield className="w-4 h-4 mr-2" />
                    Privacy & Security
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col relative">
          {/* Toggle buttons - Hide on mobile */}
          <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-10">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              style={{ borderColor: COLORS.cyan }}
            >
              {leftSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>

          {/* Chat Messages Area */}
          <ScrollArea className="flex-1 p-3 md:p-6">
            <div className="space-y-4 max-w-4xl mx-auto md:ml-[220px] pt-6">{/* Adjusted padding after moving avatar to right sidebar */}

              {/* Messages */}
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-white/70 mb-4">
                    <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: COLORS.javariCyan }} />
                    <p className="text-lg font-medium text-white">Ready to assist you</p>
                    <p className="text-sm">Ask me anything - I'll auto-select the best AI for your task</p>
                  </div>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-lg text-sm md:text-base"
                      style={{
                        backgroundColor: message.role === 'user' ? COLORS.cyan : COLORS.navy,
                        color: 'white',
                      }}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{aiProviders[message.provider || 'gpt-4']?.icon}</span>
                          <span className="text-xs opacity-75">
                            Javari via {aiProviders[message.provider || 'gpt-4']?.name}
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.role === 'assistant' && voiceEnabled && (
                        <VoicePanel text={message.content} autoPlay={false} />
                      )}
                      <span className="text-xs opacity-50 mt-2 block">
                        {new Date(message.timestamp).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area with AI Selector Below */}
          <div className="p-2 md:p-4 pb-6 md:pb-24 border-t" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.navy }}>
            {/* Text Input */}
            <div className="flex gap-2 mb-3">
              
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="p-2 md:p-3 rounded-lg transition-all mr-1"
                style={{
                  backgroundColor: voiceEnabled ? 'rgba(0, 188, 212, 0.2)' : 'transparent',
                  color: voiceEnabled ? '#00BCD4' : '#888',
                  border: voiceEnabled ? '1px solid rgba(0, 188, 212, 0.3)' : '1px solid #333',
                }}
                title={voiceEnabled ? "Javari voice ON" : "Javari voice OFF"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 md:w-5 md:h-5" /> : <VolumeX className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
              <button
                onClick={toggleSpeechRecognition}
                className="p-2 md:p-3 rounded-lg transition-all mr-2"
                style={{
                  backgroundColor: isListeningToUser ? 'rgba(253, 32, 29, 0.2)' : 'transparent',
                  color: isListeningToUser ? '#FD201D' : '#888',
                  border: isListeningToUser ? '1px solid rgba(253, 32, 29, 0.5)' : '1px solid #333',
                  animation: isListeningToUser ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
                title={isListeningToUser ? "Stop listening (click or will auto-send)" : "Click to speak"}
              >
                {isListeningToUser ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
              </button>
              <div className="flex-1 relative">
                {/* Live transcription display */}
                {(isListeningToUser || interimTranscript) && (
                  <div 
                    className="absolute -top-8 left-0 right-0 text-xs text-cyan-400 truncate"
                    style={{ color: '#00BCD4' }}
                  >
                    {isListeningToUser && <span className="animate-pulse">🎤 Listening... </span>}
                    {interimTranscript && <span className="opacity-70">{interimTranscript}</span>}
                  </div>
                )}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg border focus:outline-none focus:ring-2"
                style={{
                    backgroundColor: COLORS.javaribg,
                    borderColor: isListeningToUser ? '#FD201D' : COLORS.cyan,
                    color: 'white',
                  }}
                />
              </div>
              <Button
                onClick={handleSendMessage}
                className="px-3 md:px-4"
                style={{ backgroundColor: COLORS.red, color: 'white' }}
              >
                Send
              </Button>
            </div>

            {/* AI Model Selector - Scrollable on mobile */}
            <div className="flex justify-center mt-2 md:mt-4 overflow-x-auto">
              <div className="flex items-center gap-2 md:gap-3 bg-gray-900/50 rounded-lg p-2 md:p-3 border whitespace-nowrap" style={{ borderColor: COLORS.cyan + '40' }}>
                <span className="text-xs md:text-sm text-white font-medium hidden md:inline">Select AI:</span>
                {/* Auto Button */}
                <Button
                  size="sm"
                  variant={selectedAI === 'auto' ? 'default' : 'outline'}
                  onClick={() => setSelectedAI('auto')}
                  className="h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm font-medium"
                  style={selectedAI === 'auto' ? { 
                    backgroundColor: COLORS.javariCyan,
                    color: COLORS.navy,
                    borderColor: COLORS.javariCyan 
                  } : {
                    borderColor: COLORS.cyan + '60',
                    color: COLORS.cyan
                  }}
                >
                  ✨ Auto
                </Button>
                
                {/* AI Provider Buttons */}
                {Object.values(aiProviders).map(provider => (
                  <Button
                    key={provider.id}
                    size="sm"
                    variant={selectedAI === provider.id ? 'default' : 'outline'}
                    onClick={() => handleAIChange(provider.id)}
                    className="h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm font-medium"
                    style={selectedAI === provider.id ? { 
                      backgroundColor: COLORS.cyan,
                      color: COLORS.navy,
                      borderColor: COLORS.cyan 
                    } : {
                      borderColor: COLORS.cyan + '60',
                      color: COLORS.cyan
                    }}
                  >
                    {provider.icon} {provider.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR - Artifacts with Claude-Style Output - Hidden on mobile */}
        {rightSidebarOpen && (
          <div 
            className="hidden md:flex w-96 border-l flex-col sticky top-0 h-screen overflow-y-auto"
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40'
            }}
          >
            {/* Javari Avatar - Top of Right Panel */}
            <div className="p-6 border-b flex flex-col items-center" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.javaribg }}>
              <div className="relative mb-4">
                <Image
                  src="/avatars/javariavatar.png"
                  alt="Javari Avatar"
                  width={96}
                  height={96}
                  className="rounded-full object-cover"
                  style={{
                    border: `3px solid ${COLORS.javariCyan}`,
                    boxShadow: `0 0 30px ${COLORS.javariCyan}90, 0 0 60px ${COLORS.javariCyan}50`,
                    objectPosition: '60% center'
                  }}
                />
                {/* Live Indicator */}
                <div 
                  className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white animate-pulse"
                  style={{ backgroundColor: '#00FF00' }}
                />
              </div>
              <p className="text-white text-lg font-semibold mb-1">Javari AI</p>
              {selectedAI === 'auto' && (
                <p className="text-xs" style={{ color: COLORS.javariCyan }}>
                  Auto-selecting: {aiProviders[recommendedAI]?.name}
                </p>
              )}
            </div>

            {/* Javari AI Status - Always Visible */}
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.javaribg }}>
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: '#00FF00' }}
                />
                <p className="text-white/90 text-sm font-semibold">Javari AI Joins Every Chat</p>
              </div>
              <p className="text-xs text-white/60">Your AI partner across all conversations</p>
            </div>

            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <h3 className="text-white font-medium">Generated Content</h3>
              <p className="text-xs text-white/60 mt-1">Files and artifacts from this conversation</p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {artifacts.length === 0 ? (
                  <div className="text-center text-white/60 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No artifacts yet</p>
                    <p className="text-xs mt-1">Generated files will appear here</p>
                  </div>
                ) : (
                  artifacts.map(artifact => (
                    <div 
                      key={artifact.id}
                      className="border rounded-lg overflow-hidden"
                      style={{ 
                        borderColor: COLORS.cyan + '40',
                        backgroundColor: COLORS.javaribg 
                      }}
                    >
                      {/* Artifact Header with Tabs */}
                      <div className="p-3 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" style={{ color: COLORS.cyan }} />
                            <span className="text-white text-sm font-medium">{artifact.name}</span>
                          </div>
                          <span className="text-xs text-white/60">{artifact.size}</span>
                        </div>
                        {/* Code/Preview Tabs */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setArtifactViewMode(prev => ({ ...prev, [artifact.id]: 'code' }))}
                            className={`px-3 py-1 text-xs rounded-t ${
                              artifactViewMode[artifact.id] !== 'preview' 
                                ? 'bg-cyan-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            Code
                          </button>
                          <button
                            onClick={() => setArtifactViewMode(prev => ({ ...prev, [artifact.id]: 'preview' }))}
                            className={`px-3 py-1 text-xs rounded-t ${
                              artifactViewMode[artifact.id] === 'preview' 
                                ? 'bg-cyan-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            ▶ Preview
                          </button>
                        </div>
                      </div>

                      {/* Artifact Content - Code or Preview */}
                      <div className="relative">
                        {artifactViewMode[artifact.id] === 'preview' ? (
                          <div className="h-64 bg-slate-800">
                            <iframe
                              srcDoc={generatePreviewHTML(artifact.content, artifact.language || 'tsx')}
                              className="w-full h-full border-0"
                              sandbox="allow-scripts"
                              title={`Preview: ${artifact.name}`}
                            />
                          </div>
                        ) : (
                          <div className="p-3 max-h-48 overflow-auto">
                            <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                              <code>{artifact.content}</code>
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* Artifact Actions - Claude Style */}
                      <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: COLORS.cyan + '40' }}>
                        {/* Primary Action: Copy */}
                        <Button
                          size="sm"
                          onClick={() => copyArtifact(artifact.id, artifact.content)}
                          className="flex-1"
                          style={{
                            backgroundColor: copiedArtifacts[artifact.id] ? COLORS.cyan : COLORS.cyan,
                            color: COLORS.navy,
                          }}
                        >
                          {copiedArtifacts[artifact.id] ? (
                            <>
                              <Check className="w-3 h-3 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>

                        {/* Secondary Actions: More Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => downloadArtifact(artifact, artifact.type)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download as .{artifact.type}
                            </DropdownMenuItem>
                            {artifact.type === 'code' && (
                              <>
                                <DropdownMenuItem onClick={() => downloadArtifact(artifact, 'ts')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download as .ts
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadArtifact(artifact, 'tsx')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download as .tsx
                                </DropdownMenuItem>
                              </>
                            )}
                            {artifact.type === 'document' && (
                              <>
                                <DropdownMenuItem onClick={() => downloadArtifact(artifact, 'md')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download as .md
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadArtifact(artifact, 'txt')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download as .txt
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadArtifact(artifact, 'pdf')}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download as .pdf
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.print()}>
                              <Printer className="w-4 h-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Right sidebar toggle - Hidden on mobile */}
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            style={{ borderColor: COLORS.cyan }}
          >
            {rightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* AI Selection Confirmation Modal */}
      {aiSelectionModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            className="rounded-lg p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: COLORS.navy, border: `1px solid ${COLORS.cyan}40` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" style={{ color: COLORS.javariCyan }} />
                <h3 className="text-white font-medium text-lg">Switch AI Model?</h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAiSelectionModal({ ...aiSelectionModal, show: false })}
              >
                <X className="w-4 h-4 text-white/70 hover:text-white" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: COLORS.javaribg }}>
                <p className="text-white text-sm mb-3">
                  {selectedAI === 'auto' ? 'Javari recommends' : 'Currently using'}:
                </p>
                <div className="flex items-center justify-between mb-4 p-3 rounded border" style={{ borderColor: COLORS.cyan + '40' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{aiProviders[aiSelectionModal.currentAI]?.icon}</span>
                    <div>
                      <div className="text-white font-medium">{aiProviders[aiSelectionModal.currentAI]?.name}</div>
                      <div className="text-xs text-white/60">{aiProviders[aiSelectionModal.currentAI]?.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{aiSelectionModal.currentCredits} credits</div>
                    <div className="text-xs text-white/60">per message</div>
                  </div>
                </div>

                <div className="flex items-center justify-center mb-4">
                  <ChevronRight className="w-5 h-5 text-white/50" />
                </div>

                <p className="text-white text-sm mb-3">Switching to:</p>
                <div className="flex items-center justify-between p-3 rounded border" style={{ borderColor: COLORS.javariCyan }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{aiProviders[aiSelectionModal.newAI]?.icon}</span>
                    <div>
                      <div className="text-white font-medium">{aiProviders[aiSelectionModal.newAI]?.name}</div>
                      <div className="text-xs text-white/60">{aiProviders[aiSelectionModal.newAI]?.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{aiSelectionModal.newCredits} credits</div>
                    <div className="text-xs text-white/60">per message</div>
                  </div>
                </div>
              </div>

              {aiSelectionModal.newCredits !== aiSelectionModal.currentCredits && (
                <div 
                  className="p-3 rounded-lg text-center"
                  style={{ 
                    backgroundColor: aiSelectionModal.newCredits > aiSelectionModal.currentCredits ? COLORS.red + '20' : COLORS.cyan + '20',
                    border: `1px solid ${aiSelectionModal.newCredits > aiSelectionModal.currentCredits ? COLORS.red : COLORS.cyan}60`
                  }}
                >
                  <p className="text-sm text-white">
                    {aiSelectionModal.newCredits > aiSelectionModal.currentCredits ? (
                      <>⚠️ This will use {aiSelectionModal.newCredits - aiSelectionModal.currentCredits} more credits per message</>
                    ) : (
                      <>✅ This will save {aiSelectionModal.currentCredits - aiSelectionModal.newCredits} credits per message</>
                    )}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setAiSelectionModal({ ...aiSelectionModal, show: false })}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={confirmAIChange}
                  style={{ backgroundColor: COLORS.red, color: 'white' }}
                >
                  Switch AI
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Hints Bar */}
      <PromptHintsBar />
    </div>
  );
}


