'use client';

// =============================================================================
// JAVARI AI - COMPLETE CHAT INTERFACE
// =============================================================================
// ALL AI providers visible | VIP detection by email | Never say no philosophy
// Production Ready - Tuesday, December 16, 2025 - 11:45 PM EST
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Upload, Settings, Trash2, Star, Loader2, 
  Zap, Brain, Globe, Search, Code, Sparkles, 
  ChevronDown, Shield, Crown, AlertCircle, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  timestamp: Date;
  rating?: number;
  files?: Array<{ name: string; type: string; size: number }>;
  metadata?: {
    tokensUsed?: number;
    responseTimeMs?: number;
    enrichedData?: boolean;
    dataSource?: string;
    intent?: string;
    vipMode?: boolean;
  };
}

interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  speed: 'fast' | 'medium' | 'slow';
  bestFor: string[];
}

interface AIProvider {
  id: string;
  name: string;
  description: string;
  category: 'premium' | 'standard' | 'free' | 'specialized';
  costTier: 'high' | 'medium' | 'low' | 'free';
  models: AIModel[];
  icon: React.ReactNode;
  color: string;
  status: 'active' | 'inactive' | 'error';
}

interface VIPStatus {
  isVIP: boolean;
  name?: string;
  role?: string;
  accessLevel: 'unlimited' | 'premium' | 'standard' | 'free';
}

// =============================================================================
// AI PROVIDERS - ALL 6 WITH ICONS
// =============================================================================

const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'Most advanced reasoning & coding',
    category: 'premium',
    costTier: 'high',
    icon: <Brain className="w-4 h-4" />,
    color: 'bg-orange-500',
    status: 'active',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, speed: 'medium', bestFor: ['coding', 'analysis'] },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200000, speed: 'slow', bestFor: ['research', 'complex'] },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextWindow: 200000, speed: 'medium', bestFor: ['balanced'] },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    description: 'Industry standard AI',
    category: 'premium',
    costTier: 'high',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'bg-green-500',
    status: 'active',
    models: [
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', contextWindow: 128000, speed: 'medium', bestFor: ['general', 'creative'] },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, speed: 'fast', bestFor: ['vision', 'multimodal'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, speed: 'fast', bestFor: ['quick', 'cost-effective'] },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, speed: 'fast', bestFor: ['simple', 'high volume'] },
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Massive context & multimodal',
    category: 'premium',
    costTier: 'medium',
    icon: <Globe className="w-4 h-4" />,
    color: 'bg-blue-500',
    status: 'active',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, speed: 'medium', bestFor: ['long docs', 'video'] },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, speed: 'fast', bestFor: ['fast', 'high volume'] },
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Real-time web search + AI',
    category: 'specialized',
    costTier: 'medium',
    icon: <Search className="w-4 h-4" />,
    color: 'bg-purple-500',
    status: 'active',
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', contextWindow: 128000, speed: 'medium', bestFor: ['search', 'research'] },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online', contextWindow: 128000, speed: 'fast', bestFor: ['quick search'] },
    ]
  },
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    description: '10x faster inference - FREE!',
    category: 'free',
    costTier: 'free',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-yellow-500',
    status: 'active',
    models: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', contextWindow: 128000, speed: 'fast', bestFor: ['fast', 'coding'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, speed: 'fast', bestFor: ['ultra-fast'] },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, speed: 'fast', bestFor: ['multilingual'] },
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: '100,000+ open source models',
    category: 'free',
    costTier: 'free',
    icon: <Code className="w-4 h-4" />,
    color: 'bg-pink-500',
    status: 'active',
    models: [
      { id: 'meta-llama/Meta-Llama-3-70B-Instruct', name: 'Llama 3 70B', contextWindow: 8192, speed: 'medium', bestFor: ['general'] },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', contextWindow: 32768, speed: 'medium', bestFor: ['multilingual'] },
    ]
  }
];

