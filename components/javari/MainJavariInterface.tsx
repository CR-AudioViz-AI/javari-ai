'use client';

import React, { useState, useEffect } from 'react';
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

  // Auto-detect best AI for query
  const detectBestAI = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('code') || lowerQuery.includes('debug') || lowerQuery.includes('function')) {
      return 'claude';
    }
    if (lowerQuery.includes('research') || lowerQuery.includes('search') || lowerQuery.includes('latest')) {
      return 'perplexity';
    }
    if (lowerQuery.includes('image') || lowerQuery.includes('picture') || lowerQuery.includes('visual')) {
      return 'gemini';
    }
    return 'gpt-4'; // Default
  };

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

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Auto-detect best AI if in auto mode
    let aiToUse = selectedAI;
    if (selectedAI === 'auto') {
      const detected = detectBestAI(inputMessage);
      setRecommendedAI(detected);
      aiToUse = detected;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, newMessage]);
    setInputMessage('');

    // TODO: Call API to get AI response
    // For now, simulate response with artifacts
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm processing your request using ${aiProviders[aiToUse].name}...`,
        timestamp: new Date().toISOString(),
        provider: aiToUse,
        hasArtifacts: Math.random() > 0.5, // Randomly add artifacts for demo
      };
      setMessages(prev => [...prev, aiResponse]);

      // Simulate artifact creation
      if (aiResponse.hasArtifacts) {
        const newArtifact: Artifact = {
          id: Date.now().toString(),
          name: 'Example Component.tsx',
          type: 'code',
          content: `import React from 'react';\n\nexport const ExampleComponent = () => {\n  return (\n    <div className="p-4">\n      <h1>Hello World</h1>\n    </div>\n  );\n};`,
          size: '1.2 KB',
          language: 'typescript',
        };
        setArtifacts(prev => [...prev, newArtifact]);
      }
    }, 1000);
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

  // Component JSX return
  return (
    <div className="h-screen flex" style={{ backgroundColor: COLORS.javaribg }}>
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
            {/* Quick Actions */}
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <Button 
                className="w-full mb-2"
                style={{ 
                  backgroundColor: COLORS.red,
                  color: 'white'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  All Chats
                </Button>
                <Button variant="outline" size="sm" style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}>
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
            <div className="p-4 border-t" style={{ borderColor: COLORS.cyan + '40' }}>
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
                        <div className="text-gray-400 text-xs">{userPlan} Plan</div>
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

          {/* Chat Messages Area with Logo & Video Conference */}
          <ScrollArea className="flex-1">
            <div className="space-y-4">
              {/* Top Section: Logo (Far Left) + Video Conference (Centered) */}
              <div className="relative w-full py-6 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
                {/* Logo - Far Left */}
                <div className="absolute left-4 top-6">
                  <Image
                    src="https://craudiovizai.com/logos/javari-logo.png"
                    alt="Javari AI"
                    width={40}
                    height={40}
                    className="rounded-lg"
                  />
                </div>

                {/* Video Conference - Centered */}
                <div className="flex flex-col items-center justify-center gap-3 px-20">
                  {/* Javari Avatar - Will be replaced with live video when she joins */}
                  <div className="relative">
                    <Image
                      src="https://craudiovizai.com/avatars/javari-avatar.png"
                      alt="Javari Avatar"
                      width={96}
                      height={96}
                      className="rounded-full"
                      style={{
                        border: `3px solid ${COLORS.javariCyan}`,
                        boxShadow: `0 0 30px ${COLORS.javariCyan}80`,
                      }}
                    />
                    {/* Live indicator */}
                    <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-green-500 border-4 border-gray-900 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                    </div>
                  </div>

                  {/* Javari Info */}
                  <div className="text-center">
                    <h2 className="text-white font-bold text-xl">Javari AI</h2>
                    <p className="text-gray-400 text-sm">Autonomous Development Assistant</p>
                    {selectedAI === 'auto' && (
                      <p className="text-xs mt-1" style={{ color: COLORS.javariCyan }}>
                        Auto-selecting: {aiProviders[recommendedAI]?.name}
                      </p>
                    )}
                  </div>

                  {/* Speaking/Listening indicator */}
                  {(isSpeaking || isListening) && (
                    <div className="flex items-center gap-2">
                      {isSpeaking && (
                        <>
                          <Volume2 className="w-4 h-4" style={{ color: COLORS.javariCyan }} />
                          <span className="text-sm text-white">Javari is speaking...</span>
                        </>
                      )}
                      {isListening && (
                        <>
                          <Mic className="w-4 h-4" style={{ color: COLORS.red }} />
                          <span className="text-sm text-white">Listening...</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Note about live avatar */}
                  <p className="text-xs text-gray-500 italic">
                    Javari joins every chat • Live video coming soon
                  </p>
                </div>
              </div>

              {/* Messages Container */}
              <div className="px-6 max-w-4xl mx-auto">

              {/* Messages Container */}
              <div className="px-6 max-w-4xl mx-auto">
              {/* Messages */}
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: COLORS.javariCyan }} />
                    <p className="text-lg font-medium text-white">Ready to assist you</p>
                    <p className="text-sm">Ask me anything - I'll auto-select the best AI for your task</p>
                  </div>
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
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
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          </ScrollArea>

          {/* Input Area with AI Selector Below */}
          <div className="p-4 border-t" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.navy }}>
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

            {/* AI Model Selector - Compact & Centered */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">AI Model:</span>
                {/* Auto Button */}
                <Button
                  size="sm"
                  variant={selectedAI === 'auto' ? 'default' : 'outline'}
                  onClick={() => setSelectedAI('auto')}
                  className="h-7 px-3 text-xs"
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
                    className="h-7 px-3 text-xs"
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
            className="w-96 border-l flex flex-col"
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40'
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <h3 className="text-white font-medium">Generated Content</h3>
              <p className="text-xs text-gray-400 mt-1">Files and artifacts from this conversation</p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {artifacts.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
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
                          <span className="text-xs text-gray-400">{artifact.size}</span>
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
                <X className="w-4 h-4 text-gray-400" />
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
                      <div className="text-xs text-gray-400">{aiProviders[aiSelectionModal.currentAI]?.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{aiSelectionModal.currentCredits} credits</div>
                    <div className="text-xs text-gray-400">per message</div>
                  </div>
                </div>

                <div className="flex items-center justify-center mb-4">
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <p className="text-white text-sm mb-3">Switching to:</p>
                <div className="flex items-center justify-between p-3 rounded border" style={{ borderColor: COLORS.javariCyan }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{aiProviders[aiSelectionModal.newAI]?.icon}</span>
                    <div>
                      <div className="text-white font-medium">{aiProviders[aiSelectionModal.newAI]?.name}</div>
                      <div className="text-xs text-gray-400">{aiProviders[aiSelectionModal.newAI]?.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{aiSelectionModal.newCredits} credits</div>
                    <div className="text-xs text-gray-400">per message</div>
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
