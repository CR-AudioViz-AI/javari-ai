'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Upload, Download, Settings, Trash2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  timestamp: Date;
  rating?: number;
  files?: Array<{ name: string; type: string; size: number }>;
}

interface Provider {
  id: string;
  name: string;
  models: string[];
  status: 'active' | 'inactive' | 'error';
}

export default function ChatPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4-turbo');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [providers, setProviders] = useState<Provider[]>([
    { id: 'openai', name: 'OpenAI', models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'], status: 'active' },
    { id: 'anthropic', name: 'Claude', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], status: 'active' },
    { id: 'google', name: 'Gemini', models: ['gemini-pro', 'gemini-pro-vision'], status: 'active' },
    { id: 'mistral', name: 'Mistral', models: ['mistral-large', 'mistral-medium', 'mistral-small'], status: 'active' },
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load provider status on mount
    fetchProviderStatus();
  }, []);

  const fetchProviderStatus = async () => {
    try {
      const response = await fetch('/api/javari/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || providers);
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
    toast({
      title: 'Files uploaded',
      description: `${files.length} file(s) added to your message`,
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      files: uploadedFiles.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Upload files first if any
      let fileUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        uploadedFiles.forEach((file) => {
          formData.append('files', file);
        });

        const uploadResponse = await fetch('/api/javari/files', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          fileUrls = uploadData.urls || [];
        }
      }

      // Send chat message with streaming
      const response = await fetch('/api/javari/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          files: fileUrls,
          provider: selectedProvider,
          model: selectedModel,
          temperature,
          maxTokens,
          conversationHistory: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        provider: selectedProvider,
        model: selectedModel,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  assistantMessage.content += data.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantMessage.content }
                        : m
                    )
                  );
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }

      setUploadedFiles([]);
      toast({
        title: 'Message sent',
        description: 'Response received successfully',
      });
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });

      // Remove failed assistant message if it was added
      setMessages((prev) => prev.filter((m) => m.role !== 'assistant' || m.content));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateMessage = async (messageId: string, rating: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
    );

    // Save rating to analytics
    try {
      await fetch('/api/javari/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          rating,
          provider: messages.find((m) => m.id === messageId)?.provider,
          model: messages.find((m) => m.id === messageId)?.model,
        }),
      });
    } catch (error) {
      console.error('Failed to save rating:', error);
    }

    toast({
      title: 'Rating saved',
      description: 'Thank you for your feedback!',
    });
  };

  const exportConversation = () => {
    const conversation = messages.map((m) => ({
      role: m.role,
      content: m.content,
      provider: m.provider,
      model: m.model,
      timestamp: m.timestamp.toISOString(),
      rating: m.rating,
    }));

    const blob = new Blob([JSON.stringify(conversation, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `javari-conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Conversation exported',
      description: 'Your conversation has been downloaded',
    });
  };

  const clearConversation = () => {
    setMessages([]);
    toast({
      title: 'Conversation cleared',
      description: 'All messages have been removed',
    });
  };

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const availableModels = currentProvider?.models || [];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Javari AI</h1>
            <p className="text-sm text-gray-500">Your autonomous AI assistant</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          provider.status === 'active'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />
                      {provider.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={exportConversation}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={clearConversation}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                  Welcome to Javari AI
                </h2>
                <p className="text-gray-500">
                  Start a conversation or upload files to get started
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Card
                key={message.id}
                className={`p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-50 ml-12'
                    : 'bg-white mr-12'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                      message.role === 'user' ? 'bg-blue-600' : 'bg-green-600'
                    }`}
                  >
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-500">
                        {message.timestamp.toLocaleTimeString()}
                        {message.provider && (
                          <span className="ml-2">
                            • {message.provider} ({message.model})
                          </span>
                        )}
                      </div>
                      {message.role === 'assistant' && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => handleRateMessage(message.id, rating)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  message.rating && message.rating >= rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.files && message.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.files.map((file, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-gray-500 flex items-center gap-2"
                          >
                            <Upload className="w-3 h-3" />
                            {file.name} ({Math.round(file.size / 1024)}KB)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t p-4">
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm"
                >
                  <Upload className="w-3 h-3" />
                  {file.name}
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 min-h-[60px] max-h-[200px]"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="w-80 bg-white border-l p-6 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Settings</h3>
          <div className="space-y-6">
            <div>
              <Label htmlFor="temperature">
                Temperature: {temperature.toFixed(2)}
              </Label>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                onValueChange={([value]) => setTemperature(value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher values make output more random
              </p>
            </div>
            <div>
              <Label htmlFor="maxTokens">Max Tokens: {maxTokens}</Label>
              <Slider
                id="maxTokens"
                min={100}
                max={4000}
                step={100}
                value={[maxTokens]}
                onValueChange={([value]) => setMaxTokens(value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum length of the response
              </p>
            </div>
            <div>
              <Label>Provider Status</Label>
              <div className="mt-2 space-y-2">
                {providers.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between">
                    <span className="text-sm">{provider.name}</span>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        provider.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
