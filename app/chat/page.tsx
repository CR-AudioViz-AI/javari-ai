// app/chat/page.tsx
// Knowledge-grounded chat interface using Javari AI
// Completely rewritten to use the new RAG pipeline

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Crown, 
  Download, 
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    source: string;
    similarity: number;
  }>;
  timestamp?: string;
}

interface VIPStatus {
  isVIP: boolean;
  plan?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vipStatus, setVIPStatus] = useState<VIPStatus>({
    isVIP: false,
  });
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [knowledgeSystemStatus, setKnowledgeSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check VIP status on mount
  useEffect(() => {
    checkVIPStatus();
    checkTermsStatus();
    checkKnowledgeSystem();
  }, []);

  const checkVIPStatus = async () => {
    try {
      const response = await fetch('/api/auth/vip-status');
      if (response.ok) {
        const data = await response.json();
        setVIPStatus(data);
      }
    } catch (error) {
      console.error('Failed to check VIP status:', error);
    }
  };

  const checkTermsStatus = async () => {
    try {
      const response = await fetch('/api/auth/terms-status');
      if (response.ok) {
        const data = await response.json();
        setHasAcceptedTerms(data.hasAccepted);
      }
    } catch (error) {
      console.error('Failed to check terms status:', error);
    }
  };

  const checkKnowledgeSystem = async () => {
    try {
      const response = await fetch('/api/knowledge/health');
      if (response.ok) {
        setKnowledgeSystemStatus('online');
        toast({
          title: 'Knowledge System Online',
          description: 'Javari is ready with 271 knowledge chunks',
          duration: 3000,
        });
      } else {
        setKnowledgeSystemStatus('offline');
      }
    } catch (error) {
      console.error('Knowledge system check failed:', error);
      setKnowledgeSystemStatus('offline');
    }
  };

  const handleAcceptTerms = async () => {
    try {
      const response = await fetch('/api/auth/accept-terms', {
        method: 'POST',
      });
      if (response.ok) {
        setHasAcceptedTerms(true);
        toast({
          title: 'Terms Accepted',
          description: 'You can now use Javari AI',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept terms',
        variant: 'destructive',
      });
    }
  };

  const handleNewMessage = (userMessage: string, assistantMessage: string, sources?: Array<{ source: string; similarity: number }>) => {
    // ChatInput already handled the API call via agents/javari.ts
    // We just need to update the UI state
    const timestamp = new Date().toISOString();
    
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp,
      },
      {
        role: 'assistant',
        content: assistantMessage,
        sources,
        timestamp,
      },
    ]);
  };

  const handleClearChat = () => {
    if (confirm('Clear all messages?')) {
      setMessages([]);
      toast({
        title: 'Chat Cleared',
        description: 'All messages have been removed',
      });
    }
  };

  const handleExportChat = () => {
    const chatText = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `javari-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Chat Exported',
      description: 'Downloaded as text file',
    });
  };

  // Terms acceptance gate
  if (!hasAcceptedTerms) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Welcome to Javari AI</h1>
              <p className="text-muted-foreground">Knowledge-grounded conversations</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="font-semibold">Terms of Service</h2>
            <div className="text-sm text-muted-foreground space-y-2 max-h-64 overflow-y-auto p-4 bg-muted rounded-lg">
              <p>• Javari AI provides knowledge-grounded responses based on ingested documentation</p>
              <p>• Responses include source attribution when available</p>
              <p>• You must verify important information independently</p>
              <p>• Do not share sensitive or confidential information</p>
              <p>• Usage is subject to rate limits and fair use policies</p>
              <p>• We collect conversation data for improving the service</p>
              <p>• You retain ownership of your conversations</p>
            </div>
          </div>

          <Button onClick={handleAcceptTerms} className="w-full" size="lg">
            Accept Terms and Continue
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              Javari AI
              {vipStatus.isVIP && (
                <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-orange-500">
                  <Crown className="w-3 h-3 mr-1" />
                  VIP
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Knowledge-grounded conversations</span>
              {knowledgeSystemStatus === 'online' && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Knowledge Online
                </Badge>
              )}
              {knowledgeSystemStatus === 'offline' && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Fallback Mode
                </Badge>
              )}
              {knowledgeSystemStatus === 'checking' && (
                <Badge variant="outline">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportChat}
            disabled={messages.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </header>

      {/* Chat Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-bold">Welcome to Javari AI</h2>
              <p className="text-muted-foreground">
                Ask me anything about the MRS naming system, canonical categories, surfaces, modules, or traits.
              </p>
              <p className="text-sm text-muted-foreground">
                All responses are grounded in knowledge with source attribution.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
              <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
                <h3 className="font-semibold mb-1">📚 Documentation</h3>
                <p className="text-sm text-muted-foreground">
                  "What is a Surface in the MRS naming system?"
                </p>
              </Card>
              <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
                <h3 className="font-semibold mb-1">🎯 Categories</h3>
                <p className="text-sm text-muted-foreground">
                  "Show me all canonical categories"
                </p>
              </Card>
              <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
                <h3 className="font-semibold mb-1">🏗️ Modules</h3>
                <p className="text-sm text-muted-foreground">
                  "What modules are available?"
                </p>
              </Card>
              <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
                <h3 className="font-semibold mb-1">✨ Naming</h3>
                <p className="text-sm text-muted-foreground">
                  "How do I create a proper module name?"
                </p>
              </Card>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
                sources={message.sources}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="border-t bg-card px-4 py-4">
        <ChatInput
          onMessage={handleNewMessage}
          disabled={isLoading}
        />
        
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by knowledge-grounded RAG • 271 chunks • Source attribution enabled
        </p>
      </div>
    </div>
  );
}
