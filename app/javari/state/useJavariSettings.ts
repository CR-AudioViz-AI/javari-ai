"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface JavariSettings {
  avatarEnabled: boolean;
  voiceEnabled: boolean;
  setAvatarEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

export const useJavariSettings = create<JavariSettings>()(
  persist(
    (set) => ({
      avatarEnabled: true,
      voiceEnabled: true,
      setAvatarEnabled: (avatarEnabled) => set({ avatarEnabled }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
    }),
    { name: "javari-settings" }
  )
);
