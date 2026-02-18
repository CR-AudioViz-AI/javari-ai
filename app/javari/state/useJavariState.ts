"use client";

import { create } from "zustand";
import { JavariMessage } from "@/lib/types";

interface JavariState {
  messages: JavariMessage[];
  audioUrl?: string;
  streaming: boolean;
  transcript?: string;
  pendingSpeech: string | null;

  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  setAudioUrl: (url: string) => void;
  setStreaming: (state: boolean) => void;
  setTranscript: (t: string) => void;
  setPendingSpeech: (text: string) => void;
  clearPendingSpeech: () => void;
}

export const useJavariState = create<JavariState>((set) => ({
  messages: [],
  streaming: false,
  pendingSpeech: null,

  addUserMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "user", content },
      ],
    })),

  addAssistantMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "assistant", content },
      ],
    })),

  setAudioUrl: (audioUrl) => set({ audioUrl }),
  setStreaming: (streaming) => set({ streaming }),
  setTranscript: (transcript) => set({ transcript }),
  setPendingSpeech: (text) => set({ pendingSpeech: text }),
  clearPendingSpeech: () => set({ pendingSpeech: null }),
}));
