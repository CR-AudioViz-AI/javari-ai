import { create } from 'zustand';

// Type Definitions
export type ChatMode = 'single' | 'advanced' | 'super' | 'roadmap';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  mode?: ChatMode;
  metadata?: {
    councilVotes?: Array<{
      provider: string;
      vote: string;
      confidence: number;
      reasoning: string;
    }>;
    [key: string]: any;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  provider: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatStoreState {
  // Session management
  sessions: ChatSession[];
  currentSessionId: string;
  
  // Current chat state
  messages: ChatMessage[];
  input: string;
  mode: ChatMode;
  provider: string;
  loading: boolean;
  error: string | null;
  showCouncil: boolean;
  
  // Actions
  setInput: (input: string) => void;
  setMode: (mode: ChatMode) => void;
  setProvider: (provider: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowCouncil: (show: boolean) => void;
  
  // Message management
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  
  // Session management
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, session: ChatSession) => void;
  setCurrentSessionId: (id: string) => void;
  loadSession: (session: ChatSession) => void;
  newSession: () => void;
  clearSessions: () => void;
  
  // Send message
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSessionId: '',
  messages: [],
  input: '',
  mode: 'single',
  provider: 'openai',
  loading: false,
  error: null,
  showCouncil: false,
  
  // Simple setters
  setInput: (input) => set({ input }),
  setMode: (mode) => set({ mode }),
  setProvider: (provider) => set({ provider }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setShowCouncil: (showCouncil) => set({ showCouncil }),
  
  // Message management
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  
  setMessages: (messages) => set({ messages }),
  
  clearMessages: () => set({ messages: [] }),
  
  // Session management
  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
    })),
  
  updateSession: (id, session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? session : s)),
    })),
  
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  
  loadSession: (session) =>
    set({
      currentSessionId: session.id,
      messages: session.messages,
      mode: session.mode,
      provider: session.provider,
      showCouncil: false,
    }),
  
  newSession: () => {
    const newSessionId = `session-${Date.now()}`;
    set({
      currentSessionId: newSessionId,
      messages: [],
      showCouncil: false,
    });
  },
  
  clearSessions: () =>
    set({
      sessions: [],
      currentSessionId: '',
      messages: [],
    }),
  
  // Send message function
  sendMessage: async (content: string) => {
    const state = get();
    
    if (!content.trim() || state.loading) return;
    
    set({ loading: true, error: null });
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    // Add user message
    const updatedMessages = [...state.messages, userMessage];
    set({ messages: updatedMessages, input: '' });
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          mode: state.mode,
          provider: state.provider,
          history: state.messages,
        }),
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response || 'No response received',
        provider: data.provider,
        mode: state.mode,
        timestamp: Date.now(),
        metadata: data.metadata,
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      set({ messages: finalMessages });
      
      // Save session
      const session: ChatSession = {
        id: state.currentSessionId,
        title: finalMessages[0]?.content.slice(0, 50) || 'New Chat',
        messages: finalMessages,
        mode: state.mode,
        provider: state.provider,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      get().addSession(session);
      
      // Show council if SuperMode
      if (state.mode === 'super' && data.metadata?.councilVotes) {
        set({ showCouncil: true });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      
      const errorMessages = [...updatedMessages, errorMessage];
      set({
        messages: errorMessages,
        error: error instanceof Error ? error.message : 'Failed to get response',
      });
      
      // Save error session
      const session: ChatSession = {
        id: state.currentSessionId,
        title: errorMessages[0]?.content.slice(0, 50) || 'New Chat',
        messages: errorMessages,
        mode: state.mode,
        provider: state.provider,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      get().addSession(session);
    } finally {
      set({ loading: false });
    }
  },
}));
