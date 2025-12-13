'use client';

// hooks/useConversationTracking.ts
// Real-time conversation tracking hook
// Version: 1.0.0
// Timestamp: 2025-12-13 10:10 AM EST

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChatStatus {
  id: string;
  title: string;
  isActive: boolean;
  contextTokensUsed: number;
  contextTokensMax: number;
  contextPercentage: number;
  buildProgress: number;
  buildStatus: 'idle' | 'building' | 'complete' | 'error';
  continuationDepth: number;
  parentId: string | null;
  rootConversationId: string | null;
  messageCount: number;
  lastActivityAt: string;
  needsContinuation: boolean;
  warningLevel: 'none' | 'warning' | 'critical';
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  position: number;
  isCurrent: boolean;
  isActive: boolean;
  messageCount: number;
  contextUsed: number;
  createdAt: string;
}

export interface TrackingData {
  contextTokensUsed: number;
  contextTokensMax: number;
  contextPercentage: number;
  warningLevel: 'none' | 'warning' | 'critical';
  needsContinuation: boolean;
  messageCount: number;
  continuedFrom?: string | null;
  continuedTo?: string | null;
}

interface UseConversationTrackingOptions {
  userId: string | null;
  currentConversationId: string | null;
  pollingInterval?: number; // ms
  onContinuationNeeded?: (conversationId: string) => void;
  onConversationCreated?: (newId: string, fromId: string) => void;
}

export function useConversationTracking({
  userId,
  currentConversationId,
  pollingInterval = 3000,
  onContinuationNeeded,
  onConversationCreated,
}: UseConversationTrackingOptions) {
  const [chats, setChats] = useState<ChatStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ChatStatus | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastTracking, setLastTracking] = useState<TrackingData | null>(null);
  
  const previousContinuationRef = useRef<boolean>(false);

  // Fetch all chat statuses
  const fetchChats = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/javari/chat-status?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        
        // Find current chat in the list
        if (currentConversationId) {
          const current = (data.chats || []).find(
            (c: ChatStatus) => c.id === currentConversationId
          );
          if (current) {
            setCurrentStatus(current);
            
            // Check if continuation just became needed
            if (current.needsContinuation && !previousContinuationRef.current) {
              onContinuationNeeded?.(current.id);
            }
            previousContinuationRef.current = current.needsContinuation;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentConversationId, onContinuationNeeded]);

  // Fetch breadcrumbs for current conversation
  const fetchBreadcrumbs = useCallback(async () => {
    if (!currentConversationId) {
      setBreadcrumbs([]);
      return;
    }
    
    try {
      const response = await fetch(
        `/api/javari/chat-chain?conversationId=${currentConversationId}`
      );
      if (response.ok) {
        const data = await response.json();
        setBreadcrumbs(data.chain || []);
      }
    } catch (error) {
      console.error('Failed to fetch breadcrumbs:', error);
    }
  }, [currentConversationId]);

  // Create continuation
  const createContinuation = useCallback(async (conversationId: string) => {
    if (!userId) return null;
    
    try {
      const response = await fetch('/api/javari/chat-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentConversationId: conversationId,
          userId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        onConversationCreated?.(data.newConversationId, conversationId);
        
        // Refresh data
        await fetchChats();
        await fetchBreadcrumbs();
        
        return data.newConversationId;
      }
    } catch (error) {
      console.error('Failed to create continuation:', error);
    }
    
    return null;
  }, [userId, onConversationCreated, fetchChats, fetchBreadcrumbs]);

  // Update tracking from API response
  const updateFromResponse = useCallback((tracking: TrackingData) => {
    setLastTracking(tracking);
    
    // Update current status with new tracking data
    if (currentStatus) {
      setCurrentStatus(prev => prev ? {
        ...prev,
        contextTokensUsed: tracking.contextTokensUsed,
        contextTokensMax: tracking.contextTokensMax,
        contextPercentage: tracking.contextPercentage,
        warningLevel: tracking.warningLevel,
        needsContinuation: tracking.needsContinuation,
        messageCount: tracking.messageCount,
      } : null);
    }
    
    // Handle auto-continuation
    if (tracking.continuedTo && tracking.continuedTo !== currentConversationId) {
      onConversationCreated?.(tracking.continuedTo, currentConversationId || '');
    }
  }, [currentStatus, currentConversationId, onConversationCreated]);

  // Set active conversation
  const setActiveConversation = useCallback(async (conversationId: string) => {
    if (!userId) return;
    
    try {
      await fetch('/api/javari/chat-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          userId,
          isActive: true,
        }),
      });
      
      // Refresh data
      await fetchChats();
    } catch (error) {
      console.error('Failed to set active conversation:', error);
    }
  }, [userId, fetchChats]);

  // Initial fetch and polling
  useEffect(() => {
    fetchChats();
    
    const interval = setInterval(fetchChats, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchChats, pollingInterval]);

  // Fetch breadcrumbs when conversation changes
  useEffect(() => {
    fetchBreadcrumbs();
  }, [fetchBreadcrumbs]);

  // Computed values
  const activeChats = chats.filter(c => c.isActive);
  const recentChats = chats.filter(c => !c.isActive);
  const chainLength = breadcrumbs.length;
  const isInChain = chainLength > 1;

  return {
    // Data
    chats,
    activeChats,
    recentChats,
    currentStatus,
    breadcrumbs,
    lastTracking,
    isLoading,
    
    // Computed
    chainLength,
    isInChain,
    
    // Actions
    fetchChats,
    fetchBreadcrumbs,
    createContinuation,
    updateFromResponse,
    setActiveConversation,
  };
}

// Helper hook for build progress simulation
export function useBuildProgress(isBuilding: boolean, onComplete?: () => void) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (!isBuilding) {
      setProgress(0);
      return;
    }
    
    // Simulate progress
    const intervals = [
      { delay: 100, progress: 10 },
      { delay: 300, progress: 25 },
      { delay: 500, progress: 40 },
      { delay: 800, progress: 60 },
      { delay: 1200, progress: 80 },
      { delay: 1500, progress: 90 },
    ];
    
    const timeouts = intervals.map(({ delay, progress }) =>
      setTimeout(() => setProgress(progress), delay)
    );
    
    return () => timeouts.forEach(clearTimeout);
  }, [isBuilding]);
  
  useEffect(() => {
    if (progress >= 90 && isBuilding) {
      // Complete after a short delay
      const timeout = setTimeout(() => {
        setProgress(100);
        onComplete?.();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [progress, isBuilding, onComplete]);
  
  return progress;
}

export default useConversationTracking;
