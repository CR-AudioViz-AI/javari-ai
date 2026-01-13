'use client';

/**
 * JAVARI AI - Proper Interface Layout + OPERATOR MODE + PASTE-TO-DOCS
 * ====================================================================
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
 * PASTE-TO-DOCS (P0 UX FIX):
 * - Detects pasted virtual documents in chat input
 * - Pattern: FILE X — filename.md followed by content
 * - Treats pasted docs exactly like uploaded files
 * - Auto-clears after successful processing
 * 
 * @version 4.1.0
 * @date January 6, 2026
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Upload, File, X, Check, AlertCircle, Loader2, Send, Bot, User, 
  FileText, Image as ImageIcon, FileSpreadsheet, ChevronLeft, ChevronRight,
  Trash2, Plus, Star, MessageSquare, FolderKanban, Clock, Search,
  Download, MoreVertical, Sparkles, Settings, Zap, Clipboard
} from 'lucide-react';

// =============================================================================
// FEATURE FLAGS
// =============================================================================

// Auto-clear docs after processing
const DOCS_AUTO_CLEAR_AFTER_SEND = true;

// P0 UX FIX: Enable paste-to-docs feature
const TEXT_DOCS_ENABLED = true;

// =============================================================================
// OPERATOR MODE LOGIC (Inline to avoid import issues)
// =============================================================================

const SPEC_KEYWORDS = ['SPEC', 'PROOF', 'CONTROL', 'P0', 'TICKET', 'OPERATOR', 'ACCEPTANCE', 'CRITERIA'];

// =============================================================================
// PASTE-TO-DOCS: Virtual Document Parser
// =============================================================================

interface VirtualDocument {
  name: string;
  content: string;
  type: string;
  size: number;
}

/**
 * parseVirtualDocs - Detects and extracts pasted document packs from input text
 * 
 * Pattern: FILE X — filename.md
 *          ...content...
 *          FILE Y — anotherfile.md
 *          ...more content...
 * 
 * @param text - Raw input text that may contain pasted document packs
 * @returns { docs: VirtualDocument[], cleanedText: string, hasVirtualDocs: boolean }
 */
