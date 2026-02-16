/**
 * JAVARI AI - Provider Selector Component
 * 
 * Features:
 * - Auto mode (smart routing) as default
 * - Manual provider selection
 * - User can set default provider in account
 * - Javari learns from ALL interactions regardless of provider
 * 
 * Created: December 29, 2025
 * Author: Claude for CR AudioViz AI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';

// Available AI providers with their display info
const AI_PROVIDERS = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Smart routing - Javari picks the best AI',
    icon: '🤖',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    free: true
  },
  {
    id: 'anthropic',
    name: 'Claude',
    description: 'Best for complex reasoning & code',
    icon: '🧠',
    color: 'bg-orange-500',
    free: false,
    models: ['claude-sonnet-4', 'claude-haiku-3.5', 'claude-opus-4']
  },
  {
    id: 'openai',
    name: 'GPT-4',
    description: 'Great all-around AI',
    icon: '💚',
    color: 'bg-green-500',
    free: true, // Free with data sharing!
    models: ['gpt-4o', 'gpt-4o-mini', 'o1']
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast, FREE!',
    icon: '⚡',
    color: 'bg-blue-500',
    free: true,
    models: ['llama-3.3-70b-versatile']
  },
  {
    id: 'google',
    name:
    description: 'Google AI, great for long docs',
    icon: '🔷',
    color: 'bg-blue-600',
    free: true,
    models: ['-1.5-flash', '-1.5-pro']
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'European AI, multilingual',
    icon: '🌊',
    color: 'bg-indigo-500',
    free: true,
    models: ['mistral-large', 'mistral-small']
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Real-time web search',
    icon: '🔍',
    color: 'bg-teal-500',
    free: false,
    models: ['sonar-pro']
  },
  {
    id: 'together',
    name: 'Together',
    description: 'Open source models',
    icon: '🤝',
    color: 'bg-yellow-500',
    free: false,
    models: ['llama-3.3-70b']
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Great for RAG & search',
    icon: '🔗',
    color: 'bg-red-500',
    free: true,
    models: ['command-r-plus']
  }
];

interface AIProviderSelectorProps {
  selectedProvider: string;
  onProviderChange: (providerId: string) => void;
  userId?: string;
  showSetDefault?: boolean;
  compact?: boolean;
}

export function AIProviderSelector({
  selectedProvider,
  onProviderChange,
  userId,
  showSetDefault = true,
  compact = false
}: AIProviderSelectorProps) {
  const [userDefault, setUserDefault] = useState<string>('auto');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  const supabase = createClient();
  
  // Load user's default provider on mount
  useEffect(() => {
    if (userId) {
      loadUserDefault();
    }
  }, [userId]);
  
  const loadUserDefault = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('default_ai_provider')
        .eq('user_id', userId)
        .single();
      
      if (data?.default_ai_provider) {
        setUserDefault(data.default_ai_provider);
        // Set as selected if currently on auto
        if (selectedProvider === 'auto') {
          onProviderChange(data.default_ai_provider);
        }
      }
    } catch (error) {
      // User might not have preferences yet
      console.log('No user preferences found, using auto');
    }
  };
  
  const saveAsDefault = async () => {
    if (!userId || selectedProvider === 'auto') return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          default_ai_provider: selectedProvider,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (!error) {
        setUserDefault(selectedProvider);
      }
    } catch (error) {
      console.error('Failed to save default:', error);
    }
    setSaving(false);
  };
  
  // Display providers - show top 5 by default, all when expanded
  const displayProviders = showAll 
    ? AI_PROVIDERS 
    : AI_PROVIDERS.slice(0, 5);
  
  if (compact) {
    // Compact dropdown version
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">AI:</label>
        <select
          value={selectedProvider}
          onChange={(e) => onProviderChange(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1 bg-white dark:bg-gray-800 
                     border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500"
        >
          {AI_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.icon} {provider.name}
              {provider.free && ' (Free)'}
              {provider.id === userDefault && provider.id !== 'auto' && ' ★'}
            </option>
          ))}
        </select>
      </div>
    );
  }
  
  // Full button grid version
  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          AI Provider
        </h3>
        {selectedProvider !== 'auto' && (
          <span className="text-xs text-gray-500">
            Using: {AI_PROVIDERS.find(p => p.id === selectedProvider)?.name}
          </span>
        )}
      </div>
      
      {/* Provider Buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
        {displayProviders.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          const isDefault = userDefault === provider.id && provider.id !== 'auto';
          
          return (
            <button
              key={provider.id}
              onClick={() => onProviderChange(provider.id)}
              className={`
                relative flex flex-col items-center justify-center p-2 rounded-lg
                transition-all duration-200 ease-in-out
                ${isSelected 
                  ? `${provider.color} text-white shadow-lg scale-105` 
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                }
              `}
              title={provider.description}
            >
              {/* Default star indicator */}
              {isDefault && (
                <span className="absolute -top-1 -right-1 text-yellow-400 text-xs">★</span>
              )}
              
              {/* Free badge */}
              {provider.free && provider.id !== 'auto' && (
                <span className="absolute -top-1 -left-1 bg-green-500 text-white text-[8px] px-1 rounded">
                  FREE
                </span>
              )}
              
              <span className="text-lg mb-1">{provider.icon}</span>
              <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                {provider.name}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Show More / Less */}
      {AI_PROVIDERS.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline mb-3"
        >
          {showAll ? 'Show less' : `Show ${AI_PROVIDERS.length - 5} more providers`}
        </button>
      )}
      
      {/* Set as Default Button */}
      {showSetDefault && userId && selectedProvider !== 'auto' && selectedProvider !== userDefault && (
        <button
          onClick={saveAsDefault}
          disabled={saving}
          className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 
                     hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg
                     transition-colors duration-200 disabled:opacity-50"
        >
          {saving ? 'Saving...' : `Set ${AI_PROVIDERS.find(p => p.id === selectedProvider)?.name} as my default`}
        </button>
      )}
      
      {/* Current selection info */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        {selectedProvider === 'auto' ? (
          <span>🤖 Javari will automatically pick the best AI for each message</span>
        ) : (
          <span>
            {AI_PROVIDERS.find(p => p.id === selectedProvider)?.description}
          </span>
        )}
      </div>
      
      {/* Learning indicator */}
      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Javari learns from every conversation
      </div>
    </div>
  );
}

export default AIProviderSelector;
