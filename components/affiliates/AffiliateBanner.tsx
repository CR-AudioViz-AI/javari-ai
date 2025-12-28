// components/affiliates/AffiliateBanner.tsx
// Reusable affiliate promotion banner component
// Created: December 28, 2025

'use client';

import { useState } from 'react';
import { X, ExternalLink, Sparkles } from 'lucide-react';
import { AFFILIATE_PROGRAMS, trackAffiliateClick } from '@/lib/affiliates/config';

interface AffiliateBannerProps {
  programId: keyof typeof AFFILIATE_PROGRAMS;
  placement: string;
  variant?: 'banner' | 'card' | 'inline' | 'floating';
  dismissible?: boolean;
  className?: string;
}

export function AffiliateBanner({
  programId,
  placement,
  variant = 'banner',
  dismissible = true,
  className = ''
}: AffiliateBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const program = AFFILIATE_PROGRAMS[programId];

  if (!program || dismissed) return null;

  const handleClick = () => {
    trackAffiliateClick(programId, placement);
    window.open(program.link, '_blank', 'noopener,noreferrer');
  };

  const baseStyles = {
    banner: 'w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg shadow-lg',
    card: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md',
    inline: 'inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full',
    floating: 'fixed bottom-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-xl shadow-2xl max-w-sm z-50'
  };

  return (
    <div className={`${baseStyles[variant]} ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {program.badge && (
            <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
              <Sparkles className="w-3 h-3" />
              {program.badge}
            </span>
          )}
          <div>
            <h4 className="font-semibold">{program.name}</h4>
            {program.description && (
              <p className="text-sm opacity-90">{program.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleClick}
            className="flex items-center gap-2 bg-white text-purple-600 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Learn More
            <ExternalLink className="w-4 h-4" />
          </button>
          
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Specific affiliate components for common use cases
export function ElevenLabsBanner({ placement }: { placement: string }) {
  return (
    <AffiliateBanner
      programId="elevenlabs"
      placement={placement}
      variant="card"
    />
  );
}

export function TravelAffiliateBanner({ placement }: { placement: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <AffiliateBanner programId="viator" placement={placement} variant="card" dismissible={false} />
      <AffiliateBanner programId="getyourguide" placement={placement} variant="card" dismissible={false} />
      <AffiliateBanner programId="klook" placement={placement} variant="card" dismissible={false} />
    </div>
  );
}

export function PrintfulBanner({ placement }: { placement: string }) {
  return (
    <AffiliateBanner
      programId="printful"
      placement={placement}
      variant="banner"
    />
  );
}
