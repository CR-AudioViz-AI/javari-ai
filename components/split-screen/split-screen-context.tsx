'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// SPLIT SCREEN CONTEXT - Manages sidebar state and content
// ============================================================================

export type SidebarContentType = 
  | 'code' 
  | 'file' 
  | 'diff' 
  | 'image' 
  | 'markdown' 
  | 'json'
  | 'error'
  | 'suggestion';

export interface SidebarContent {
  type: SidebarContentType;
  title: string;
  content: string;
  language?: string; // For code highlighting
  fileName?: string;
  fileExtension?: string;
  metadata?: Record<string, any>;
}

interface SplitScreenContextType {
  // State
  isOpen: boolean;
  content: SidebarContent | null;
  
  // Actions
  openSidebar: (content: SidebarContent) => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  updateContent: (content: SidebarContent) => void;
  
  // Auto-open for Javari
  autoOpen: (content: SidebarContent, reason?: string) => void;
}

const SplitScreenContext = createContext<SplitScreenContextType | undefined>(undefined);

export function SplitScreenProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<SidebarContent | null>(null);

  const openSidebar = useCallback((newContent: SidebarContent) => {
    setContent(newContent);
    setIsOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const updateContent = useCallback((newContent: SidebarContent) => {
    setContent(newContent);
  }, []);

  // Auto-open with optional logging for why Javari opened it
  const autoOpen = useCallback((newContent: SidebarContent, reason?: string) => {
    if (reason) {
      console.log('[Javari Auto-Open]:', reason);
    }
    setContent(newContent);
    setIsOpen(true);
  }, []);

  const value: SplitScreenContextType = {
    isOpen,
    content,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    updateContent,
    autoOpen,
  };

  return (
    <SplitScreenContext.Provider value={value}>
      {children}
    </SplitScreenContext.Provider>
  );
}

// Custom hook to use split screen context
export function useSplitScreen() {
  const context = useContext(SplitScreenContext);
  if (context === undefined) {
    throw new Error('useSplitScreen must be used within a SplitScreenProvider');
  }
  return context;
}
