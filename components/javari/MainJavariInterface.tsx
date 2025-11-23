'use client';

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
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
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

  // ADDED: Load conversations from database
  useEffect(() => {
    const loadData = async () => {
      try {
        const conversations = await ChatService.loadConversations();
        if (conversations.length > 0) {
          const projectWithConvos: Project = {
            id: 'main',
            name: 'My Conversations',
            conversations: conversations.map(c => ({
              id: c.id,
              title: c.title,
              starred: c.starred || false,
              messages: [],
              updated_at: c.updated_at,
            })),
            starred: false,
          };
          setProjects([projectWithConvos]);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    };
    loadData();
  }, []);

  // ADDED: Load messages when conversation changes
  useEffect(() => {
    const loadMsgs = async () => {
      if (currentConversation && currentConversation.id) {
        try {
          const msgs = await ChatService.loadMessages(currentConversation.id);
          setMessages(msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            provider: m.provider,
          })));
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      }
    };
    loadMsgs();
  }, [currentConversation]);

  
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
    if (!convId) {
      const newConvo = await ChatService.createConversation(userMessage.substring(0, 50));
      if (!newConvo) return;
      convId = newConvo.id;
      setCurrentConversation({
        id: newConvo.id,
        title: newConvo.title,
        starred: false,
        messages: [],
        updated_at: newConvo.updated_at,
      });
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
    await ChatService.saveMessage(convId, 'user', userMessage);

    // Create placeholder for AI response
    const aiResponseId = (Date.now() + 1).toString();
    const aiResponse: Message = {
      id: aiResponseId,
      role: 'assistant',
      content: '',
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
          conversationId: convId
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();

      // Check if autonomous deployment
      if (data.isAutonomous && data.workflowId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiResponseId ? { ...m, content: data.message, provider: 'javari' } : m
          )
        );

        // Poll for deployment status
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/autonomous/status/${data.workflowId}`);
          const { workflow } = await statusRes.json();

          if (workflow.status === 'success') {
            clearInterval(pollInterval);
            const successMsg = `✅ Live: https://${workflow.artifacts.deploymentUrl}\n📁 Repo: ${workflow.artifacts.repoUrl}`;
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: successMsg,
              timestamp: new Date().toISOString(),
              provider: 'javari',
            }]);
            await ChatService.saveMessage(convId, 'assistant', successMsg, 'javari');
          } else if (workflow.status === 'failed') {
            clearInterval(pollInterval);
            const errorMsg = `❌ Build failed: ${workflow.error?.message || 'Unknown error'}`;
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: errorMsg,
              timestamp: new Date().toISOString(),
              provider: 'error',
            }]);
            await ChatService.saveMessage(convId, 'assistant', errorMsg, 'error');
          }
        }, 5000);
        return;
      }

      // Regular response - no streaming, just display
      setMessages(prev =>
        prev.map(m =>
          m.id === aiResponseId ? { ...m, content: data.message, provider: data.provider } : m
        )
      );

      // Handle streaming response (legacy support)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = data.message || '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const { text } = JSON.parse(data);
                accumulatedContent += text;

                // Update message with streaming content
                setMessages(prev => 
                  prev.map(m => 
                    m.id === aiResponseId 
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // TODO: Parse content for artifacts (code blocks, documents, etc.)
      // If code blocks found, create artifacts
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const codeBlocks = [...accumulatedContent.matchAll(codeBlockRegex)];
      
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
      // Update message with error
      setMessages(prev => 
        prev.map(m => 
          m.id === aiResponseId 
            ? { 
                ...m, 
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                provider: aiToUse
              }
            : m
        )
      );
    }
  };

  // Handle New Chat - Clear current chat and allow rename
  const handleNewChat = () => {
    // Clear messages
    setMessages([]);
    // Create new conversation
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      starred: false,
      messages: [],
      updated_at: new Date().toISOString(),
    };
    setCurrentConversation(newConversation);
    // Focus on input (optional - could add ref)
    console.log('New chat created:', newConversation.id);
  };

  // Handle All Chats - Show list of all user's chats
  const handleAllChats = () => {
    // TODO: Implement chat list modal/sidebar
    // For now, log the action
    console.log('All Chats clicked - showing chat history');
    // Future: Open modal with all conversations from database
    alert('All Chats feature coming soon! This will show your complete chat history.');
  };

  // Handle Projects - Allow project management and chat organization
  const handleProjects = () => {
    // TODO: Implement projects modal/sidebar
    // For now, log the action
    console.log('Projects clicked - opening project manager');
    // Future: Open modal to create/manage projects, tag chats to projects
    alert('Projects feature coming soon! This will let you organize chats by project.');
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
            {/* Logo - Top of Sidebar */}
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
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAllChats}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  All Chats
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleProjects}
                  style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
                >
                  <FolderKanban className="w-4 h-4 mr-2" />
                  Projects
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
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    <Card className="p-3 cursor-pointer hover:bg-gray-800" style={{ backgroundColor: COLORS.javaribg }}>
                      <div className="text-white text-sm font-medium">Project: CR AudioViz AI</div>
                      <div className="text-gray-400 text-xs mt-1">- Chat: Deploy fixes</div>
                      <div className="text-gray-400 text-xs">- Chat: Database optimization</div>
                    </Card>
                  </div>
                </ScrollArea>
              </div>
            </div>

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

          {/* Chat Messages Area */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 max-w-4xl mx-auto ml-[220px] pt-6">{/* Adjusted padding after moving avatar to right sidebar */}

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
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area with AI Selector Below */}
          <div className="p-4 pb-24 border-t" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.navy }}>
            {/* Text Input */}
            <div className="flex gap-2 mb-3">
              <Button
                size="icon"
                variant="outline"
                style={{ borderColor: COLORS.cyan }}
                onClick={() => setIsListening(!isListening)}
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
                onClick={handleSendMessage}
                style={{ backgroundColor: COLORS.red, color: 'white' }}
              >
                Send
              </Button>
            </div>

            {/* AI Model Selector - Large & Prominent */}
            <div className="flex justify-center mt-4">
              <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 border" style={{ borderColor: COLORS.cyan + '40' }}>
                <span className="text-sm text-white font-medium">Select AI Model:</span>
                {/* Auto Button */}
                <Button
                  size="default"
                  variant={selectedAI === 'auto' ? 'default' : 'outline'}
                  onClick={() => setSelectedAI('auto')}
                  className="h-10 px-4 text-sm font-medium"
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
                    size="default"
                    variant={selectedAI === provider.id ? 'default' : 'outline'}
                    onClick={() => handleAIChange(provider.id)}
                    className="h-10 px-4 text-sm font-medium"
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

        {/* RIGHT SIDEBAR - Artifacts with Claude-Style Output */}
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
