// components/credits/CreditBalance.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL CREDIT BALANCE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:15 PM EST
// Henderson Standard - Use across ALL apps
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { Coins, Sparkles, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';

interface CreditBalanceProps {
  userId?: string;
  variant?: 'compact' | 'full' | 'minimal' | 'dashboard';
  showUpgrade?: boolean;
  onLowCredits?: (balance: number) => void;
  lowCreditThreshold?: number;
  className?: string;
}

interface UserCredits {
  balance: number;
  tier: string;
  monthlyCredits: number;
  creditsUsedThisMonth: number;
  neverExpire: boolean;
}

const TIER_COLORS = {
  free: 'from-gray-500 to-gray-600',
  starter: 'from-blue-500 to-blue-600',
  pro: 'from-purple-500 to-indigo-600',
  business: 'from-amber-500 to-orange-600'
};

const TIER_LABELS = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business'
};

export function CreditBalance({
  userId,
  variant = 'compact',
  showUpgrade = true,
  onLowCredits,
  lowCreditThreshold = 10,
  className = ''
}: CreditBalanceProps) {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCredits() {
      try {
        // Try to get user from session first
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const uid = userId || session?.user?.id;
        
        if (!uid) {
          setCredits({
            balance: 0,
            tier: 'free',
            monthlyCredits: 50,
            creditsUsedThisMonth: 0,
            neverExpire: false
          });
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/credits?user_id=${uid}`);
        const data = await res.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        const userCredits: UserCredits = {
          balance: data.current_balance || 0,
          tier: data.subscription_tier || 'free',
          monthlyCredits: data.monthly_credits || 50,
          creditsUsedThisMonth: data.credits_used_this_month || 0,
          neverExpire: data.subscription_tier !== 'free'
        };

        setCredits(userCredits);

        // Trigger low credits callback
        if (userCredits.balance <= lowCreditThreshold && onLowCredits) {
          onLowCredits(userCredits.balance);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load credits');
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, [userId, lowCreditThreshold, onLowCredits]);

  if (loading) {
    return <CreditSkeleton variant={variant} className={className} />;
  }

  if (error) {
    return null; // Silently fail - don't break the app
  }

  if (!credits) {
    return null;
  }

  const isLow = credits.balance <= lowCreditThreshold;
  const tierColor = TIER_COLORS[credits.tier as keyof typeof TIER_COLORS] || TIER_COLORS.free;

  // Minimal variant - just the number
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Coins className={`w-4 h-4 ${isLow ? 'text-red-500' : 'text-yellow-500'}`} />
        <span className={`font-medium ${isLow ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
          {credits.balance.toLocaleString()}
        </span>
      </div>
    );
  }

  // Compact variant - small badge
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${tierColor} text-white text-sm font-medium`}>
          <Coins className="w-4 h-4" />
          <span>{credits.balance.toLocaleString()}</span>
        </div>
        {isLow && showUpgrade && (
          <a 
            href="/pricing" 
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-0.5"
          >
            Low <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Full variant - detailed card
  if (variant === 'full') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-gradient-to-r ${tierColor}`}>
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Credits</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${tierColor} text-white`}>
                {TIER_LABELS[credits.tier as keyof typeof TIER_LABELS] || 'Free'}
              </span>
            </div>
          </div>
          {showUpgrade && credits.tier !== 'business' && (
            <a 
              href="/pricing" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Upgrade <Sparkles className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className={`text-4xl font-bold mb-2 ${isLow ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
          {credits.balance.toLocaleString()}
          <span className="text-lg font-normal text-gray-500 ml-1">credits</span>
        </div>

        {isLow && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm mb-3">
            <AlertTriangle className="w-4 h-4" />
            <span>Low balance! Get more credits to keep creating.</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{credits.monthlyCredits}/mo included</span>
          </div>
          <span className={credits.neverExpire ? 'text-green-600' : 'text-amber-600'}>
            {credits.neverExpire ? '✓ Never expire' : 'Expires monthly'}
          </span>
        </div>
      </div>
    );
  }

  // Dashboard variant - for main dashboard
  if (variant === 'dashboard') {
    const percentUsed = credits.monthlyCredits > 0 
      ? Math.min(100, (credits.creditsUsedThisMonth / credits.monthlyCredits) * 100)
      : 0;

    return (
      <div className={`bg-gradient-to-br ${tierColor} rounded-2xl p-6 text-white ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Credit Balance</h3>
              <span className="text-sm opacity-80">
                {TIER_LABELS[credits.tier as keyof typeof TIER_LABELS]} Plan
              </span>
            </div>
          </div>
          {showUpgrade && credits.tier !== 'business' && (
            <a 
              href="/pricing" 
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              Upgrade
            </a>
          )}
        </div>

        <div className="text-5xl font-bold mb-4">
          {credits.balance.toLocaleString()}
        </div>

        {isLow && (
          <div className="flex items-center gap-2 p-3 bg-red-500/30 rounded-lg mb-4">
            <AlertTriangle className="w-5 h-5" />
            <span>Running low! Top up to keep creating.</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Monthly Usage</span>
            <span>{credits.creditsUsedThisMonth} / {credits.monthlyCredits}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between text-sm">
          <span className="opacity-80">
            {credits.neverExpire ? '✓ Credits never expire' : '⏱ Expires end of month'}
          </span>
          <a href="/credits/history" className="flex items-center gap-1 hover:underline">
            View history <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return null;
}

// Skeleton loader
function CreditSkeleton({ variant, className }: { variant: string; className: string }) {
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`${className}`}>
        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`bg-gray-200 dark:bg-gray-700 rounded-xl h-32 animate-pulse ${className}`} />
  );
}

export default CreditBalance;
