'use client';

/**
 * MobileJavariWrapper.tsx
 * 
 * Wrapper component that makes JavariChatInterface mobile-responsive by:
 * - Auto-collapsing side panels on mobile
 * - Adding overlay mode for panels when expanded
 * - Handling touch gestures for panel open/close
 * - Preventing body scroll when panels are open
 * 
 * @timestamp Thursday, December 25, 2025 - 6:25 PM EST
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, Menu, MessageSquare, Lightbulb } from 'lucide-react';

// ============================================================================
// MOBILE DETECTION
// ============================================================================
const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// ============================================================================
// MOBILE PANEL CONTEXT
// ============================================================================
interface MobilePanelContextType {
  isMobile: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  openLeftPanel: () => void;
  closeLeftPanel: () => void;
  openRightPanel: () => void;
  closeRightPanel: () => void;
  closeAllPanels: () => void;
}

const MobilePanelContext = createContext<MobilePanelContextType | null>(null);

export function useMobilePanels() {
  const context = useContext(MobilePanelContext);
  if (!context) {
    throw new Error('useMobilePanels must be used within MobileJavariWrapper');
  }
  return context;
}

// ============================================================================
// MOBILE BOTTOM NAV
// ============================================================================
function MobileBottomNav({
  onOpenHistory,
  onOpenSuggestions,
}: {
  onOpenHistory: () => void;
  onOpenSuggestions: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900 border-t border-slate-700 pb-safe">
      <div className="flex justify-around items-center h-14">
        <button
          onClick={onOpenHistory}
          className="flex flex-col items-center justify-center flex-1 h-full
                     text-slate-400 hover:text-white active:bg-slate-800
                     transition-colors touch-manipulation"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-xs mt-1">History</span>
        </button>
        
        <div className="w-px h-8 bg-slate-700" />
        
        <button
          onClick={onOpenSuggestions}
          className="flex flex-col items-center justify-center flex-1 h-full
                     text-slate-400 hover:text-white active:bg-slate-800
                     transition-colors touch-manipulation"
        >
          <Lightbulb className="w-5 h-5" />
          <span className="text-xs mt-1">Suggestions</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MOBILE OVERLAY PANEL
// ============================================================================
function MobileOverlayPanel({
  isOpen,
  onClose,
  position,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  position: 'left' | 'right';
  title: string;
  children: React.ReactNode;
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          absolute top-0 bottom-0 w-[85%] max-w-sm
          bg-slate-900 shadow-2xl
          transform transition-transform duration-300 ease-out
          ${position === 'left' ? 'left-0' : 'right-0'}
          ${isOpen 
            ? 'translate-x-0' 
            : position === 'left' 
              ? '-translate-x-full' 
              : 'translate-x-full'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center
                       text-slate-400 hover:text-white hover:bg-slate-800
                       rounded-lg transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-56px)] overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOBILE PROVIDER SELECTOR
// ============================================================================
export function MobileProviderSelector({
  providers,
  selected,
  onSelect,
}: {
  providers: { key: string; name: string; icon: React.ReactNode; color: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex gap-2 min-w-max md:flex-wrap md:justify-center">
        {providers.map((provider) => (
          <button
            key={provider.key}
            onClick={() => onSelect(provider.key)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
              whitespace-nowrap transition-all touch-manipulation min-h-[44px]
              ${selected === provider.key
                ? `bg-gradient-to-r ${provider.color} text-white shadow-lg`
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }
            `}
          >
            {provider.icon}
            <span className="hidden sm:inline">{provider.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN WRAPPER COMPONENT
// ============================================================================
interface MobileJavariWrapperProps {
  children: React.ReactNode;
  leftPanelContent?: React.ReactNode;
  rightPanelContent?: React.ReactNode;
}

export function MobileJavariWrapper({
  children,
  leftPanelContent,
  rightPanelContent,
}: MobileJavariWrapperProps) {
  const isMobile = useIsMobile();
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const openLeftPanel = useCallback(() => {
    setLeftPanelOpen(true);
    setRightPanelOpen(false);
  }, []);

  const closeLeftPanel = useCallback(() => {
    setLeftPanelOpen(false);
  }, []);

  const openRightPanel = useCallback(() => {
    setRightPanelOpen(true);
    setLeftPanelOpen(false);
  }, []);

  const closeRightPanel = useCallback(() => {
    setRightPanelOpen(false);
  }, []);

  const closeAllPanels = useCallback(() => {
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
  }, []);

  const contextValue: MobilePanelContextType = {
    isMobile,
    leftPanelOpen,
    rightPanelOpen,
    openLeftPanel,
    closeLeftPanel,
    openRightPanel,
    closeRightPanel,
    closeAllPanels,
  };

  return (
    <MobilePanelContext.Provider value={contextValue}>
      <div className="flex h-screen bg-slate-950">
        {/* Desktop: Show panels inline */}
        {!isMobile && leftPanelContent && (
          <div className="hidden md:block">
            {leftPanelContent}
          </div>
        )}

        {/* Main Content - Full width on mobile with bottom padding */}
        <div className={`flex-1 flex flex-col min-w-0 ${isMobile ? 'pb-14' : ''}`}>
          {children}
        </div>

        {/* Desktop: Show right panel inline */}
        {!isMobile && rightPanelContent && (
          <div className="hidden md:block">
            {rightPanelContent}
          </div>
        )}

        {/* Mobile: Overlay Panels */}
        {isMobile && (
          <>
            <MobileOverlayPanel
              isOpen={leftPanelOpen}
              onClose={closeLeftPanel}
              position="left"
              title="Chat History"
            >
              {leftPanelContent}
            </MobileOverlayPanel>

            <MobileOverlayPanel
              isOpen={rightPanelOpen}
              onClose={closeRightPanel}
              position="right"
              title="Suggestions"
            >
              {rightPanelContent}
            </MobileOverlayPanel>

            {/* Mobile Bottom Navigation */}
            {!leftPanelOpen && !rightPanelOpen && (
              <MobileBottomNav
                onOpenHistory={openLeftPanel}
                onOpenSuggestions={openRightPanel}
              />
            )}
          </>
        )}
      </div>
    </MobilePanelContext.Provider>
  );
}

export default MobileJavariWrapper;
