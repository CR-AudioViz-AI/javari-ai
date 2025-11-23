'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Send, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

interface DeploymentStatus {
  workflowId: string;
  status: 'running' | 'success' | 'failed';
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed';
  }>;
  artifacts?: {
    repoUrl?: string;
    deploymentUrl?: string;
  };
}

export default function JavariChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user and conversations on mount
  useEffect(() => {
    loadUser();
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (data && !error) {
      setConversations(data);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data && !error) {
      setMessages(data);
    }
  };

  const createNewConversation = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation',
        starred: false,
      })
      .select()
      .single();

    if (data && !error) {
      setCurrentConversation(data);
      setMessages([]);
      await loadConversations(); // Refresh sidebar
    }
  };

  const saveMessage = async (conversationId: string, role: 'user' | 'assistant', content: string, provider?: string) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        provider,
      })
      .select()
      .single();

    if (data && !error) {
      setMessages(prev => [...prev, data]);
      
      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      // Update title if first message
      if (messages.length === 0 && role === 'user') {
        const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        await supabase
          .from('conversations')
          .update({ title })
          .eq('id', conversationId);
        await loadConversations();
      }
    }

    return data;
  };

  const detectBuildRequest = (message: string): { isBuild: boolean; appName?: string; description?: string } => {
    const buildPatterns = [
      /build\s+(?:me\s+)?(?:a\s+)?(.+)/i,
      /create\s+(?:a\s+)?(.+)\s+app/i,
      /make\s+(?:me\s+)?(?:a\s+)?(.+)/i,
    ];

    for (const pattern of buildPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          isBuild: true,
          appName: match[1].trim().toLowerCase().replace(/\s+/g, '-'),
          description: message,
        };
      }
    }

    return { isBuild: false };
  };

  const triggerAutonomousDeployment = async (appName: string, description: string) => {
    setDeploymentStatus({
      workflowId: '',
      status: 'running',
      steps: [
        { name: 'Generating code', status: 'running' },
        { name: 'Creating repository', status: 'pending' },
        { name: 'Deploying to Vercel', status: 'pending' },
      ],
    });

    // Call autonomous deployment API
    const response = await fetch('/api/autonomous/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appName,
        files: await generateAppFiles(description),
      }),
    });

    const { workflowId } = await response.json();
    
    if (workflowId) {
      setDeploymentStatus(prev => prev ? { ...prev, workflowId } : null);
      pollDeploymentStatus(workflowId);
    }
  };

  const generateAppFiles = async (description: string) => {
    // Call AI to generate files based on description
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a code generator. Generate complete Next.js application files as JSON array with {path, content} objects. Only return valid JSON, nothing else.',
          },
          {
            role: 'user',
            content: `Generate a complete Next.js application for: ${description}. Return only JSON array of files.`,
          },
        ],
        provider: 'claude-sonnet',
      }),
    });

    const data = await response.json();
    return JSON.parse(data.message);
  };

  const pollDeploymentStatus = async (workflowId: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/autonomous/status/${workflowId}`);
      const { workflow } = await response.json();

      setDeploymentStatus({
        workflowId,
        status: workflow.status,
        steps: workflow.steps,
        artifacts: workflow.artifacts,
      });

      if (workflow.status === 'success' || workflow.status === 'failed') {
        clearInterval(interval);
        
        // Send completion message
        if (currentConversation) {
          const message = workflow.status === 'success'
            ? `✅ Deployment successful!\n\n🔗 Repository: ${workflow.artifacts.repoUrl}\n🚀 Live URL: ${workflow.artifacts.deploymentUrl}`
            : `❌ Deployment failed: ${workflow.error?.message}`;
          
          await saveMessage(currentConversation.id, 'assistant', message, 'javari');
        }
      }
    }, 3000);
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;

    // Create conversation if doesn't exist
    let conversation = currentConversation;
    if (!conversation) {
      const { data } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: input.substring(0, 50),
          starred: false,
        })
        .select()
        .single();
      
      if (data) {
        conversation = data;
        setCurrentConversation(data);
        await loadConversations();
      } else {
        return;
      }
    }

    // Save user message
    const userMessage = input;
    setInput('');
    await saveMessage(conversation.id, 'user', userMessage);

    // Check if it's a build request
    const buildRequest = detectBuildRequest(userMessage);
    
    if (buildRequest.isBuild && buildRequest.appName) {
      // Trigger autonomous deployment
      await saveMessage(conversation.id, 'assistant', `🚀 Building ${buildRequest.appName}... I'll create the repository, generate the code, and deploy to Vercel automatically.`, 'javari');
      await triggerAutonomousDeployment(buildRequest.appName, buildRequest.description!);
      return;
    }

    // Regular chat message
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: 'user', content: userMessage },
          ]),
          provider: 'auto',
        }),
      });

      const data = await response.json();
      await saveMessage(conversation.id, 'assistant', data.message, data.provider);
    } catch (error) {
      await saveMessage(conversation.id, 'assistant', 'Sorry, I encountered an error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left Sidebar - Conversations */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={20} />
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                currentConversation?.id === conv.id
                  ? 'bg-gray-700 border border-blue-500'
                  : 'bg-gray-750 hover:bg-gray-700'
              }`}
            >
              <div className="font-medium truncate">{conv.title}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-6 py-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.provider && (
                  <div className="text-xs text-gray-400 mt-2">via {message.provider}</div>
                )}
              </div>
            </div>
          ))}

          {/* Deployment Status */}
          {deploymentStatus && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Deployment Progress</h3>
              <div className="space-y-3">
                {deploymentStatus.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {step.status === 'running' && <Loader2 className="animate-spin" size={20} />}
                    {step.status === 'success' && <CheckCircle2 className="text-green-500" size={20} />}
                    {step.status === 'failed' && <AlertCircle className="text-red-500" size={20} />}
                    {step.status === 'pending' && <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />}
                    <span className={step.status === 'pending' ? 'text-gray-500' : ''}>{step.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-6 py-4">
                <Loader2 className="animate-spin" size={20} />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Message Javari..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