// =============================================================================
// TERMS OF SERVICE
// =============================================================================

const TERMS_VERSION = '2.0.0';
const TERMS_TEXT = `
CR AUDIOVIZ AI - TERMS OF SERVICE & RESPONSIBILITY

By using Javari AI and CR AudioViz AI services, you acknowledge and agree:

1. USER RESPONSIBILITY
   • You are solely responsible for all requests you make
   • You are responsible for how you use generated content
   • You must ensure your use complies with applicable laws
   • You indemnify CR AudioViz AI from any claims arising from your use

2. AI-GENERATED CONTENT
   • All content is generated by artificial intelligence
   • Content may contain errors or inaccuracies
   • You must verify important information independently
   • CR AudioViz AI makes no warranties about generated content

3. INDEMNIFICATION
   You agree to indemnify, defend, and hold harmless CR AudioViz AI, LLC,
   its officers, directors, employees, and agents from any claims, damages,
   losses, or expenses arising from:
   a) Your use of the services
   b) Content you generate or request
   c) Your violation of these terms
   d) Your violation of any third-party rights

4. LIMITATION OF LIABILITY
   • CR AudioViz AI is not liable for any indirect, incidental, special,
     consequential, or punitive damages
   • Our liability is limited to amounts you paid in the last 12 months

5. ACCEPTABLE USE
   • You agree not to use services for illegal activities
   • You agree not to generate harmful or abusive content
   • You agree to respect intellectual property rights

Version: ${TERMS_VERSION}
Effective Date: December 16, 2025
`;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ChatPage() {
  const { toast } = useToast();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [autoSelectProvider, setAutoSelectProvider] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [vipStatus, setVIPStatus] = useState<VIPStatus>({
    isVIP: false,
    accessLevel: 'standard'
  });
  const [usePowerhouse, setUsePowerhouse] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    // Check VIP status and terms on mount
    checkVIPStatus();
    checkTermsAcceptance();
  }, []);

  // =============================================================================
  // VIP & TERMS FUNCTIONS
  // =============================================================================

  const checkVIPStatus = async () => {
    try {
      const response = await fetch('/api/auth/vip-status');
      if (response.ok) {
        const data = await response.json();
        setVIPStatus(data);
        
        if (data.isVIP) {
          toast({
            title: `Welcome back, ${data.name}!`,
            description: `VIP Mode: ${data.accessLevel.toUpperCase()} - Full delivery access enabled`,
          });
        }
      }
    } catch (error) {
      console.error('VIP check failed:', error);
    }
  };

  const checkTermsAcceptance = async () => {
    try {
      const response = await fetch('/api/auth/terms-status');
      if (response.ok) {
        const data = await response.json();
        setTermsAccepted(data.accepted);
        if (!data.accepted) {
          setShowTermsDialog(true);
        }
      }
    } catch (error) {
      // If API doesn't exist, check local storage
      const localAcceptance = localStorage.getItem('javari_terms_accepted');
      if (!localAcceptance) {
        setShowTermsDialog(true);
      } else {
        setTermsAccepted(true);
      }
    }
  };

  const acceptTerms = async () => {
    try {
      await fetch('/api/auth/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: TERMS_VERSION })
      });
    } catch (error) {
      // Fallback to local storage
      localStorage.setItem('javari_terms_accepted', TERMS_VERSION);
    }
    setTermsAccepted(true);
    setShowTermsDialog(false);
    toast({
      title: 'Terms Accepted',
      description: 'Thank you! You now have full access to Javari AI.',
    });
  };

  // =============================================================================
  // PROVIDER SELECTION
  // =============================================================================

  const getProviderIcon = (providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    return provider?.icon || <Brain className="w-4 h-4" />;
  };

  const getProviderColor = (providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    return provider?.color || 'bg-gray-500';
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.models.length > 0) {
      setSelectedModel(provider.models[0].id);
    }
  };

  // =============================================================================
  // FILE UPLOAD
  // =============================================================================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
    toast({
      title: 'Files uploaded',
      description: `${files.length} file(s) ready to send`,
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // =============================================================================
  // SEND MESSAGE
  // =============================================================================

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    if (!termsAccepted) {
      setShowTermsDialog(true);
      return;
    }

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
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      // Use Powerhouse endpoint for VIP or if enabled
      const endpoint = (vipStatus.isVIP || usePowerhouse) 
        ? '/api/chat/powerhouse' 
        : '/api/chat';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          provider: autoSelectProvider ? 'auto' : selectedProvider,
          model: autoSelectProvider ? 'auto' : selectedModel,
          temperature,
          maxTokens,
          // VIP flags
          vipMode: vipStatus.isVIP,
          deliveryMode: vipStatus.accessLevel === 'unlimited' ? 'full' : 'standard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || data.response || 'I apologize, but I couldn\'t generate a response.',
        provider: data.provider,
        model: data.model,
        timestamp: new Date(),
        metadata: {
          tokensUsed: data.tokensUsed,
          responseTimeMs: data.responseTimeMs,
          enrichedData: data.enrichedData,
          dataSource: data.dataSource,
          intent: data.intent?.detected,
          vipMode: data.vipMode,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Show provider info
      if (data.provider) {
        toast({
          title: `Response from ${data.provider}`,
          description: data.enrichedData 
            ? `Enhanced with real-time data from ${data.dataSource}` 
            : `Model: ${data.model}`,
        });
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================================================
  // RATING
  // =============================================================================

  const handleRateMessage = async (messageId: string, rating: number) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
    );

    try {
      await fetch('/api/javari/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch (error) {
      console.error('Failed to submit rating:', error);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="border-b px-4 py-3 flex items-center justify-between bg-card">
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
              <p className="text-xs text-muted-foreground">
                {vipStatus.isVIP 
                  ? `${vipStatus.name} - Full Delivery Mode` 
                  : 'Your AI Assistant - Ready to Deliver'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Powerhouse Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
                  <Zap className={`w-4 h-4 ${usePowerhouse ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <Switch
                    checked={usePowerhouse}
                    onCheckedChange={setUsePowerhouse}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Powerhouse Mode: Real-time data + Smart routing</p>
              </TooltipContent>
            </Tooltip>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* Clear Chat */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Settings Panel */}
        <Collapsible open={showSettings}>
          <CollapsibleContent>
            <div className="border-b p-4 bg-muted/50">
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Provider Selection */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block">AI Provider</Label>
                    <Select
                      value={selectedProvider}
                      onValueChange={handleProviderChange}
                      disabled={autoSelectProvider}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Premium Providers</SelectLabel>
                          {AI_PROVIDERS.filter(p => p.category === 'premium').map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${provider.color}`} />
                                {provider.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Specialized</SelectLabel>
                          {AI_PROVIDERS.filter(p => p.category === 'specialized').map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${provider.color}`} />
                                {provider.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Free Providers</SelectLabel>
                          {AI_PROVIDERS.filter(p => p.category === 'free').map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${provider.color}`} />
                                {provider.name}
                                <Badge variant="secondary" className="text-xs">FREE</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block">Model</Label>
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                      disabled={autoSelectProvider}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentProvider?.models.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              {model.name}
                              <Badge variant="outline" className="text-xs">
                                {model.speed}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="auto-select"
                        checked={autoSelectProvider}
                        onCheckedChange={setAutoSelectProvider}
                      />
                      <Label htmlFor="auto-select">Auto-select best AI</Label>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block">Temperature: {temperature}</Label>
                    <Slider
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v)}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block">Max Tokens: {maxTokens}</Label>
                    <Slider
                      value={[maxTokens]}
                      onValueChange={([v]) => setMaxTokens(v)}
                      min={256}
                      max={16384}
                      step={256}
                    />
                  </div>
                </div>

                {/* Provider Info Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {AI_PROVIDERS.map(provider => (
                    <Card 
                      key={provider.id}
                      className={`p-2 cursor-pointer transition-all ${
                        selectedProvider === provider.id 
                          ? 'ring-2 ring-primary' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => !autoSelectProvider && handleProviderChange(provider.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${provider.color} flex items-center justify-center text-white`}>
                          {provider.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{provider.name.split(' ')[0]}</p>
                          <p className="text-[10px] text-muted-foreground">{provider.costTier}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Javari AI</h2>
                <p className="text-muted-foreground mb-4">
                  {vipStatus.isVIP 
                    ? `Hello ${vipStatus.name}! I'm ready to DELIVER whatever you need.`
                    : 'Your AI assistant ready to help with anything.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary">6 AI Providers</Badge>
                  <Badge variant="secondary">Real-time Data</Badge>
                  <Badge variant="secondary">Smart Routing</Badge>
                  <Badge variant="secondary">Build & Deliver</Badge>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-[80%] p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card'
                  }`}
                >
                  {message.role === 'assistant' && message.provider && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                      <div className={`w-5 h-5 rounded-full ${getProviderColor(
                        message.provider.toLowerCase().includes('claude') ? 'anthropic' :
                        message.provider.toLowerCase().includes('gpt') ? 'openai' :
                        message.provider.toLowerCase().includes('gemini') ? 'google' :
                        message.provider.toLowerCase().includes('perplexity') ? 'perplexity' :
                        message.provider.toLowerCase().includes('groq') ? 'groq' : 'huggingface'
                      )} flex items-center justify-center text-white`}>
                        {getProviderIcon(
                          message.provider.toLowerCase().includes('claude') ? 'anthropic' :
                          message.provider.toLowerCase().includes('gpt') ? 'openai' :
                          message.provider.toLowerCase().includes('gemini') ? 'google' :
                          message.provider.toLowerCase().includes('perplexity') ? 'perplexity' :
                          message.provider.toLowerCase().includes('groq') ? 'groq' : 'huggingface'
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{message.provider}</span>
                      {message.metadata?.enrichedData && (
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          Live Data
                        </Badge>
                      )}
                      {message.metadata?.vipMode && (
                        <Badge variant="default" className="text-xs bg-yellow-500">
                          <Crown className="w-3 h-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.files.map((file, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Rate:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRateMessage(message.id, star)}
                          className="hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              message.rating && star <= message.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </button>
                      ))}
                      {message.metadata?.responseTimeMs && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {(message.metadata.responseTimeMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-card">
          <div className="max-w-4xl mx-auto">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {uploadedFiles.map((file, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {file.name}
                    <button onClick={() => removeFile(index)}>×</button>
                  </Badge>
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
              >
                <Upload className="w-4 h-4" />
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
                placeholder={vipStatus.isVIP 
                  ? "What would you like me to BUILD or DELIVER for you today?"
                  : "Ask me anything..."}
                className="flex-1 min-h-[50px] max-h-[200px]"
                disabled={isLoading}
              />
              
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Powered by 6 AI providers • {autoSelectProvider ? 'Auto-selecting best AI' : `Using ${currentProvider?.name}`}
              {vipStatus.isVIP && ' • VIP Delivery Mode Active'}
            </p>
          </div>
        </div>

        {/* Terms Dialog */}
        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Terms of Service & User Responsibility
              </DialogTitle>
              <DialogDescription>
                Please read and accept our terms before using Javari AI
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-muted p-4 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
              {TERMS_TEXT}
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                By clicking Accept, you agree to all terms above
              </div>
              <Button onClick={acceptTerms} className="bg-gradient-to-r from-orange-500 to-pink-500">
                <Check className="w-4 h-4 mr-2" />
                I Accept - Full Responsibility
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
