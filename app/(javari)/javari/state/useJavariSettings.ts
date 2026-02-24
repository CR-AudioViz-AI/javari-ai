"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface JavariSettings {
  avatarEnabled: boolean;
  voiceEnabled: boolean;
  realtimeEnabled: boolean;
  setAvatarEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  toggleRealtime: () => void;
}

export const useJavariSettings = create<JavariSettings>()(
  persist(
    (set) => ({
      avatarEnabled: true,
      voiceEnabled: true,
      realtimeEnabled: true,
      setAvatarEnabled: (avatarEnabled) => set({ avatarEnabled }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      toggleRealtime: () =>
        set((s) => ({ realtimeEnabled: !s.realtimeEnabled })),
    }),
    { name: "javari-settings" }
  )
);
