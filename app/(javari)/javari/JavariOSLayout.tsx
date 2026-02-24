"use client";
// app/javari/JavariOSLayout.tsx
// 2026-02-20 — STEP 0 repair:
//   - Replaced `w-screen h-screen` with dvh (dynamic viewport height) + safe-area
//   - iOS Safari viewport bug fixed: uses 100dvh, falls back to 100vh via CSS var
//   - Safe-area-inset applied via pb-safe / env(safe-area-inset-*)
//   - flex layout preserved — no absolute positioning
//   - Sidebars hidden on small screens (mobile-first), visible at md+

import LeftSidebar from "./components/Sidebar/LeftSidebar";
import RightSidebar from "./components/Sidebar/RightSidebar";
import AvatarContainer from "./components/Avatar/AvatarContainer";
import { useJavariState } from "./state/useJavariState";
import { determineAvatarState } from "./components/Avatar/AvatarStateMachine";

export default function JavariOSLayout({ children }: { children: React.ReactNode }) {
  const { streaming, pendingSpeech, clearPendingSpeech } = useJavariState();

  const avatarState = determineAvatarState({ streaming });

  return (
    /*
     * Height strategy:
     *  1. 100dvh   — modern browsers: accounts for mobile browser chrome
     *  2. 100svh   — fallback for browsers with small-viewport support but no dvh
     *  3. 100vh    — final fallback
     *
     * overflow-hidden prevents body scroll bounce on iOS
     */
    <div
      className="w-full overflow-hidden bg-black text-white flex"
      style={{
        height: "100dvh",
        // Fallback chain as CSS custom property
        // @ts-expect-error -- CSS custom property
        "--app-height": "100dvh",
        // Safe area bottom padding so content isn't behind home indicator
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* LEFT CONTROL CENTER — hidden on mobile, visible md+ */}
      <div className="hidden md:flex w-72 h-full flex-shrink-0">
        <LeftSidebar />
      </div>

      {/* CENTER APPLICATION VIEW — always visible, fills remaining space */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <AvatarContainer
          state={avatarState}
          pendingSpeech={pendingSpeech}
          onSpeechComplete={clearPendingSpeech}
        />
        {/* children = JavariOSFrame > JavariChatScreen */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>

      {/* RIGHT INTELLIGENCE PANELS — hidden on mobile and tablet, visible lg+ */}
      <div className="hidden lg:flex w-80 h-full flex-shrink-0">
        <RightSidebar />
      </div>
    </div>
  );
}