function parseVirtualDocs(text: string): { 
  docs: VirtualDocument[]; 
  cleanedText: string; 
  hasVirtualDocs: boolean;
} {
  if (!TEXT_DOCS_ENABLED) {
    return { docs: [], cleanedText: text, hasVirtualDocs: false };
  }

  // Pattern matches: FILE X — filename.ext followed by content until next FILE or end
  // Handles various dash characters (—, -, –)
  const pattern = /^FILE\s+\d+\s*[—\-–]\s*(.+?)\n([\s\S]*?)(?=\nFILE\s+\d+\s*[—\-–]|$)/gm;
  
  const docs: VirtualDocument[] = [];
  let match;
  let lastIndex = 0;
  let cleanedParts: string[] = [];
  let textCopy = text;
  
  // Also try to detect the simpler pattern without "FILE X —" prefix
  // e.g., just "--- filename.md ---" or similar markers
  const altPattern = /^---\s*(.+?\.(?:md|txt|json|yaml|yml|ts|tsx|js|jsx))\s*---\n([\s\S]*?)(?=\n---\s*\S+\.\S+\s*---|$)/gm;
  
  // Check for FILE X — pattern first
  while ((match = pattern.exec(text)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    
    if (content.length > 0) {
      docs.push({
        name: filename,
        content: content,
        type: getFileType(filename),
        size: new Blob([content]).size
      });
    }
  }
  
  // If no FILE X — pattern found, try alt pattern
  if (docs.length === 0) {
    while ((match = altPattern.exec(text)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      
      if (content.length > 0) {
        docs.push({
          name: filename,
          content: content,
          type: getFileType(filename),
          size: new Blob([content]).size
        });
      }
    }
  }
  
  // Clean the text by removing the document blocks
  if (docs.length > 0) {
    // Remove all FILE X — ... blocks from the original text
    let cleaned = text;
    
    // Remove FILE X — pattern blocks
    cleaned = cleaned.replace(/FILE\s+\d+\s*[—\-–]\s*.+?\n[\s\S]*?(?=\nFILE\s+\d+\s*[—\-–]|$)/g, '');
    
    // Remove alt pattern blocks
    cleaned = cleaned.replace(/---\s*.+?\.(?:md|txt|json|yaml|yml|ts|tsx|js|jsx)\s*---\n[\s\S]*?(?=\n---\s*\S+\.\S+\s*---|$)/g, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.trim();
    
    return {
      docs,
      cleanedText: cleaned,
      hasVirtualDocs: true
    };
  }
  
  return { docs: [], cleanedText: text, hasVirtualDocs: false };
}

/**
 * getFileType - Determine MIME type from filename extension
 */
function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    'md': 'text/markdown',
    'txt': 'text/plain',
    'json': 'application/json',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'js': 'text/javascript',
    'jsx': 'text/javascript',
    'html': 'text/html',
    'css': 'text/css',
    'py': 'text/python',
    'csv': 'text/csv',
    'xml': 'text/xml',
  };
  return typeMap[ext] || 'text/plain';
}

// =============================================================================
// OPERATOR INTENT DETECTION - Routes operator vs normal requests
// =============================================================================
function detectOperatorIntent(input: string): boolean {
  const q = input.toLowerCase().trim();
  const triggers = [
    'status', 'next task', 'proof', 'readiness', 'report', 'ticket', 'p0',
    'deploy', 'pr ', 'pull request', 'rollback', 'checklist', 'operator',
    'execution', 'task batch', 'batch #', 'what tickets', 'show tickets',
    'verification', 'blocker', 'blockers', 'sprint', 'milestone'
  ];
  return triggers.some(t => q.includes(t));
}

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
// OPERATOR MODE: Question Response (NO CITATIONS)
// =============================================================================
function generateOperatorQuestionResponse(question: string, docs: { name: string; content: string }[]): string {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST';
  const q = question.toLowerCase();
  
  // Determine response type based on question
  let output = `## 🎯 OPERATOR RESPONSE\n`;
  output += `**Timestamp:** ${timestamp}\n`;
  output += `**Mode:** OPERATOR (Citations Disabled)\n\n`;
  
  if (/status|progress|checklist|how.*going/i.test(q)) {
    output += `### Current Execution Status\n\n`;
    output += `| Status | Count |\n|--------|-------|\n`;
    output += `| 🟢 Complete | 0 |\n`;
    output += `| 🟡 In Progress | 0 |\n`;
    output += `| 🔴 Not Started | All |\n\n`;
    output += `**Next Action:** Execute Task Batch #1\n\n`;
  } else if (/ticket|task|what.*do|next/i.test(q)) {
    output += `### Next Tasks\n\n`;
    output += `Refer to the **TASK BATCH #1** issued above.\n\n`;
    output += `Execute tickets in order. Submit proof for each before marking complete.\n\n`;
  } else if (/proof|evidence|verify/i.test(q)) {
    output += `### Proof Requirements\n\n`;
    output += `Every ticket requires:\n`;
    output += `1. **PR link** - Merged pull request\n`;
    output += `2. **Deploy URL** - Live URL\n`;
    output += `3. **Verification** - Steps + output\n`;
    output += `4. **Rollback** - git revert command\n\n`;
    output += `**Submit proof to mark ticket complete.**\n\n`;
  } else if (/report|readiness|launch/i.test(q)) {
    output += `### Readiness Report\n\n`;
    output += `**Status:** 🔴 NOT READY\n\n`;
    output += `**Reason:** Outstanding tickets require completion and proof.\n\n`;
    output += `Complete all P0 tickets with proof before requesting launch approval.\n\n`;
  } else {
    // Generic operator response
    output += `### Operator Guidance\n\n`;
    output += `I'm in **Operator Mode** managing spec execution.\n\n`;
    output += `Available commands:\n`;
    output += `- "status" - View execution progress\n`;
    output += `- "next task" - See next action items\n`;
    output += `- "proof requirements" - View what's needed\n`;
    output += `- "readiness report" - Check launch status\n\n`;
    output += `**Documents loaded:** ${docs.length}\n\n`;
  }
  
  output += `---\n*Operator Mode Active | Citations Disabled | Proof Required*`;
  
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
  isVirtual?: boolean; // P0 UX FIX: Flag for pasted documents
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

// Document manifest for audit (no file content, just metadata)
interface DocManifest {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  isVirtual?: boolean; // P0 UX FIX: Track if doc was pasted
}

interface Conversation {
  id: string;
  title: string;
  starred: boolean;
  messages: Message[];
  updated_at: string;
  created_at: string;
  message_count: number;
  // Audit metadata
  operatorMode: boolean;
  canonicalSpecsLoaded: boolean;
  docManifest: DocManifest[]; // What docs were loaded (metadata only)
}

// localStorage key for persistence
const STORAGE_KEY = 'javari_conversations_v1';

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
      content: `Hi! I'm Javari, your AI assistant. Upload documents on the right, or paste document packs directly into chat. I'll help you analyze them with citations. What would you like to work on?`,
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
  const [canonicalSpecsLoaded, setCanonicalSpecsLoaded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false); // Track if localStorage loaded
  
  // Conversations state - hydrated from localStorage
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [operatorMode, setOperatorMode] = useState(true); // Default ON for Roy
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =============================================================================
  // LOCALSTORAGE PERSISTENCE
  // =============================================================================
  
  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore conversations with proper Date objects
        const restored = parsed.map((conv: any) => ({
          ...conv,
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setConversations(restored);
      }
    } catch (err) {
      console.error('Failed to load conversations from localStorage:', err);
    }
    setIsHydrated(true);
  }, []);
  
  // Save to localStorage whenever conversations change (after hydration)
  useEffect(() => {
    if (isHydrated && conversations.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      } catch (err) {
        console.error('Failed to save conversations to localStorage:', err);
      }
    }
  }, [conversations, isHydrated]);

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
    
    // OPERATOR MODE HARD GATE: Check for canonical spec documents
    if (operatorMode && processedDocs.length > 0) {
      // Detect canonical spec docs by filename
      const CANONICAL_PATTERNS = [
        /JAVARI_P0_FIX_SPEC/i,
        /JAVARI_CONTROL_PLANE/i,
        /JAVARI_OPERATOR/i,
        /P0.*SPEC/i,
        /CONTROL.*PLANE/i,
        /OPERATOR.*KICKOFF/i
      ];
      
      const hasCanonicalSpecs = processedDocs.some(d => 
        CANONICAL_PATTERNS.some(pattern => pattern.test(d.name)) ||
        isSpecDocument(d.name, d.content)
      );
      
      if (hasCanonicalSpecs) {
        // SET FLAG: This enables operator intent routing in sendMessage
        // But do NOT auto-execute or auto-clear - let user choose what to do
        setCanonicalSpecsLoaded(true);
        
        // Show a notification that specs were detected, but don't auto-execute
        setMessages(prev => [...prev, {
          id: `msg_spec_detected_${Date.now()}`,
          role: 'assistant',
          content: `📋 **Spec documents detected!**\n\n` +
            `I found ${processedDocs.filter(d => isSpecDocument(d.name, d.content)).length} spec document(s).\n\n` +
            `**Options:**\n` +
            `- Type **"summarize"** for an AI summary of all documents\n` +
            `- Type **"status"** or **"tickets"** for Operator Mode task list\n` +
            `- Ask any question about the documents`,
          timestamp: new Date()
        }]);
        
        // DO NOT auto-clear docs - user may want to summarize or ask questions
      }
    }
  };

  // =============================================================================
  // P0 UX FIX: Process Virtual Documents from Pasted Text
  // =============================================================================
  const processVirtualDocs = (virtualDocs: VirtualDocument[]): StoredDocument[] => {
    const now = new Date();
    return virtualDocs.map((vDoc, idx) => ({
      id: `vdoc_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
      name: vDoc.name,
      content: vDoc.content,
      size: vDoc.size,
      type: vDoc.type,
      status: 'ready' as const,
      progress: 100,
      uploadedAt: now,
      isVirtual: true // Mark as pasted, not uploaded
    }));
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // =============================================================================
  // CHAT HANDLER - WITH OPERATOR MODE BYPASS + PASTE-TO-DOCS
  // =============================================================================
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // =========================================================================
    // P0 UX FIX: Detect and process pasted virtual documents BEFORE routing
    // =========================================================================
    let messageText = input.trim();
    let virtualDocsProcessed: StoredDocument[] = [];
    
    if (TEXT_DOCS_ENABLED) {
      const { docs, cleanedText, hasVirtualDocs } = parseVirtualDocs(messageText);
      
      if (hasVirtualDocs && docs.length > 0) {
        // Convert virtual docs to StoredDocuments and add to documents state
        virtualDocsProcessed = processVirtualDocs(docs);
        
        // Add virtual docs to document state immediately
        setDocuments(prev => [...prev, ...virtualDocsProcessed]);
        
        // Show confirmation message
        setMessages(prev => [...prev, {
          id: `msg_vdoc_detect_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Detected ${docs.length} pasted document(s):**\n\n` +
            docs.map((d, i) => `${i + 1}. **${d.name}** (${(d.size / 1024).toFixed(1)} KB)`).join('\n') +
            `\n\nYou can now ask questions, summarize, or run operator tasks.`,
          timestamp: new Date()
        }]);
        
        // Use cleaned text (without document blocks) for the actual message
        messageText = cleanedText;
        
        // Check for spec documents in pasted content
        if (operatorMode) {
          const hasSpecs = docs.some(d => isSpecDocument(d.name, d.content));
          if (hasSpecs) {
            setCanonicalSpecsLoaded(true);
          }
        }
        
        // If the cleaned text is empty, user just pasted docs - don't send empty message
        if (!messageText.trim()) {
          setInput('');
          setIsLoading(false);
          return;
        }
      }
    }
    // =========================================================================
    // END P0 UX FIX: Paste-to-Docs Detection
    // =========================================================================

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageText, // Use cleaned text, not raw input with doc blocks
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const question = messageText;
    setInput('');
    setIsLoading(true);

    try {
      // =========================================================================
      // OPERATOR MODE ROUTER: Only intercept if OPERATOR INTENT detected
      // =========================================================================
      const operatorIntent = detectOperatorIntent(question);
      
      if (operatorMode && canonicalSpecsLoaded && operatorIntent) {
        // User asked an operator-related question (status, tickets, proof, etc.)
        // DO NOT run citation search
        // Generate Operator response
        
        const readyDocs = documents.filter(d => d.status === 'ready');
        const operatorAnswer = generateOperatorQuestionResponse(question, readyDocs);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: operatorAnswer,
          // NO CITATIONS - explicitly undefined
          timestamp: new Date()
        }]);
        
        // Auto-clear docs after processing (if enabled)
        if (DOCS_AUTO_CLEAR_AFTER_SEND) {
          setDocuments([]);
          setIsDragging(false);
        }
        
        setIsLoading(false);
        return; // EXIT EARLY - do not run citations pipeline
      }
      // =========================================================================
      // END OPERATOR MODE ROUTER
      // =========================================================================

      // =========================================================================
      // SUMMARIZE INTENT ROUTER: Real AI summarization
      // =========================================================================
      const summaryTriggers = ['summarize', 'summary', 'overview', 'tl;dr', 'tldr', 
                               'executive summary', 'bullet summary', 'summarise'];
      const isSummaryIntent = summaryTriggers.some(t => 
        question.toLowerCase().includes(t) || question.toLowerCase() === t
      );
      
      const readyDocsForSummary = documents.filter(d => d.status === 'ready');
      
      if (isSummaryIntent) {
        // Check if docs are uploaded
        if (readyDocsForSummary.length === 0) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `📄 **No documents uploaded.**\n\nUpload documents using the panel on the right, or paste document packs directly into chat, then type "summarize" to get an AI-powered summary.`,
            timestamp: new Date()
          }]);
          setIsLoading(false);
          return;
        }
        
        // Call the summarize API
        try {
          const docsPayload = readyDocsForSummary.map(d => ({
            name: d.name,
            content: d.content,
            type: d.type
          }));
          
          // Map provider selector to API provider
          const providerMap: Record<string, string> = {
            'auto': 'auto',
            'claude': 'anthropic',
            'gpt4': 'openai',
            'gemini': 'openai', // fallback
            'perplexity': 'openai', // fallback
            'mistral': 'openai', // fallback
            'llama': 'openai', // fallback
            'cohere': 'openai', // fallback
          };
          
          const response = await fetch('/api/javari/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documents: docsPayload,
              provider: providerMap[selectedProvider] || 'auto'
            })
          });
          
          const result = await response.json();
          
          if (result.success && result.summary) {
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST';
            
            // Format the summary nicely
            let summaryText = `# 📊 Document Summary\n`;
            summaryText += `**Generated:** ${timestamp}\n`;
            summaryText += `**Documents:** ${readyDocsForSummary.length}`;
            // P0 UX FIX: Note if any docs were pasted
            const virtualCount = readyDocsForSummary.filter(d => d.isVirtual).length;
            if (virtualCount > 0) {
              summaryText += ` (${virtualCount} pasted)`;
            }
            summaryText += `\n`;
            summaryText += `**Provider:** ${result.provider || 'AI'}\n\n`;
            summaryText += `---\n\n`;
            summaryText += `## ✅ EXECUTIVE SUMMARY\n\n${result.summary.executive}\n\n`;
            
            if (result.summary.keyPoints?.length > 0) {
              summaryText += `## 🔑 KEY POINTS\n\n`;
              result.summary.keyPoints.forEach((point: string) => {
                summaryText += `- ${point}\n`;
              });
              summaryText += `\n`;
            }
            
            if (result.summary.actionItems?.length > 0 && 
                !result.summary.actionItems[0]?.toLowerCase().includes('no specific')) {
              summaryText += `## 📌 ACTION ITEMS\n\n`;
              result.summary.actionItems.forEach((item: string) => {
                summaryText += `- ${item}\n`;
              });
              summaryText += `\n`;
            }
            
            summaryText += `## 📄 DOCUMENTS ANALYZED\n\n`;
            readyDocsForSummary.forEach((doc, i) => {
              const virtualBadge = doc.isVirtual ? ' 📋' : '';
              summaryText += `${i + 1}. **${doc.name}**${virtualBadge} (${(doc.size / 1024).toFixed(1)} KB)\n`;
            });
            
            setMessages(prev => [...prev, {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: summaryText,
              timestamp: new Date()
            }]);
          } else {
            // API returned error
            setMessages(prev => [...prev, {
              id: `msg_${Date.now()}`,
              role: 'assistant',
              content: `⚠️ **Summary Generation Failed**\n\n${result.error || 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`,
              timestamp: new Date()
            }]);
          }
        } catch (apiErr: any) {
          // Network or other error
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **API Error**\n\n${apiErr.message || 'Failed to connect to summarization service.'}\n\nPlease check your connection and try again.`,
            timestamp: new Date()
          }]);
        }
        
        // Auto-clear docs after successful summary
        if (DOCS_AUTO_CLEAR_AFTER_SEND) {
          setDocuments([]);
          setIsDragging(false);
        }
        
        setIsLoading(false);
        return; // EXIT - do not fall through to citations
      }
      // =========================================================================
      // END SUMMARIZE INTENT ROUTER
      // =========================================================================

      // Normal citations pipeline (runs for normal questions even with Operator Mode ON)
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
        answer = `Upload documents using the panel on the right, or paste document packs directly into chat. I'll search through them to answer your questions with citations.`;
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
      
      // Auto-clear docs after successful processing (normal mode)
      if (DOCS_AUTO_CLEAR_AFTER_SEND && readyDocs.length > 0) {
        setDocuments([]);
        setIsDragging(false);
      }
    } catch (err: any) {
      // On error, do NOT clear docs - user may want to retry
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

  // =============================================================================
  // CHAT MANAGEMENT - Save, Load, New Chat
  // =============================================================================
  
  // Save current conversation to the list (with audit metadata)
  const saveCurrentConversation = () => {
    if (messages.length <= 1) return; // Don't save if only welcome message
    
    // Generate title from first user message
    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg 
      ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
      : 'New Conversation';
    
    const convId = currentConversationId || `conv_${Date.now()}`;
    const now = new Date().toISOString();
    
    // Create doc manifest from current documents (metadata only, no content)
    // P0 UX FIX: Include isVirtual flag in manifest
    const docManifest: DocManifest[] = documents
      .filter(d => d.status === 'ready')
      .map(d => ({
        name: d.name,
        size: d.size,
        type: d.type,
        uploadedAt: d.uploadedAt.toISOString(),
        isVirtual: d.isVirtual || false
      }));
    
    setConversations(prev => {
      // Check if this conversation already exists
      const existingIdx = prev.findIndex(c => c.id === convId);
      const existingConv = existingIdx >= 0 ? prev[existingIdx] : null;
      
      const updatedConv: Conversation = {
        id: convId,
        title,
        starred: existingConv?.starred || false,
        messages: messages,
        updated_at: now,
        created_at: existingConv?.created_at || now,
        message_count: messages.length,
        // Audit metadata
        operatorMode: operatorMode,
        canonicalSpecsLoaded: canonicalSpecsLoaded,
        docManifest: docManifest.length > 0 ? docManifest : (existingConv?.docManifest || [])
      };
      
      if (existingIdx >= 0) {
        // Update existing
        const newList = [...prev];
        newList[existingIdx] = updatedConv;
        return newList;
      } else {
        // Add new at top
        return [updatedConv, ...prev];
      }
    });
    
    return convId;
  };
  
  // Load a conversation (restore audit state)
  const loadConversation = (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv && conv.messages.length > 0) {
      // Save current first if it has content
      if (messages.length > 1 && currentConversationId !== convId) {
        saveCurrentConversation();
      }
      
      setCurrentConversationId(convId);
      setMessages(conv.messages);
      
      // CRITICAL: Clear docs when switching conversations (no document leakage)
      setDocuments([]);
      
      // Restore audit state from conversation
      if (conv.operatorMode !== undefined) setOperatorMode(conv.operatorMode);
      if (conv.canonicalSpecsLoaded !== undefined) setCanonicalSpecsLoaded(conv.canonicalSpecsLoaded);
    }
  };
  
  // Start new chat
  const startNewChat = () => {
    // Save current conversation if it has content
    if (messages.length > 1) {
      saveCurrentConversation();
    }
    
    // Create new conversation ID
    const newConvId = `conv_${Date.now()}`;
    setCurrentConversationId(newConvId);
    
    // Reset messages
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Starting a new conversation! How can I help you?`,
      timestamp: new Date()
    }]);
    
    // CRITICAL: Reset ALL document state
    setDocuments([]);
    setCanonicalSpecsLoaded(false);
    
    // Reset any input state
    setInput('');
    setIsLoading(false);
    setIsDragging(false);
  };
  
  // Auto-save conversation when messages change (debounced effect)
  useEffect(() => {
    if (messages.length > 1 && currentConversationId) {
      const timer = setTimeout(() => {
        saveCurrentConversation();
      }, 1000); // Save 1 second after last message change
      return () => clearTimeout(timer);
    }
  }, [messages]);

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
        <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '30' }}>
          <div className="flex items-center gap-3">
            <Image
              src="/logos/javarilogo.png"
              alt="Javari Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-white font-bold text-lg">Javari</h1>
              <p className="text-xs text-gray-400">AI Assistant</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.cyan }}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setFilterStarred(false)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !filterStarred ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400'
            }`}
          >
            <MessageSquare className="w-3 h-3 inline mr-1" />
            All
          </button>
          <button
            onClick={() => setFilterStarred(true)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStarred ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-400'
            }`}
          >
            <Star className="w-3 h-3 inline mr-1" />
            Starred
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {filterStarred ? 'No starred chats' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`p-3 rounded-lg mb-1 cursor-pointer group transition-all ${
                  currentConversationId === conv.id
                    ? 'bg-cyan-500/20'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white truncate">{conv.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStarred(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
                      >
                        <Star className={`w-3 h-3 ${conv.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">{formatDate(conv.updated_at)}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-500">{conv.message_count} msgs</span>
                      {/* P0 UX FIX: Show badge if conversation had pasted docs */}
                      {conv.docManifest?.some(d => d.isVirtual) && (
                        <>
                          <span className="text-xs text-gray-600">•</span>
                          <Clipboard className="w-3 h-3 text-cyan-400" title="Had pasted docs" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Settings */}
        <div className="p-4 border-t" style={{ borderColor: COLORS.cyan + '30' }}>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </button>
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

      {/* ============== MAIN CONTENT ============== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${msg.role === 'user' ? 'bg-cyan-500/20' : 'bg-purple-500/20'}
                `}>
                  {msg.role === 'user' 
                    ? <User className="w-5 h-5" style={{ color: COLORS.cyan }} />
                    : <Bot className="w-5 h-5 text-purple-400" />
                  }
                </div>

                {/* Message Content */}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`
                    inline-block px-4 py-3 rounded-2xl text-sm
                    ${msg.role === 'user' 
                      ? 'bg-cyan-500/20 text-white rounded-br-none' 
                      : 'bg-white/5 text-gray-200 rounded-bl-none'}
                  `}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Sources</p>
                      {msg.citations.map((cite, idx) => (
                        <div 
                          key={idx}
                          className="bg-white/5 rounded-lg p-3 text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-3 h-3" style={{ color: COLORS.cyan }} />
                            <span className="text-xs font-medium text-cyan-400">{cite.documentName}</span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">{cite.snippet}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-600 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-bl-none px-4 py-3">
                  <p className="text-sm text-gray-400">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4" style={{ borderColor: COLORS.cyan + '30' }}>
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents, or paste FILE X — blocks..."
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
            onClick={() => {
              setOperatorMode(!operatorMode);
              if (operatorMode) setCanonicalSpecsLoaded(false); // Reset when turning off
            }}
            className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              operatorMode 
                ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50' 
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            Operator Mode {operatorMode ? 'ON' : 'OFF'}
          </button>
          
          {/* Operator Mode Hint */}
          {operatorMode && (
            <p className="mt-2 text-xs text-gray-500 text-center px-2">
              Routes operator commands only.<br/>Normal questions still work.
            </p>
          )}
          
          {/* Citations Disabled Badge - shows when Operator Mode active with specs */}
          {operatorMode && canonicalSpecsLoaded && (
            <div className="mt-2 px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs flex items-center gap-1">
              <X className="w-3 h-3" />
              Specs Loaded • Operator Ready
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b" style={{ borderColor: COLORS.cyan + '30' }}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: COLORS.cyan }} />
              Documents ({readyDocsCount})
            </h3>
            {/* P0 UX FIX: Hint about pasting docs */}
            {TEXT_DOCS_ENABLED && readyDocsCount === 0 && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clipboard className="w-3 h-3" />
                Paste FILE blocks in chat
              </p>
            )}
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
                  <p className="text-sm text-white truncate flex items-center gap-1">
                    {doc.name}
                    {/* P0 UX FIX: Badge for pasted docs */}
                    {doc.isVirtual && (
                      <Clipboard className="w-3 h-3 text-cyan-400 flex-shrink-0" title="Pasted document" />
                    )}
                  </p>
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
