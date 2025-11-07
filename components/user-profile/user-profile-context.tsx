'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ============================================================================
// USER PROFILE CONTEXT - Manages user profile and preferences
// ============================================================================

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  language: 'en' | 'es';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  creditsRemaining: number;
  creditsTotal: number;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguageState] = useState<'en' | 'es'>('en');

  useEffect(() => {
    // Load user profile from API
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setLanguageState(data.language || 'en');
      }
    } catch (error: unknown) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: 'en' | 'es') => {
    setLanguageState(lang);
    
    // Save to backend
    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang })
      });
      
      if (profile) {
        setProfile({ ...profile, language: lang });
      }
    } catch (error: unknown) {
      console.error('Failed to update language:', error);
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const value: UserProfileContextType = {
    profile,
    isLoading,
    language,
    setLanguage,
    updateProfile,
    refreshProfile,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
