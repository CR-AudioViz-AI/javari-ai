'use client';

import React, { ReactNode } from 'react';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useSplitScreen } from '@/components/split-screen/split-screen-context';
import { Sidebar } from '@/components/split-screen/Sidebar';

// ============================================================================
// SPLIT SCREEN LAYOUT - Main layout with collapsible sidebar
// ============================================================================

interface SplitScreenLayoutProps {
  children: ReactNode;
  showToggleButton?: boolean;
}

export function SplitScreenLayout({ children, showToggleButton = true }: SplitScreenLayoutProps) {
  const { isOpen, toggleSidebar } = useSplitScreen();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content */}
        <div 
          className={`flex-1 overflow-auto transition-all duration-300 ${
            isOpen ? 'mr-0' : 'mr-0'
          }`}
        >
          {children}
        </div>

        {/* Sidebar - Slides in from right */}
        <div 
          className={`transition-all duration-300 ease-in-out ${
            isOpen ? 'w-1/2 lg:w-2/5' : 'w-0'
          } overflow-hidden`}
        >
          <Sidebar />
        </div>

        {/* Toggle Button - Fixed position */}
        {showToggleButton && (
          <button
            onClick={toggleSidebar}
            className={`fixed right-4 bottom-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-50 ${
              isOpen ? 'rotate-0' : 'rotate-0'
            }`}
            aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
            title={isOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {isOpen ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelRightOpen className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
