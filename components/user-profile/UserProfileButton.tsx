'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';
import { useUserProfile } from './user-profile-context';
import { UserProfileMenu } from './UserProfileMenu';

// ============================================================================
// USER PROFILE BUTTON - Bottom left corner trigger
// ============================================================================

export function UserProfileButton() {
  const { profile, isLoading } = useUserProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  if (isLoading) {
    return (
      <button className="fixed bottom-4 left-4 px-4 py-2 bg-gray-200 rounded-full shadow-lg animate-pulse z-40">
        <div className="w-24 h-4 bg-gray-300 rounded"></div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        ref={buttonRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="px-4 py-2 bg-white hover:bg-gray-50 rounded-full shadow-lg border border-gray-200 transition-all duration-200 flex items-center gap-2"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {profile?.name.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
        </div>
        <span className="font-medium text-sm text-gray-700">
          {profile?.name || 'User'}
        </span>
      </button>

      {isMenuOpen && (
        <div ref={menuRef}>
          <UserProfileMenu onClose={() => setIsMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
