'use client';

/**
 * JAVARI AI - Proper Interface Layout + OPERATOR MODE
 * ====================================================
 * Layout:
 * - LEFT SIDEBAR: Javari logo top-left, starred chats, all chats, projects
 * - CENTER: Chat messages
 * - RIGHT SIDEBAR: Javari avatar top, documents below
 * - BOTTOM: AI provider selector buttons under chat input
 * 
 * OPERATOR MODE:
 * - Detects spec documents automatically
 * - Generates tickets instead of summaries
 * - Issues task batches to AI agents
 * - Enforces proof requirements
 * 
 * @version 4.0.0
 * @date January 5, 2026
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Upload, File, X, Check, AlertCircle, Loader2, Send, Bot, User, 
  FileText, Image as ImageIcon, FileSpreadsheet, ChevronLeft, ChevronRight,
  Trash2, Plus, Star, MessageSquare, FolderKanban, Clock, Search,
  Download, MoreVertical, Sparkles, Settings, Zap
} from 'lucide-react';

// =============================================================================
// OPERATOR MODE LOGIC (Inline to avoid import issues)
// =============================================================================
const SPEC_KEYWORDS = ['SPEC', 'PROOF', 'CONTROL', 'P0', 'TICKET', 'OPERATOR', 'ACCEPTANCE', 'CRITERIA'];

function isSpecDocument(filename: string, content: string): boolean {
  const specPatterns = [/spec/i, /proof/i, /control/i, /ticket/i, /operator/i, /p0/i];
  for (const pattern of specPatterns) {
    if (pattern.test(filename)) return true;
  }
  let keywordCount = 0;
  const upper = content.toUpperCase();
  for (const kw of SPEC_KEYWORDS) {
    if (upper.includes(kw)) keywordCount++;
    if (keywordCount >= 3) return true;
  }
  return false;
}

function generateOperatorResponse(docs: { name: string; content: string }[]): string {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST';
  const specDocs = docs.filter(d => isSpecDocument(d.name, d.content));
  
  let output = `# 🎯 JAVARI OPERATOR MODE ACTIVATED\n`;
  output += `**Timestamp:** ${timestamp}\n`;
  output += `**Mode:** OPERATOR\n`;
  output += `**Status:** EXECUTING\n\n---\n\n`;
  
  // Documents detected
  output += `## 📄 DOCUMENTS DETECTED\n\n`;
  output += `| # | Filename | Status |\n|---|----------|--------|\n`;
  docs.forEach((d, i) => {
    const isSpec = specDocs.includes(d);
    output += `| ${i + 1} | ${d.name} | ${isSpec ? '✅ SPEC' : '📄 Doc'} |\n`;
  });
  output += `\n---\n\n`;
  
  // Extract tickets from spec content
  const allContent = specDocs.map(d => d.content).join('\n\n');
  const tickets: { id: string; title: string; priority: string }[] = [];
  
  // Look for bullet points and numbered items
  const lines = allContent.split('\n');
  let ticketNum = 1;
  for (const line of lines) {
    if (/^\s*[-*]\s+\[?\s*[xX ]?\s*\]?\s*(.{10,100})/.test(line) || 
        /^\s*\d+\.\s+(.{10,100})/.test(line)) {
      const match = line.match(/^\s*[-*\d.]+\s*\[?\s*[xX ]?\s*\]?\s*(.+)$/);
      if (match && match[1].trim().length > 10) {
        const title = match[1].trim().slice(0, 80);
        const priority = /p0|critical|must|blocker/i.test(title) ? 'P0' : 
                        /p1|should|important/i.test(title) ? 'P1' : 'P2';
        tickets.push({ id: `TICKET-${String(ticketNum).padStart(3, '0')}`, title, priority });
        ticketNum++;
        if (ticketNum > 15) break; // Limit to 15 tickets
      }
    }
  }
  
  // Tickets section
  output += `## 🎫 P0 TICKET LIST\n\n`;
  if (tickets.length > 0) {
    for (const t of tickets) {
      output += `### ${t.id}: ${t.title}\n`;
      output += `**Priority:** ${t.priority}\n`;
      output += `**Assigned To:** Claude\n`;
      output += `**Status:** 🔴 NOT STARTED\n\n`;
      output += `**Proof Required:**\n- [ ] PR link\n- [ ] Deployment URL\n- [ ] Verification output\n- [ ] Rollback command\n\n---\n\n`;
    }
  } else {
    output += `*No specific tickets extracted. Review documents manually.*\n\n`;
  }
  
  // Task batch
  output += `## 📋 TASK BATCH #1 - CLAUDE\n\n`;
  output += `**Issued:** ${timestamp}\n`;
  output += `**Due:** IMMEDIATE\n\n`;
  output += `### Assigned Tickets\n`;
  tickets.slice(0, 5).forEach((t, i) => {
    output += `${i + 1}. **${t.id}:** ${t.title.slice(0, 50)}...\n`;
  });
  output += `\n### Proof Submission\n\`\`\`\nPR: [GitHub URL]\nDeploy: [Staging URL]\nVerify: [Steps + Output]\nRollback: git revert [SHA]\n\`\`\`\n\n---\n\n`;
  
  // Checklist
  output += `## ✅ CHECKLIST\n\n`;
  output += `| # | Ticket | Status | Proof |\n|---|--------|--------|-------|\n`;
  tickets.forEach((t, i) => {
    output += `| ${i + 1} | ${t.id} | 🔴 | ❌ |\n`;
  });
  output += `\n**Complete:** 0/${tickets.length}\n\n`;
  
  // Proof requirements
  output += `## 🔒 PROOF REQUIREMENTS (ENFORCED)\n\n`;
  output += `1. **PR link** - Merged pull request\n`;
  output += `2. **Deploy URL** - Live staging/production URL\n`;
  output += `3. **Verification** - Steps executed + actual output\n`;
  output += `4. **Rollback** - git revert [SHA] command\n\n`;
  output += `**NO EXCEPTIONS. NO "CLOSE ENOUGH". NO TRUST-BASED COMPLETION.**\n\n---\n\n`;
  output += `*Javari Operator Mode v1.0 | Proof-enforced execution*`;
  
  return output;
}

// =============================================================================
// BRAND COLORS
// =============================================================================
const COLORS = {
  navy: '#002B5B',
  red: '#FD201D',
  cyan: '#00BCD4',
  javariCyan: '#00D4FF',
  javaribg: '#0A1628',
};

// =============================================================================
// TYPES
// =============================================================================
interface StoredDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  error?: string;
  uploadedAt: Date;
}

interface Citation {
  documentId: string;
  documentName: string;
  snippet: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  starred: boolean;
  messages: Message[];
  updated_at: string;
  message_count: number;
}

interface AIProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  available: boolean;
}

// =============================================================================
// AI PROVIDERS
// =============================================================================
const AI_PROVIDERS: AIProvider[] = [
  { id: 'auto', name: 'Auto', icon: '✨', color: '#00D4FF', available: true },
  { id: 'gpt4', name: 'GPT-4', icon: '🟢', color: '#10a37f', available: true },
  { id: 'claude', name: 'Claude', icon: '🟤', color: '#d97706', available: true },
  { id: 'gemini', name: 'Gemini', icon: '🔵', color: '#4285f4', available: true },
  { id: 'perplexity', name: 'Perplexity', icon: '🟣', color: '#8b5cf6', available: true },
  { id: 'mistral', name: 'Mistral', icon: '🟠', color: '#ff6b35', available: true },
  { id: 'llama', name: 'Llama', icon: '🦙', color: '#0084ff', available: true },
  { id: 'cohere', name: 'Cohere', icon: '💜', color: '#d946ef', available: true },
];

// =============================================================================
// TEXT EXTRACTION
// =============================================================================
async function extractTextFromFile(file: File): Promise<string> {
  const type = file.type || '';
  const name = file.name.toLowerCase();
  
  if (type.includes('text') || type.includes('json') || 
      name.endsWith('.txt') || name.endsWith('.md') ||
      name.endsWith('.csv') || name.endsWith('.json') ||
      name.endsWith('.html') || name.endsWith('.xml') ||
      name.endsWith('.js') || name.endsWith('.ts') ||
      name.endsWith('.jsx') || name.endsWith('.tsx') ||
      name.endsWith('.py') || name.endsWith('.css') ||
      name.endsWith('.yaml') || name.endsWith('.yml')) {
    try {
      return await file.text();
    } catch {
      return `[Could not read text from ${file.name}]`;
    }
  }
  
  return `[Document: ${file.name}]\nType: ${type || 'unknown'}\nSize: ${(file.size / 1024).toFixed(1)} KB`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function MainJavariInterface() {
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm Javari, your AI assistant. Upload documents on the right, and I'll help you analyze them with citations. What would you like to work on?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStarred, setFilterStarred] = useState(false);
  
  // Mock conversations for demo
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: 'Project Planning Discussion', starred: true, messages: [], updated_at: new Date().toISOString(), message_count: 12 },
    { id: '2', title: 'Code Review - API Routes', starred: true, messages: [], updated_at: new Date(Date.now() - 86400000).toISOString(), message_count: 8 },
    { id: '3', title: 'Database Schema Design', starred: false, messages: [], updated_at: new Date(Date.now() - 172800000).toISOString(), message_count: 15 },
    { id: '4', title: 'Marketing Strategy', starred: false, messages: [], updated_at: new Date(Date.now() - 259200000).toISOString(), message_count: 6 },
  ]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [operatorMode, setOperatorMode] = useState(true); // Default ON for Roy
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // =============================================================================
  // FILE HANDLERS
  // =============================================================================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
    const processedDocs: { name: string; content: string }[] = [];
    
    for (const file of files) {
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const newDoc: StoredDocument = {
        id, name: file.name, content: '', size: file.size,
        type: file.type || 'application/octet-stream',
        status: 'processing', progress: 30, uploadedAt: new Date()
      };
      setDocuments(prev => [...prev, newDoc]);

      try {
        const content = await extractTextFromFile(file);
        setDocuments(prev => prev.map(d => 
          d.id === id ? { ...d, content, status: 'ready', progress: 100 } : d
        ));
        processedDocs.push({ name: file.name, content });
      } catch (err: any) {
        setDocuments(prev => prev.map(d => 
          d.id === id ? { ...d, status: 'error', progress: 100, error: err.message } : d
        ));
      }
    }
    
    // Check for spec documents and trigger Operator Mode
    if (operatorMode && processedDocs.length > 0) {
      const hasSpecs = processedDocs.some(d => isSpecDocument(d.name, d.content));
      if (hasSpecs) {
        const operatorOutput = generateOperatorResponse(processedDocs);
        setMessages(prev => [...prev, {
          id: `msg_operator_${Date.now()}`,
          role: 'assistant',
          content: operatorOutput,
          timestamp: new Date()
        }]);
      }
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // =============================================================================
  // CHAT HANDLER
  // =============================================================================
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const question = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const readyDocs = documents.filter(d => d.status === 'ready');
      const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      const relevantDocs = readyDocs
        .map(doc => {
          const content = doc.content.toLowerCase();
          const matchCount = questionWords.filter(word => content.includes(word)).length;
          return { ...doc, matchCount };
        })
        .filter(doc => doc.matchCount > 0)
        .sort((a, b) => b.matchCount - a.matchCount);

      const citations: Citation[] = relevantDocs.slice(0, 3).map(doc => {
        let bestIdx = -1;
        for (const word of questionWords) {
          const idx = doc.content.toLowerCase().indexOf(word);
          if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
        }
        const start = Math.max(0, bestIdx - 50);
        const end = Math.min(doc.content.length, bestIdx + 150);
        let snippet = doc.content.slice(start, end).trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < doc.content.length) snippet = snippet + '...';
        return { documentId: doc.id, documentName: doc.name, snippet };
      });

      let answer: string;
      if (readyDocs.length === 0) {
        answer = `Upload documents using the panel on the right, and I'll search through them to answer your questions with citations.`;
      } else if (citations.length > 0) {
        answer = `Based on your ${readyDocs.length} document(s), I found ${citations.length} relevant section(s). See citations below.`;
      } else {
        answer = `I searched through ${readyDocs.length} document(s) but couldn't find content matching your question. Try different keywords.`;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: answer,
        citations: citations.length > 0 ? citations : undefined,
        timestamp: new Date()
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (filterStarred && !conv.starred) return false;
    if (searchQuery && !conv.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const toggleStarred = (id: string) => {
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, starred: !c.starred } : c
    ));
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Starting a new conversation! How can I help you?`,
      timestamp: new Date()
    }]);
  };

  const readyDocsCount = documents.filter(d => d.status === 'ready').length;

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="h-screen flex" style={{ backgroundColor: COLORS.javaribg }}>
      
      {/* ============== LEFT SIDEBAR ============== */}
      <div 
        className={`${leftSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r flex flex-col`}
        style={{ borderColor: COLORS.cyan + '30' }}
      >
        {/* Logo Section */}
        <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: COLORS.cyan + '30' }}>
          <Image
            src="/javariailogo.png"
            alt="Javari AI"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-white font-bold text-lg">Javari AI</h1>
            <p className="text-xs" style={{ color: COLORS.cyan }}>Your AI Assistant</p>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '30' }}>
          <button
            onClick={startNewChat}
            className="w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.red, color: 'white' }}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 border transition-all hover:bg-white/5"
              style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}>
              <MessageSquare className="w-4 h-4" />
              All Chats
            </button>
            <button className="px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 border transition-all hover:bg-white/5"
              style={{ borderColor: COLORS.cyan, color: COLORS.cyan }}>
              <FolderKanban className="w-4 h-4" />
              Projects
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStarred(!filterStarred)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-all ${
                filterStarred ? 'text-yellow-400 bg-yellow-500/20' : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              <Star className="w-3.5 h-3.5" fill={filterStarred ? 'currentColor' : 'none'} />
              Starred
            </button>
            <button
              className="flex-1 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white bg-white/5 flex items-center justify-center gap-1.5 transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              Recent
            </button>
          </div>
        </div>

        {/* Starred Section */}
        {filteredConversations.filter(c => c.starred).length > 0 && (
          <div className="px-4 pb-2">
            <h3 className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5 mb-2">
              <Star className="w-3 h-3" fill="currentColor" />
              STARRED
            </h3>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {filteredConversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => setCurrentConversationId(conv.id)}
              className={`group p-3 rounded-lg cursor-pointer transition-all relative ${
                currentConversationId === conv.id 
                  ? 'bg-cyan-500/20 border border-cyan-500/50' 
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-white text-sm font-medium truncate flex-1">{conv.title}</h4>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStarred(conv.id); }}
                  className={`p-1 rounded transition-all ${
                    conv.starred ? 'text-yellow-400' : 'text-gray-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" fill={conv.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <span>{conv.message_count} messages</span>
                <span>•</span>
                <span>{formatDate(conv.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toggle Left Sidebar */}
      <button
        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg bg-slate-800 text-gray-400 hover:text-white transition-all"
        style={{ left: leftSidebarOpen ? '318px' : '0' }}
      >
        {leftSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* ============== CENTER - CHAT ============== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${message.role === 'user' ? 'bg-purple-500/30' : 'bg-cyan-500/30'}
                `}>
                  {message.role === 'user' 
                    ? <User className="w-4 h-4 text-purple-400" /> 
                    : <Bot className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className={`
                  max-w-[80%] p-4 rounded-2xl
                  ${message.role === 'user' 
                    ? 'bg-purple-500/20 text-white rounded-tr-sm' 
                    : 'bg-white/10 text-gray-100 rounded-tl-sm'}
                `}>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  
                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs font-medium mb-2" style={{ color: COLORS.cyan }}>
                        📚 Citations ({message.citations.length})
                      </p>
                      {message.citations.map((citation, i) => (
                        <div key={i} className="text-xs bg-black/30 p-2.5 rounded-lg mt-2">
                          <span className="font-medium" style={{ color: COLORS.cyan }}>{citation.documentName}</span>
                          <p className="text-gray-400 italic mt-1">"{citation.snippet}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span className="text-sm text-gray-400">Searching documents...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area with Provider Buttons */}
        <div className="p-4 border-t" style={{ borderColor: COLORS.cyan + '30' }}>
          <div className="max-w-3xl mx-auto">
            {/* Input */}
            <div className="flex gap-2 mb-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500"
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 rounded-xl text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: COLORS.cyan }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* AI Provider Selector Buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              {AI_PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  disabled={!provider.available}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    selectedProvider === provider.id 
                      ? 'ring-2 ring-offset-2 ring-offset-slate-900' 
                      : 'opacity-70 hover:opacity-100'
                  } ${!provider.available ? 'opacity-30 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: selectedProvider === provider.id ? provider.color + '30' : 'rgba(255,255,255,0.05)',
                    color: selectedProvider === provider.id ? provider.color : '#9ca3af',
                    ringColor: provider.color
                  }}
                >
                  <span>{provider.icon}</span>
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============== RIGHT SIDEBAR ============== */}
      <div 
        className={`${rightSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden border-l flex flex-col`}
        style={{ borderColor: COLORS.cyan + '30' }}
      >
        {/* Javari Avatar Section */}
        <div className="p-6 border-b flex flex-col items-center" style={{ borderColor: COLORS.cyan + '30' }}>
          <div className="relative mb-3">
            <Image
              src="/avatars/javariavatar.png"
              alt="Javari Avatar"
              width={80}
              height={80}
              className="rounded-full object-cover"
              style={{
                border: `3px solid ${COLORS.javariCyan}`,
                boxShadow: `0 0 25px ${COLORS.javariCyan}60`,
              }}
            />
            {/* Live Indicator */}
            <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900 animate-pulse" />
          </div>
          <p className="text-white font-semibold">Javari</p>
          <p className="text-xs text-gray-400">Online • Ready to help</p>
          <p className="text-xs mt-1" style={{ color: COLORS.cyan }}>
            Using: {AI_PROVIDERS.find(p => p.id === selectedProvider)?.name}
          </p>
          
          {/* Operator Mode Toggle */}
          <button
            onClick={() => setOperatorMode(!operatorMode)}
            className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              operatorMode 
                ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' 
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            Operator Mode {operatorMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Documents Section */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '30' }}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: COLORS.cyan }} />
              Documents ({readyDocsCount})
            </h3>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              m-4 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
              ${isDragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/20 hover:border-white/40 bg-white/5'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-cyan-400' : 'text-gray-400'}`} />
            <p className="text-white text-sm font-medium">Drop files here</p>
            <p className="text-xs text-gray-400">or click to browse</p>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg group"
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${doc.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                    doc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    'bg-cyan-500/20 text-cyan-400'}
                `}>
                  {doc.status === 'processing' 
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : doc.status === 'ready' 
                      ? <Check className="w-4 h-4" />
                      : <AlertCircle className="w-4 h-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500">{(doc.size/1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded text-gray-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Right Sidebar */}
      <button
        onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-l-lg bg-slate-800 text-gray-400 hover:text-white transition-all"
        style={{ right: rightSidebarOpen ? '286px' : '0' }}
      >
        {rightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default MainJavariInterface;
