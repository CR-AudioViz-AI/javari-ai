"use client";

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
    setStreaming,
    audioUrl,
    setTranscript,
    setPendingSpeech,
  } = useJavariState();

  const { avatarEnabled, voiceEnabled, realtimeEnabled } = useJavariSettings();

  const handleSend = useCallback(
    async (content: string) => {
      addUserMessage(content);
      setStreaming(true);

      // ── PATH A: OpenAI Realtime (when connected) ────────────────────────
      const rt = typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>).__javariRT__ as RealtimeClient | null
        : null;

      if (realtimeEnabled && rt?.isConnected()) {
        let rtBuf = "";

        rt.onTextDelta = (chunk: string) => {
          rtBuf += chunk;
          // Pipe each chunk to voice for streaming TTS
          if (avatarEnabled && voiceEnabled) {
            setPendingSpeech(chunk);
          }
        };

        rt.onResponseCompleted = (full: string) => {
          addAssistantMessage(full || rtBuf);
          setStreaming(false);
        };

        rt.sendText(content);
        return;
      }

      // ── PATH B: REST fallback ────────────────────────────────────────────
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
          addAssistantMessage(
            "I\'m Javari — something went wrong on my end. Please try again."
          );
          return;
        }

        const data = await res.json();
        const reply =
          data.messages?.find((m: { role: string }) => m.role === "assistant")
            ?.content ??
          data.answer ??
          "No response received.";

        addAssistantMessage(reply);

        if (avatarEnabled && voiceEnabled && reply) {
          setPendingSpeech(reply);
        }
      } catch (err) {
        console.error("[JavariChat] Network error:", err);
        addAssistantMessage(
          "I\'m Javari — I couldn\'t reach my systems. Please check your connection."
        );
      } finally {
        setStreaming(false);
      }
    },
    [
      addUserMessage,
      addAssistantMessage,
      setStreaming,
      avatarEnabled,
      voiceEnabled,
      realtimeEnabled,
      setPendingSpeech,
    ]
  );

  return (
    <div className="flex flex-col h-full">
      <MessageFeed messages={messages} />
      <div className="px-4 pb-3">
        <UploadZone onFiles={() => {}} />
        <VoiceInput onTranscript={setTranscript} />
        <VoiceOutput audioUrl={audioUrl || undefined} />
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
