"use client";
// app/javari/state/useJavariState.ts
// 2026-02-20 — STEP 0 repair:
//   - useReducer architecture replaces ad-hoc setState calls
//   - crypto.randomUUID() for stable, collision-free IDs
//   - streaming delta support (appendToAssistant action)
//   - zero re-render loops — all state transitions are pure functions
//   - JavariMessage imported from canonical lib/types

import { useReducer, useCallback } from "react";
import type { JavariMessage } from "@/lib/types";

// ── State shape ───────────────────────────────────────────────────────────────

interface JavariChatState {
  messages: JavariMessage[];
  streaming: boolean;
  audioUrl?: string;
  transcript?: string;
  pendingSpeech: string | null;
  // ID of the in-progress assistant message (streaming target)
  streamingId: string | null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_USER"; id: string; content: string }
  | { type: "ADD_ASSISTANT_PLACEHOLDER"; id: string }
  | { type: "APPEND_ASSISTANT_DELTA"; id: string; delta: string }
  | { type: "FINALIZE_ASSISTANT"; id: string; content: string }
  | { type: "ADD_ASSISTANT"; id: string; content: string }
  | { type: "ERROR_ASSISTANT"; id: string; error: string }
  | { type: "SET_STREAMING"; streaming: boolean }
  | { type: "SET_AUDIO_URL"; url: string }
  | { type: "SET_TRANSCRIPT"; transcript: string }
  | { type: "SET_PENDING_SPEECH"; text: string }
  | { type: "CLEAR_PENDING_SPEECH" }
  | { type: "CLEAR_MESSAGES" };

// ── Pure reducer ──────────────────────────────────────────────────────────────

function reducer(state: JavariChatState, action: Action): JavariChatState {
  switch (action.type) {
    case "ADD_USER":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, role: "user", content: action.content },
        ],
      };

    case "ADD_ASSISTANT_PLACEHOLDER":
      return {
        ...state,
        streaming: true,
        streamingId: action.id,
        messages: [
          ...state.messages,
          { id: action.id, role: "assistant", content: "", streaming: true },
        ],
      };

    case "APPEND_ASSISTANT_DELTA": {
      // Find the streaming message and append delta to it
      const updated = state.messages.map((m) =>
        m.id === action.id
          ? { ...m, content: m.content + action.delta }
          : m
      );
      return { ...state, messages: updated };
    }

    case "FINALIZE_ASSISTANT": {
      const finalized = state.messages.map((m) =>
        m.id === action.id
          ? { ...m, content: action.content, streaming: false }
          : m
      );
      return { ...state, messages: finalized, streaming: false, streamingId: null };
    }

    case "ADD_ASSISTANT":
      return {
        ...state,
        streaming: false,
        streamingId: null,
        messages: [
          ...state.messages,
          { id: action.id, role: "assistant", content: action.content },
        ],
      };

    case "ERROR_ASSISTANT": {
      // Replace placeholder or append error message
      const withError = state.messages.map((m) =>
        m.id === action.id
          ? { ...m, content: action.error, streaming: false }
          : m
      );
      // If message not found, append it
      const found = withError.some((m) => m.id === action.id);
      return {
        ...state,
        streaming: false,
        streamingId: null,
        messages: found
          ? withError
          : [...state.messages, { id: action.id, role: "assistant", content: action.error }],
      };
    }

    case "SET_STREAMING":
      return { ...state, streaming: action.streaming };

    case "SET_AUDIO_URL":
      return { ...state, audioUrl: action.url };

    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.transcript };

    case "SET_PENDING_SPEECH":
      return { ...state, pendingSpeech: action.text };

    case "CLEAR_PENDING_SPEECH":
      return { ...state, pendingSpeech: null };

    case "CLEAR_MESSAGES":
      return { ...state, messages: [], streamingId: null, streaming: false };

    default:
      return state;
  }
}

const INITIAL_STATE: JavariChatState = {
  messages: [],
  streaming: false,
  pendingSpeech: null,
  streamingId: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useJavariState() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Message actions ─────────────────────────────────────────────────────
  const addUserMessage = useCallback((content: string) => {
    dispatch({ type: "ADD_USER", id: crypto.randomUUID(), content });
  }, []);

  const addAssistantMessage = useCallback((content: string) => {
    dispatch({ type: "ADD_ASSISTANT", id: crypto.randomUUID(), content });
  }, []);

  // Streaming: create placeholder → stream deltas → finalize
  const beginStreamingMessage = useCallback((): string => {
    const id = crypto.randomUUID();
    dispatch({ type: "ADD_ASSISTANT_PLACEHOLDER", id });
    return id;
  }, []);

  const appendStreamingDelta = useCallback((id: string, delta: string) => {
    dispatch({ type: "APPEND_ASSISTANT_DELTA", id, delta });
  }, []);

  const finalizeStreamingMessage = useCallback((id: string, content: string) => {
    dispatch({ type: "FINALIZE_ASSISTANT", id, content });
  }, []);

  const setStreamingError = useCallback((id: string, error: string) => {
    dispatch({ type: "ERROR_ASSISTANT", id, error });
  }, []);

  // ── Legacy-compatible helpers ──────────────────────────────────────────
  const setStreaming = useCallback((streaming: boolean) => {
    dispatch({ type: "SET_STREAMING", streaming });
  }, []);

  const setAudioUrl = useCallback((url: string) => {
    dispatch({ type: "SET_AUDIO_URL", url });
  }, []);

  const setTranscript = useCallback((transcript: string) => {
    dispatch({ type: "SET_TRANSCRIPT", transcript });
  }, []);

  const setPendingSpeech = useCallback((text: string) => {
    dispatch({ type: "SET_PENDING_SPEECH", text });
  }, []);

  const clearPendingSpeech = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING_SPEECH" });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
  }, []);

  return {
    // State
    messages: state.messages,
    streaming: state.streaming,
    streamingId: state.streamingId,
    audioUrl: state.audioUrl,
    transcript: state.transcript,
    pendingSpeech: state.pendingSpeech,
    // Actions
    addUserMessage,
    addAssistantMessage,
    beginStreamingMessage,
    appendStreamingDelta,
    finalizeStreamingMessage,
    setStreamingError,
    setStreaming,
    setAudioUrl,
    setTranscript,
    setPendingSpeech,
    clearPendingSpeech,
    clearMessages,
  };
}
