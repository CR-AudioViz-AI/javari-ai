"use client";
// components/LaunchAnnouncement.tsx
// CR AudioViz AI — Launch Announcement Banner
// 2026-02-21 — STEP 9 Official Launch
//
// Reads from launch/config.ts. Shows dynamic messages by phase.
// Dismissible — persists preference in localStorage.

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Rocket, Sparkles, AlertTriangle, Wrench } from "lucide-react";
import type { LaunchPhase } from "@/lib/launch/config";

interface AnnouncementConfig {
  phase:            LaunchPhase;
  maintenance:      boolean;
  degraded:         boolean;
  announcementText: string | null;
}

const DISMISS_KEY = "cr_announcement_dismissed_v9";

// ── Phase content ─────────────────────────────────────────────────────────────

function getContent(config: AnnouncementConfig): {
  icon:    React.ReactNode;
  message: string;
  cta?:    { label: string; href: string };
  bg:      string;
} | null {
  if (config.maintenance) {
    return {
      icon:    <Wrench className="w-4 h-4 shrink-0" />,
      message: "🔧 CRAudioVizAI is currently in maintenance mode. We'll be back shortly.",
      bg:      "bg-amber-900/80 border-b border-amber-700/50",
    };
  }

  if (config.degraded) {
    return {
      icon:    <AlertTriangle className="w-4 h-4 shrink-0" />,
      message: "⚠️ Some AI providers are experiencing issues. We're routing to backup models.",
      bg:      "bg-orange-900/80 border-b border-orange-700/50",
    };
  }

  if (config.phase === "public" && config.announcementText) {
    return {
      icon:    <Rocket className="w-4 h-4 shrink-0" />,
      message: config.announcementText,
      cta:     { label: "What's New →", href: "/changelog" },
      bg:      "bg-blue-600 border-b border-blue-500",
    };
  }

  if (config.phase === "beta") {
    return {
      icon:    <Sparkles className="w-4 h-4 shrink-0" />,
      message: "🚀 You're in the CRAudioVizAI beta. Your feedback shapes the platform.",
      cta:     { label: "Join waitlist →", href: "/beta" },
      bg:      "bg-violet-800/90 border-b border-violet-700/50",
    };
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LaunchAnnouncementProps {
  config?: AnnouncementConfig;
}

export function LaunchAnnouncement({ config }: LaunchAnnouncementProps) {
  const [dismissed, setDismissed] = useState(true); // Start hidden; show after hydration
  const [hydrated,  setHydrated]  = useState(false);

  const effectiveConfig: AnnouncementConfig = config ?? {
    phase:           "public",
    maintenance:     false,
    degraded:        false,
    announcementText: "🎉 CRAudioVizAI is officially live! Welcome to the future of creative AI.",
  };

  useEffect(() => {
    setHydrated(true);
    const wasDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    // Always show maintenance/degraded banners; respect dismiss for announcements
    if (effectiveConfig.maintenance || effectiveConfig.degraded) {
      setDismissed(false);
    } else {
      setDismissed(wasDismissed);
    }
  }, [effectiveConfig.maintenance, effectiveConfig.degraded]);

  const content = getContent(effectiveConfig);

  if (!hydrated || !content || dismissed) return null;

  return (
    <div className={`relative flex items-center justify-center gap-3 px-4 py-2.5
                     text-sm text-white ${content.bg} z-50`}>
      {content.icon}
      <span className="flex-1 text-center">{content.message}</span>
      {content.cta && (
        <Link href={content.cta.href}
              className="font-semibold underline hover:no-underline whitespace-nowrap shrink-0">
          {content.cta.label}
        </Link>
      )}
      {/* Only show dismiss for non-critical banners */}
      {!effectiveConfig.maintenance && !effectiveConfig.degraded && (
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(DISMISS_KEY, "1");
          }}
          aria-label="Dismiss announcement"
          className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default LaunchAnnouncement;
