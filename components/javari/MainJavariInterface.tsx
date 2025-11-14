'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PromptHintsBar } from '@/components/javari/PromptHintsBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  starred: boolean;
  messages: Message[];
  project_id?: string;
  updated_at: string;
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
  language?: string;
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
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [credits, setCredits] = useState({ current: 1250, total: 5000 });
  const [userPlan, setUserPlan] = useState('Pro');
  const [userName, setUserName] = useState('Roy Henderson');
  const [language, setLanguage] = useState('English');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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
  const [showAllChatsModal, setShowAllChatsModal] = useState(false);
  const [isJavariSpeaking, setIsJavariSpeaking] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  // Enhanced AI detection
  const detectBestAI = (query: string): string => {
    const lowerQuery = query.toLowerCase()
    const scores: Record<string, number> = {
      'gpt-4': 0,
      'claude': 0,
      'gemini': 0,
      'perplexity': 0
    }

    const claudeKeywords = ['code', 'function', 'class', 'algorithm', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'react', 'api', 'database', 'sql', 'component', 'analyze', 'technical', 'architecture'];
    const claudeMatches = claudeKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['claude'] = claudeMatches * 3;

    const perplexityKeywords = ['research', 'latest', 'current', 'news', 'recent', 'today', '2024', '2025', 'search', 'find', 'what is', 'who is', 'trend', 'market', 'statistics'];
    const perplexityMatches = perplexityKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['perplexity'] = perplexityMatches * 3;

    const geminiKeywords = ['image', 'picture', 'photo', 'visual', 'diagram', 'chart', 'graph', 'design', 'ui', 'mockup', 'video', 'audio'];
    const geminiMatches = geminiKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['gemini'] = geminiMatches * 3;

    const gpt4Keywords = ['write', 'essay', 'article', 'blog', 'story', 'content', 'email', 'letter', 'explain', 'summarize', 'brainstorm', 'creative', 'strategy'];
    const gpt4Matches = gpt4Keywords.filter(k => lowerQuery.includes(k)).length;
    scores['gpt-4'] = gpt4Matches * 3;

    if (lowerQuery.length > 200 && /function|class|import|export|const|let/i.test(query)) {
      scores['claude'] += 5;
    }

    if (/\d{4}|today|now|current|latest/i.test(query)) {
      scores['perplexity'] += 3;
    }

    if (/create|generate|design|make.*look/i.test(query)) {
      scores['gemini'] += 2;
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'gpt-4';

    const topAIs = Object.entries(scores)
      .filter(([_, score]) => score === maxScore)
      .map(([ai, _]) => ai);

    return topAIs.length === 1 ? topAIs[0] : topAIs[0];
  };

  // Voice functionality
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          setInputMessage((prev) => {
            const cleanPrev = prev.replace(/\[.*?\]$/, '').trim();
            if (finalTranscript) {
              return cleanPrev + ' ' + finalTranscript;
            } else if (interimTranscript) {
              return cleanPrev + ' [' + interimTranscript + ']';
            }
            return cleanPrev;
          });
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          if (isListening) {
            recognitionRef.current?.start();
          }
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('Samantha') ||
        voice.name.includes('Victoria')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onstart = () => {
        setIsJavariSpeaking(true);
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsJavariSpeaking(false);
        setIsSpeaking(false);
      };

      synthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsJavariSpeaking(false);
      setIsSpeaking(false);
    }
  };

  // Chat management functions
  const createNewChat = () => {
    const newChat: Conversation = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      starred: true,
      messages: [],
      updated_at: new Date().toISOString(),
    };
    setConversations([newChat, ...conversations]);
    setCurrentConversation(newChat);
    setMessages([]);
    setArtifacts([]);
  };

  const switchConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages(conversation.messages);
    setArtifacts([]);
  };

  const toggleStar = (conversationId: string) => {
    setConversations(conversations.map(conv => 
      conv.id === conversationId 
        ? { ...conv, starred: !conv.starred }
        : conv
    ));
  };

  const deleteConversation = (conversationId: string) => {
    setConversations(conversations.filter(conv => conv.id !== conversationId));
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const handleAIChange = (aiId: string) => {
    if (aiId === selectedAI) return;

    const currentAI = selectedAI === 'auto' ? recommendedAI : selectedAI;
    const currentProvider = aiProviders[currentAI];
    const newProvider = aiProviders[aiId];

    if (aiId === 'auto') {
      setSelectedAI('auto');
      return;
    }

    setAiSelectionModal({
      show: true,
      currentAI: currentAI,
      newAI: aiId,
      currentCredits: currentProvider?.credits || 0,
      newCredits: newProvider?.credits || 0,
    });
  };

  const confirmAIChange = () => {
    setSelectedAI(aiSelectionModal.newAI);
    setAiSelectionModal({ ...aiSelectionModal, show: false });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    const activeAI = selectedAI === 'auto' ? detectBestAI(inputMessage) : selectedAI;
    setRecommendedAI(activeAI);

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');

    if (currentConversation) {
      const updatedConv = {
        ...currentConversation,
        messages: updatedMessages,
        title: currentConversation.messages.length === 0 
          ? inputMessage.slice(0, 50) 
          : currentConversation.title,
        updated_at: new Date().toISOString(),
      };
      setCurrentConversation(updatedConv);
      setConversations(conversations.map(conv => 
        conv.id === updatedConv.id ? updatedConv : conv
      ));
    }

    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: `This is a simulated response from ${aiProviders[activeAI].name}. In production, this would connect to the actual AI API.`,
        timestamp: new Date().toISOString(),
        provider: activeAI,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      if (isSpeaking) {
        speakText(assistantMessage.content);
      }

      if (currentConversation) {
        const finalConv = {
          ...currentConversation,
          messages: finalMessages,
          updated_at: new Date().toISOString(),
        };
        setCurrentConversation(finalConv);
        setConversations(conversations.map(conv => 
          conv.id === finalConv.id ? finalConv : conv
        ));
      }
    }, 1000);
  };

  const copyArtifact = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedArtifacts({ ...copiedArtifacts, [id]: true });
    setTimeout(() => {
      setCopiedArtifacts({ ...copiedArtifacts, [id]: false });
    }, 2000);
  };

  const downloadArtifact = (artifact: Artifact, extension: string) => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.name}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const starredConversations = conversations.filter(conv => conv.starred);
  const unstarredConversations = conversations.filter(conv => !conv.starred);

  return (
    <div className="h-screen flex" style={{ backgroundColor: COLORS.javaribg }}>
      {/* Left Sidebar */}
      {leftSidebarOpen && (
        <div className="w-80 border-r flex flex-col" style={{ borderColor: COLORS.cyan + '40' }}>
          <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
            <Button
              onClick={createNewChat}
              className="w-full"
              style={{ backgroundColor: COLORS.red, color: 'white' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Starred Conversations */}
              {starredConversations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <Star className="w-4 h-4" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
                    <span className="text-sm font-medium text-white/70">Starred Chats</span>
                  </div>
                  {starredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="group p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                      style={{
                        backgroundColor: currentConversation?.id === conv.id ? COLORS.cyan + '20' : 'transparent',
                        border: currentConversation?.id === conv.id ? `1px solid ${COLORS.cyan}` : '1px solid transparent',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 flex-1 min-w-0"
                          onClick={() => switchConversation(conv)}
                        >
                          <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: COLORS.cyan }} />
                          <span className="text-white text-sm truncate">{conv.title}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(conv.id);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Star className="w-3 h-3" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All Chats Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  style={{ borderColor: COLORS.cyan + '40', color: 'white' }}
                  onClick={() => setShowAllChatsModal(true)}
                >
                  <FolderKanban className="w-4 h-4 mr-2" style={{ color: COLORS.cyan }} />
                  All Chats ({unstarredConversations.length})
                </Button>
              </div>

              {/* Projects Section */}
              <div className="space-y-2 pt-4">
                <div className="text-sm font-medium text-white/50 px-2">PROJECTS</div>
                {projects.length === 0 ? (
                  <div className="text-xs text-white/40 px-2 py-4 text-center">
                    No projects yet
                  </div>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 cursor-pointer">
                        <FolderKanban className="w-4 h-4" style={{ color: COLORS.cyan }} />
                        <span className="text-sm text-white">{project.name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Navigation */}
          <div className="p-4 border-t space-y-2" style={{ borderColor: COLORS.cyan + '40' }}>
            <Button variant="ghost" className="w-full justify-start text-white/70">
              <Globe className="w-4 h-4 mr-2" />
              Explore Apps
            </Button>
            <Button variant="ghost" className="w-full justify-start text-white/70">
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </Button>
            <Button variant="ghost" className="w-full justify-start text-white/70">
              <CreditCard className="w-4 h-4 mr-2" />
              Credits: {credits.current.toLocaleString()}/{credits.total.toLocaleString()}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-white/70">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem>
                  <FileText className="w-4 h-4 mr-2" />
                  Terms of Service
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Policy
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Left sidebar toggle */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          style={{ borderColor: COLORS.cyan }}
        >
          {leftSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>

      {/* Center Panel - Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <Image
                src="/javari-avatar.png"
                alt="Javari AI"
                width={120}
                height={120}
                className="mb-6 rounded-full"
              />
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to Javari AI
              </h2>
              <p className="text-white/60 max-w-md">
                Start a conversation to experience intelligent AI assistance
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <Image
                        src="/javari-avatar.png"
                        alt="Javari AI"
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                    </div>
                  )}
                  <div
                    className="rounded-lg p-4 max-w-[80%]"
                    style={{
                      backgroundColor: message.role === 'user' ? COLORS.navy : COLORS.cyan + '10',
                      border: `1px solid ${message.role === 'user' ? COLORS.cyan : COLORS.cyan + '40'}`,
                    }}
                  >
                    {message.provider && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-white/60">
                        <span>{aiProviders[message.provider]?.icon}</span>
                        <span>{aiProviders[message.provider]?.name}</span>
                      </div>
                    )}
                    <p className="text-white whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: COLORS.red }}
                      >
                        {userName.charAt(0)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* AI Model Selector - Bottom of Center Column */}
        <div className="border-t px-6 py-3" style={{ borderColor: COLORS.cyan + '40' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70 flex-shrink-0">Select AI Model:</span>
              <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                <Button
                  size="sm"
                  variant={selectedAI === 'auto' ? 'default' : 'outline'}
                  onClick={() => setSelectedAI('auto')}
                  style={{
                    backgroundColor: selectedAI === 'auto' ? COLORS.javariCyan : 'transparent',
                    borderColor: COLORS.javariCyan,
                    color: selectedAI === 'auto' ? COLORS.navy : COLORS.javariCyan,
                  }}
                  className="flex-shrink-0"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Auto ({aiProviders[recommendedAI]?.icon})
                </Button>
                {Object.values(aiProviders).map((provider) => (
                  <Button
                    key={provider.id}
                    size="sm"
                    variant={selectedAI === provider.id ? 'default' : 'outline'}
                    onClick={() => handleAIChange(provider.id)}
                    style={{
                      backgroundColor: selectedAI === provider.id ? COLORS.cyan : 'transparent',
                      borderColor: COLORS.cyan,
                      color: selectedAI === provider.id ? COLORS.navy : 'white',
                    }}
                    className="flex-shrink-0"
                  >
                    <span className="mr-1">{provider.icon}</span>
                    {provider.name}
                    <span className="ml-1 text-xs opacity-70">({provider.credits}cr)</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Message Input - Bottom of Center Column */}
        <div className="border-t p-6" style={{ borderColor: COLORS.cyan + '40' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: COLORS.navy,
                    color: 'white',
                    border: `1px solid ${COLORS.cyan}40`,
                    minHeight: '56px',
                    maxHeight: '200px',
                  }}
                  rows={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleVoiceInput}
                  style={{
                    backgroundColor: isListening ? COLORS.red : 'transparent',
                    borderColor: isListening ? COLORS.red : COLORS.cyan,
                    color: isListening ? 'white' : COLORS.cyan,
                  }}
                >
                  {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isSpeaking ? stopSpeaking : () => setIsSpeaking(!isSpeaking)}
                  style={{
                    backgroundColor: isSpeaking ? COLORS.cyan : 'transparent',
                    borderColor: COLORS.cyan,
                    color: isSpeaking ? COLORS.navy : COLORS.cyan,
                  }}
                >
                  {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  style={{ backgroundColor: COLORS.red, color: 'white' }}
                >
                  Send
                </Button>
              </div>
            </div>
            {isListening && (
              <div className="mt-2 text-xs" style={{ color: COLORS.javariCyan }}>
                🎤 Listening... Speak now
              </div>
            )}
            {isJavariSpeaking && (
              <div className="mt-2 text-xs" style={{ color: COLORS.javariCyan }}>
                🔊 Javari is speaking...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Artifacts & Avatar */}
      {rightSidebarOpen && (
        <div className="w-80 border-l flex flex-col" style={{ borderColor: COLORS.cyan + '40' }}>
          {/* Avatar Section - Top of Right Panel */}
          <div className="p-6 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
            <div className="flex flex-col items-center text-center">
              <Image
                src="/javari-avatar.png"
                alt="Javari AI"
                width={80}
                height={80}
                className="rounded-full mb-3"
              />
              <h3 className="text-white font-medium text-lg">Javari AI</h3>
            </div>
          </div>

          {/* Artifacts Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <h3 className="text-white font-medium flex items-center gap-2">
                <FileDown className="w-4 h-4" />
                Artifacts
              </h3>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {artifacts.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No artifacts yet</p>
                    <p className="text-xs mt-1">Generated files will appear here</p>
                  </div>
                ) : (
                  artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="mb-4 rounded-lg overflow-hidden"
                      style={{ border: `1px solid ${COLORS.cyan}40` }}
                    >
                      {/* Artifact Header */}
                      <div className="p-3" style={{ backgroundColor: COLORS.navy }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{artifact.name}</span>
                          <span className="text-xs text-white/60">{artifact.size}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: COLORS.cyan + '20', color: COLORS.cyan }}
                          >
                            {artifact.type}
                          </span>
                          {artifact.language && (
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: COLORS.javariCyan + '20', color: COLORS.javariCyan }}
                            >
                              {artifact.language}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Artifact Preview */}
                      <div className="p-3 max-h-48 overflow-y-auto" style={{ backgroundColor: COLORS.javaribg }}>
                        <pre className="text-xs text-white/80 whitespace-pre-wrap font-mono">
                          {artifact.content}
                        </pre>
                      </div>

                      {/* Artifact Actions */}
                      <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: COLORS.cyan + '40' }}>
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
        </div>
      )}

      {/* Right sidebar toggle */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          style={{ borderColor: COLORS.cyan }}
        >
          {rightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* All Chats Modal */}
      <Dialog open={showAllChatsModal} onOpenChange={setShowAllChatsModal}>
        <DialogContent 
          className="max-w-2xl max-h-[80vh]"
          style={{ backgroundColor: COLORS.navy, border: `1px solid ${COLORS.cyan}40` }}
        >
          <DialogHeader>
            <DialogTitle className="text-white text-xl">All Chats</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-4">
              {unstarredConversations.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No unstarred chats</p>
                </div>
              ) : (
                unstarredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="group p-4 rounded-lg transition-colors hover:bg-white/5"
                    style={{ border: `1px solid ${COLORS.cyan}40` }}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          switchConversation(conv);
                          setShowAllChatsModal(false);
                        }}
                      >
                        <MessageSquare className="w-5 h-5 flex-shrink-0" style={{ color: COLORS.cyan }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{conv.title}</div>
                          <div className="text-xs text-white/60">
                            {conv.messages.length} messages · {new Date(conv.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(conv.id);
                          }}
                          style={{ borderColor: COLORS.javariCyan, color: COLORS.javariCyan }}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Star
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          style={{ borderColor: COLORS.red, color: COLORS.red }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
