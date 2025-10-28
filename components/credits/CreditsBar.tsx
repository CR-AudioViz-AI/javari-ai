'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Info } from 'lucide-react';
import { useUserProfile } from '@/components/user-profile/user-profile-context';

// ============================================================================
// CREDITS BAR - Shows below header, above Javari interface
// ============================================================================

export function CreditsBar() {
  const { profile, language } = useUserProfile();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!profile) return null;

  const creditsPercentage = (profile.creditsRemaining / profile.creditsTotal) * 100;
  
  // Color based on credits remaining
  const getBarColor = () => {
    if (creditsPercentage > 50) return 'bg-green-500';
    if (creditsPercentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPlanBadgeColor = () => {
    switch (profile.plan) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'starter': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const translations = {
    en: {
      credits: 'Credits',
      plan: 'Plan',
      learnMore: 'Learn More',
      creditsInfo: 'Credits are used for AI interactions, code generation, and file analysis'
    },
    es: {
      credits: 'Créditos',
      plan: 'Plan',
      learnMore: 'Saber Más',
      creditsInfo: 'Los créditos se utilizan para interacciones de IA, generación de código y análisis de archivos'
    }
  };

  const t = translations[language];

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Credits Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-700">{t.credits}:</span>
            <span className="text-lg font-bold text-gray-900">
              {profile.creditsRemaining.toLocaleString()}
            </span>
            <span className="text-gray-500">/ {profile.creditsTotal.toLocaleString()}</span>
            
            {/* Info Tooltip */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
              
              {showTooltip && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-50">
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  {t.creditsInfo}
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getBarColor()} transition-all duration-500`}
              style={{ width: `${creditsPercentage}%` }}
            />
          </div>
        </div>

        {/* Plan & Actions */}
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPlanBadgeColor()}`}>
            {t.plan}: {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
          </span>
          
          <Link
            href="/plans"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t.learnMore}
          </Link>
        </div>
      </div>
    </div>
  );
}
