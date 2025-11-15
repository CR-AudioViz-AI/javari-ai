'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
  const [allChatsPanelOpen, setAllChatsPanelOpen] = useState(false);
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
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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

    const claudeKeywords = ['code', 'function', 'class', 'algorithm', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'react', 'api', 'database', 'sql'];
    const claudeMatches = claudeKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['claude'] = claudeMatches * 3;

    const perplexityKeywords = ['research', 'latest', 'current', 'news', 'recent', 'today', '2024', '2025', 'search', 'find'];
    const perplexityMatches = perplexityKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['perplexity'] = perplexityMatches * 3;

    const geminiKeywords = ['image', 'picture', 'photo', 'visual', 'diagram', 'chart', 'graph', 'design'];
    const geminiMatches = geminiKeywords.filter(k => lowerQuery.includes(k)).length;
    scores['gemini'] = geminiMatches * 3;

    const gpt4Keywords = ['write', 'essay', 'article', 'blog', 'story', 'content', 'email'];
    const gpt4Matches = gpt4Keywords.filter(k => lowerQuery.includes(k)).length;
    scores['gpt-4'] = gpt4Matches * 3;

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'gpt-4';

    return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'gpt-4';
  };

  // Voice recognition setup
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
              return (cleanPrev + ' ' + finalTranscript).trim();
            } else if (interimTranscript) {
              return cleanPrev + (cleanPrev ? ' ' : '') + '[' + interimTranscript + ']';
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
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.log('Recognition restart skipped');
            }
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

  // Toggle voice input
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Clean up any interim text in brackets
      setInputMessage(prev => prev.replace(/\[.*?\]$/, '').trim());
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Speak text (Javari's voice)
  const speakText = (text: string) => {
    if ('speechSynthesis' in window && isSpeaking) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.name.includes('Female') || 
        voice.name.includes('Samantha') ||
        voice.name.includes('Victoria') ||
        voice.name.includes('Karen')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  // Chat management functions
  const handleNewChat = () => {
    const newChat: Conversation = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      starred: true, // New chats start as starred
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
    setAllChatsPanelOpen(false); // Close panel when switching
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

    const cleanMessage = inputMessage.replace(/\[.*?\]$/, '').trim();
    if (!cleanMessage) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: cleanMessage,
      timestamp: new Date().toISOString(),
    };

    const activeAI = selectedAI === 'auto' ? detectBestAI(cleanMessage) : selectedAI;
    setRecommendedAI(activeAI);

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');

    // Update current conversation
    if (currentConversation) {
      const updatedConv = {
        ...currentConversation,
        messages: updatedMessages,
        title: currentConversation.messages.length === 0 
          ? cleanMessage.slice(0, 50) + (cleanMessage.length > 50 ? '...' : '')
          : currentConversation.title,
        updated_at: new Date().toISOString(),
      };
      setCurrentConversation(updatedConv);
      setConversations(conversations.map(conv => 
        conv.id === updatedConv.id ? updatedConv : conv
      ));
    }

    // Map UI AI provider to actual model
    const modelMap: Record<string, string> = {
      'gpt-4': 'gpt-4-turbo-preview',
      'claude': 'claude-sonnet-4-5-20250929',
      'gemini': 'gpt-4-turbo-preview', // Fallback to GPT-4 for now
      'perplexity': 'gpt-4-turbo-preview', // Fallback to GPT-4 for now
    };

    const modelToUse = modelMap[activeAI] || 'gpt-4-turbo-preview';

    // Create placeholder for assistant message
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      provider: activeAI,
    };

    const messagesWithPlaceholder = [...updatedMessages, assistantPlaceholder];
    setMessages(messagesWithPlaceholder);

    try {
      // Call REAL AI API with streaming
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMessage,
          model: modelToUse,
          history: updatedMessages.slice(-10).map(m => ({ // Send last 10 messages for context
            role: m.role,
            content: m.content,
          })),
          maxTokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  
                  // Update message in real-time
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessageId 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Final update with complete response
      const finalMessages = messagesWithPlaceholder.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: accumulatedContent || 'I apologize, but I encountered an error processing your request.' }
          : msg
      );

      setMessages(finalMessages);

      // Speak if voice is enabled
      if (isSpeaking && accumulatedContent) {
        speakText(accumulatedContent);
      }

      // Update conversation with Javari's response
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
    } catch (error) {
      console.error('Chat API error:', error);
      
      // Show error message
      const errorMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or check your API configuration.',
        timestamp: new Date().toISOString(),
        provider: activeAI,
      };

      const errorMessages = [...updatedMessages, errorMessage];
      setMessages(errorMessages);

      if (currentConversation) {
        const errorConv = {
          ...currentConversation,
          messages: errorMessages,
          updated_at: new Date().toISOString(),
        };
        setCurrentConversation(errorConv);
        setConversations(conversations.map(conv => 
          conv.id === errorConv.id ? errorConv : conv
        ));
      }
    }
  };

  const copyArtifact = (artifactId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedArtifacts({ ...copiedArtifacts, [artifactId]: true });
    setTimeout(() => {
      setCopiedArtifacts({ ...copiedArtifacts, [artifactId]: false });
    }, 2000);
  };

  const downloadArtifact = (artifact: Artifact, format: string) => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.name}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const starredConversations = conversations.filter(conv => conv.starred);
  const unstarredConversations = conversations.filter(conv => !conv.starred);

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: COLORS.javaribg }}>
      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        {leftSidebarOpen && (
          <div 
            className="w-80 border-r flex flex-col"
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40'
            }}
          >
            {/* Logo */}
            <div className="p-4 flex justify-center border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <Image
                src="/javariailogo.png"
                alt="Javari AI"
                width={80}
                height={80}
                className="rounded-lg"
              />
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <Button 
                className="w-full mb-2"
                onClick={handleNewChat}
                style={{ 
                  backgroundColor: COLORS.red,
                  color: 'white'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAllChatsPanelOpen(true)}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  All Chats
                  {unstarredConversations.length > 0 && (
                    <span className="ml-1 text-xs">({unstarredConversations.length})</span>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => console.log('Projects clicked')}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  <FolderKanban className="w-4 h-4 mr-2" />
                  Projects
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => console.log('Artifacts clicked')}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Artifacts
                </Button>
              </div>
            </div>

            {/* Starred Conversations */}
            <div className="flex-1 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
                  <span className="text-white font-medium">Starred</span>
                </div>
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="space-y-2">
                    {starredConversations.length === 0 ? (
                      <div className="text-center text-white/40 py-8 text-sm">
                        No starred chats yet
                      </div>
                    ) : (
                      starredConversations.map((conv) => (
                        <Card 
                          key={conv.id}
                          className="p-3 cursor-pointer hover:bg-opacity-80 transition-colors group"
                          style={{ 
                            backgroundColor: currentConversation?.id === conv.id ? COLORS.cyan + '20' : COLORS.javaribg,
                            border: currentConversation?.id === conv.id ? `1px solid ${COLORS.cyan}` : 'none'
                          }}
                          onClick={() => switchConversation(conv)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{conv.title}</div>
                              <div className="text-gray-400 text-xs mt-1">
                                {conv.messages.length} messages
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(conv.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                            >
                              <Star className="w-3 h-3" style={{ color: COLORS.javariCyan }} fill={COLORS.javariCyan} />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* User Profile Menu */}
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

        {/* All Chats Sliding Panel */}
        {allChatsPanelOpen && (
          <div 
            className="fixed inset-0 z-50 flex"
            onClick={() => setAllChatsPanelOpen(false)}
          >
            <div 
              className="w-96 h-full border-r flex flex-col"
              style={{ 
                backgroundColor: COLORS.navy,
                borderColor: COLORS.cyan + '40'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: COLORS.cyan + '40' }}>
                <h2 className="text-white text-lg font-medium">All Chats</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAllChatsPanelOpen(false)}
                >
                  <X className="w-4 h-4 text-white" />
                </Button>
              </div>

              {/* Unstarred Chats List */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {unstarredConversations.length === 0 ? (
                    <div className="text-center text-white/40 py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No unstarred chats</p>
                    </div>
                  ) : (
                    unstarredConversations.map((conv) => (
                      <Card
                        key={conv.id}
                        className="p-3 hover:bg-opacity-80 transition-colors"
                        style={{ backgroundColor: COLORS.javaribg }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => switchConversation(conv)}
                          >
                            <div className="text-white text-sm font-medium truncate">{conv.title}</div>
                            <div className="text-gray-400 text-xs mt-1">
                              {conv.messages.length} messages · {new Date(conv.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(conv.id);
                            }}
                            style={{ borderColor: COLORS.javariCyan, color: COLORS.javariCyan }}
                            className="flex-1"
                          >
                            <Star className="w-3 h-3 mr-1" />
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
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="flex-1 bg-black bg-opacity-50" onClick={() => setAllChatsPanelOpen(false)} />
          </div>
        )}

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col relative">
          {/* Toggle buttons */}
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

          {/* Chat Messages Area - Fills remaining space */}
          <ScrollArea className="flex-1 p-6" style={{ paddingBottom: '200px' }}>
            <div className="space-y-4 max-w-4xl mx-auto pt-6">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-white/70 mb-4">
                    <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: COLORS.javariCyan }} />
                    <p className="text-2xl font-bold text-white mb-2">Javari is learning and ready to build</p>
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
                      className="max-w-[70%] p-4 rounded-lg"
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
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* STICKY INPUT AREA - Fixed at bottom */}
          <div 
            className="fixed bottom-0 left-0 right-0 border-t" 
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40',
              marginLeft: leftSidebarOpen ? '320px' : '0px',
              marginRight: rightSidebarOpen ? '384px' : '0px',
              transition: 'margin 0.3s ease',
              zIndex: 40
            }}
          >
            {/* Text Input Area */}
            <div className="p-4 flex gap-2">
              <Button
                size="icon"
                variant="outline"
                style={{ borderColor: COLORS.cyan }}
                onClick={toggleVoiceInput}
              >
                {isListening ? (
                  <Mic className="w-4 h-4" style={{ color: COLORS.red }} />
                ) : (
                  <MicOff className="w-4 h-4" style={{ color: COLORS.cyan }} />
                )}
              </Button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: COLORS.javaribg,
                  borderColor: COLORS.cyan,
                  color: 'white',
                }}
              />
              <Button
                size="icon"
                variant="outline"
                style={{ borderColor: COLORS.cyan }}
                onClick={() => setIsSpeaking(!isSpeaking)}
              >
                {isSpeaking ? (
                  <Volume2 className="w-4 h-4" style={{ color: COLORS.cyan }} />
                ) : (
                  <VolumeX className="w-4 h-4" style={{ color: COLORS.cyan }} />
                )}
              </Button>
              <Button
                onClick={handleSendMessage}
                style={{ backgroundColor: COLORS.red, color: 'white' }}
              >
                Send
              </Button>
            </div>

            {/* AI Model Selector - Compact at bottom */}
            <div className="px-4 pb-4 border-t pt-2" style={{ borderColor: COLORS.cyan + '20' }}>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-white/70">AI:</span>
                {/* Auto Button */}
                <Button
                  size="sm"
                  variant={selectedAI === 'auto' ? 'default' : 'outline'}
                  onClick={() => setSelectedAI('auto')}
                  className="h-7 px-2 text-xs"
                  style={selectedAI === 'auto' ? { 
                    backgroundColor: COLORS.javariCyan,
                    color: COLORS.navy,
                    borderColor: COLORS.javariCyan 
                  } : {
                    borderColor: COLORS.cyan + '40',
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
                    className="h-7 px-2 text-xs"
                    style={selectedAI === provider.id ? { 
                      backgroundColor: COLORS.cyan,
                      color: COLORS.navy,
                      borderColor: COLORS.cyan 
                    } : {
                      borderColor: COLORS.cyan + '40',
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

        {/* RIGHT SIDEBAR - Artifacts */}
        {rightSidebarOpen && (
          <div 
            className="w-96 border-l flex flex-col sticky top-0 h-screen overflow-y-auto"
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

            {/* Artifacts Header */}
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <h3 className="text-white font-medium">Artifacts</h3>
              <p className="text-xs text-white/60 mt-1">Auto-documented project files</p>
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
                      {/* Artifact Header */}
                      <div className="p-3 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" style={{ color: COLORS.cyan }} />
                            <span className="text-white text-sm font-medium">{artifact.name}</span>
                          </div>
                          <span className="text-xs text-white/60">{artifact.size}</span>
                        </div>
                      </div>

                      {/* Artifact Content Preview */}
                      <div className="p-3">
                        <pre className="text-xs text-gray-300 overflow-x-auto">
                          <code>{artifact.content.substring(0, 200)}...</code>
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
                              Download
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
                <p className="text-white text-sm mb-3">Currently using:</p>
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

