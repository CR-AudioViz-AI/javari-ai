// hooks/use-mobile.ts
// Mobile Detection Hook for Javari AI
// Auto-collapses side panels on mobile devices
// Timestamp: Thursday, December 25, 2025 - 6:20 PM EST

'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // md breakpoint in Tailwind
const TABLET_BREAKPOINT = 1024; // lg breakpoint

export interface UseMobileResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  hasTouchScreen: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export function useMobile(): UseMobileResult {
  const [state, setState] = useState<UseMobileResult>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1024,
    height: 768,
    orientation: 'landscape',
    hasTouchScreen: false,
    isIOS: false,
    isAndroid: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < MOBILE_BREAKPOINT;
      const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
      const isDesktop = width >= TABLET_BREAKPOINT;
      const orientation = height > width ? 'portrait' : 'landscape';
      
      // Check for touch capability
      const hasTouchScreen = 
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - older API
        navigator.msMaxTouchPoints > 0;

      // Detect iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Detect Android
      const isAndroid = /Android/.test(navigator.userAgent);

      // Get safe area insets from CSS env()
      const computedStyle = getComputedStyle(document.documentElement);
      const safeAreaInsets = {
        top: parseInt(computedStyle.getPropertyValue('--safe-area-top') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-bottom') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-left') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-right') || '0', 10),
      };

      setState({
        isMobile,
        isTablet,
        isDesktop,
        width,
        height,
        orientation,
        hasTouchScreen,
        isIOS,
        isAndroid,
        safeAreaInsets,
      });
    };

    // Initial check
    checkDevice();

    // Listen for resize and orientation changes
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return state;
}

// Simple hook that just returns isMobile boolean
export function useIsMobile(): boolean {
  const { isMobile } = useMobile();
  return isMobile;
}

// Hook for getting recommended panel states
export function usePanelStates(): {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  shouldShowOverlay: boolean;
} {
  const { isMobile, isTablet } = useMobile();
  
  return {
    leftPanelCollapsed: isMobile || isTablet,
    rightPanelCollapsed: isMobile,
    shouldShowOverlay: isMobile,
  };
}

export default useMobile;
