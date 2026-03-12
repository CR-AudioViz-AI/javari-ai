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
        // Fallback chain as CSS custom property
        // @ts-expect-error -- CSS custom property
        // Safe area bottom padding so content isn't behind home indicator
export default {}
