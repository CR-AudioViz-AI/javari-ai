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
  Download,
  Printer,
  FileDown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
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
  type: 'code' | 'document' | 'image';
  size: string;
  url: string;
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
  const [selectedAI, setSelectedAI] = useState<string>('gpt-4');

  // AI Providers
  const aiProviders = [
    { id: 'gpt-4', name: 'GPT-4', status: 'active', color: COLORS.cyan },
    { id: 'claude', name: 'Claude', status: 'inactive', color: '#888' },
    { id: 'gemini', name: 'Gemini', status: 'inactive', color: '#888' },
    { id: 'mistral', name: 'Mistral', status: 'inactive', color: '#888' },
  ];

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, newMessage]);
    setInputMessage('');

    // TODO: Call API to get AI response
    // For now, simulate response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m processing your request...',
        timestamp: new Date().toISOString(),
        provider: selectedAI,
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: COLORS.javaribg }}>
      {/* Credits Bar - Always Visible */}
      <div 
        className="h-12 flex items-center justify-between px-6 border-b"
        style={{ 
          backgroundColor: COLORS.navy,
          borderColor: COLORS.cyan + '40'
        }}
      >
        <div className="flex items-center gap-4">
          <Sparkles className="w-5 h-5" style={{ color: COLORS.javariCyan }} />
          <span className="text-white font-medium">
            💎 Credits: {credits.current.toLocaleString()} / {credits.total.toLocaleString()}
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-white">Plan: {userPlan}</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          style={{ 
            borderColor: COLORS.cyan,
            color: COLORS.cyan 
          }}
        >
          Learn More
        </Button>
      </div>

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
                  {/* Project list would go here */}
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
                    style={{ borderColor: COLORS.cyan, color: 'white' }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: COLORS.red }}
                      >
                        {userName.charAt(0)}
                      </div>
                      <span>{userName}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" style={{ backgroundColor: COLORS.navy, borderColor: COLORS.cyan }}>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <Globe className="w-4 h-4 mr-2" />
                    Language: {language}
                  </DropdownMenuItem>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Get Help
                  </DropdownMenuItem>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    View Plans & Credits
                  </DropdownMenuItem>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Assets & Documents
                  </DropdownMenuItem>
                  <DropdownMenuItem style={{ color: 'white' }}>
                    <Shield className="w-4 h-4 mr-2" />
                    Security & Keys
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ backgroundColor: COLORS.cyan + '40' }} />
                  <DropdownMenuItem style={{ color: COLORS.red }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col">
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

          {/* Avatar Video Conference Area */}
          <div className="h-64 border-b p-6" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.navy }}>
            <div className="h-full flex flex-col items-center justify-center">
              {/* Javari Avatar */}
              <Image
                src="/avatars/javari-default.png"
                alt="Javari AI"
                width={128}
                height={128}
                className="rounded-full"
                style={{
                  border: `3px solid ${COLORS.javariCyan}`,
                  boxShadow: `0 0 20px ${COLORS.javariCyan}`,
                }}
              />
              
              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="flex items-center gap-2 text-white">
                  <Volume2 className="w-4 h-4" style={{ color: COLORS.javariCyan }} />
                  <span className="text-sm">Javari is speaking...</span>
                </div>
              )}

              {/* AI Provider Chairs */}
              <div className="flex gap-4 mt-6">
                {aiProviders.map(provider => (
                  <div key={provider.id} className="flex flex-col items-center">
                    <div 
                      className={`w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold cursor-pointer transition-all ${
                        provider.status === 'active' ? 'ring-2' : 'opacity-50'
                      }`}
                      style={{ 
                        backgroundColor: COLORS.javaribg,
                        borderColor: provider.color,
                        border: `2px solid ${provider.color}`,
                      }}
                      onClick={() => setSelectedAI(provider.id)}
                    >
                      {provider.name.charAt(0)}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{provider.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Messages Area */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map(message => (
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
                        <Volume2 className="w-4 h-4" style={{ color: COLORS.javariCyan }} />
                        <span className="text-xs opacity-75">Javari ({message.provider})</span>
                      </div>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <span className="text-xs opacity-50 mt-2 block">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t" style={{ borderColor: COLORS.cyan + '40', backgroundColor: COLORS.navy }}>
            <div className="flex gap-2">
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
          </div>
        </div>

        {/* RIGHT SIDEBAR - Artifacts */}
        {rightSidebarOpen && (
          <div 
            className="w-96 border-l flex flex-col"
            style={{ 
              backgroundColor: COLORS.navy,
              borderColor: COLORS.cyan + '40'
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '40' }}>
              <h3 className="text-white font-medium">Artifacts</h3>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {artifacts.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No artifacts yet</p>
                    <p className="text-xs mt-1">Generated files will appear here</p>
                  </div>
                ) : (
                  artifacts.map(artifact => (
                    <Card key={artifact.id} className="p-3" style={{ backgroundColor: COLORS.javaribg }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-white text-sm font-medium">{artifact.name}</div>
                          <div className="text-gray-400 text-xs">{artifact.size}</div>
                        </div>
                        <FileText className="w-5 h-5" style={{ color: COLORS.cyan }} />
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t space-y-2" style={{ borderColor: COLORS.cyan + '40' }}>
              <Button 
                variant="outline" 
                className="w-full"
                style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export All
              </Button>
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

        {/* Prompt Hints Bar */}
        <PromptHintsBar />
      </div>
    </div>
  );
}
