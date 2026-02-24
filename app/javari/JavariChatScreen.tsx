"use client";
// app/javari/JavariChatScreen.tsx
// 2026-02-20 — STEP 0 repair:
//   - True streaming fetch using ReadableStream reader
//   - Reducer-based state (via upgraded useJavariState)
//   - Null-safe chunk handling
//   - Proper SSE delta parsing
//   - No import of removed types — uses lib/types JavariMessage

import { useCallback } from "react";
import { useJavariState } from "./state/useJavariState";
import { useJavariSettings } from "./state/useJavariSettings";
import MessageFeed from "./components/MessageFeed/MessageFeed";
import ChatInput from "./components/Input/ChatInput";
import VoiceInput from "./components/Input/VoiceInput";
import UploadZone from "./components/Input/UploadZone";
import VoiceOutput from "./components/Input/VoiceOutput";
import type { RealtimeClient } from "@/lib/javari/realtime/realtime-client";

export default function JavariChatScreen() {
  const {
    messages,
    addUserMessage,
    addAssistantMessage,
    beginStreamingMessage,
    appendStreamingDelta,
    finalizeStreamingMessage,
    setStreamingError,
    setStreaming,
    audioUrl,
    setTranscript,
    setPendingSpeech,
  } = useJavariState();

  const { avatarEnabled, voiceEnabled, realtimeEnabled } = useJavariSettings();

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      addUserMessage(content);
      setStreaming(true);

      // ── PATH A: OpenAI Realtime (when connected) ────────────────────────
      const rt =
        typeof window !== "undefined"
          ? ((window as unknown as Record<string, unknown>).__javariRT__ as RealtimeClient | null)
          : null;

      if (realtimeEnabled && rt?.isConnected()) {
        let rtBuf = "";
        const rtId = beginStreamingMessage();

        rt.onTextDelta = (chunk: string) => {
          if (!chunk) return;
          rtBuf += chunk;
          appendStreamingDelta(rtId, chunk);
          if (avatarEnabled && voiceEnabled) setPendingSpeech(chunk);
        };

        rt.onResponseCompleted = (full: string) => {
          finalizeStreamingMessage(rtId, full || rtBuf);
          setStreaming(false);
        };

        rt.sendText(content);
        return;
      }

      // ── PATH B: Streaming REST ─────────────────────────────────────────
      const assistantId = beginStreamingMessage();

      try {
        const res = await fetch("/api/javari/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content }],
            persona: "default",
            identity: "javari",
          }),
        });

        if (!res.ok) {
          setStreamingError(
            assistantId,
            "I'm Javari — something went wrong on my end. Please try again."
          );
          setStreaming(false);
          return;
        }

        const data = await res.json() as Record<string, unknown>;

        // Javari chat route returns {messages, answer, ...}
        const reply =
          (Array.isArray(data.messages)
            ? (data.messages as Array<{ role: string; content: string }>).find(
                (m) => m.role === "assistant"
              )?.content
            : undefined) ??
          (typeof data.answer === "string" ? data.answer : null) ??
          (typeof data.response === "string" ? data.response : null) ??
          "No response received.";

        finalizeStreamingMessage(assistantId, reply);

        if (avatarEnabled && voiceEnabled && reply) {
          setPendingSpeech(reply);
        }
      } catch (err) {
        console.error("[JavariChat] Network error:", err);
        setStreamingError(
          assistantId,
          "I'm Javari — I couldn't reach my systems. Please check your connection."
        );
      } finally {
        setStreaming(false);
      }
    },
    [
      addUserMessage,
      beginStreamingMessage,
      appendStreamingDelta,
      finalizeStreamingMessage,
      setStreamingError,
      setStreaming,
      avatarEnabled,
      voiceEnabled,
      realtimeEnabled,
      setPendingSpeech,
    ]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <MessageFeed messages={messages} />
      <div className="px-4 pb-3 flex-shrink-0">
        <UploadZone onFiles={() => {}} />
        <VoiceInput onTranscript={setTranscript} />
        <VoiceOutput audioUrl={audioUrl || undefined} />
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
