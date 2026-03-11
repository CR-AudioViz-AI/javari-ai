"use client";
// app/(javari)/javari/JavariChatScreen.tsx
// Purpose: Javari avatar chat screen — handles user input and response rendering.
// Date: 2026-03-11 — v3.0: ALL messages route through /api/javari/chat (JavariChatController)
//   - Intent classification (chat, plan_task, execute_task, generate_module, query_system)
//   - Single and team modes supported
//   - /api/javari/chat returns { ok, reply, intent, mode, provider, model, costUsd }
//   - Legacy normaliseReply() kept for safety; primary field is `reply`

import { useCallback } from "react";
import { useJavariState }    from "./state/useJavariState";
import { useJavariSettings } from "./state/useJavariSettings";
import MessageFeed from "./components/MessageFeed/MessageFeed";
import ChatInput   from "./components/Input/ChatInput";
import VoiceInput  from "./components/Input/VoiceInput";
import UploadZone  from "./components/Input/UploadZone";
import VoiceOutput from "./components/Input/VoiceOutput";
import type { RealtimeClient } from "@/lib/javari/realtime/realtime-client";

// ── Response normaliser ──────────────────────────────────────────────────────
// /api/javari/chat returns { ok, reply, output, answer, response, ... }
// All aliased at the endpoint — this handles every shape for safety.
function normaliseReply(data: Record<string, unknown>): string {
  if (typeof data.reply    === "string" && data.reply.trim())    return data.reply;
  if (typeof data.output   === "string" && data.output.trim())   return data.output;
  if (typeof data.answer   === "string" && data.answer.trim())   return data.answer;
  if (typeof data.response === "string" && data.response.trim()) return data.response;

  // Legacy: data.data.output from old gateway shape
  const inner = data.data as Record<string, unknown> | undefined;
  if (inner) {
    if (typeof inner.output   === "string" && inner.output.trim())   return inner.output;
    if (typeof inner.answer   === "string" && inner.answer.trim())   return inner.answer;
    if (typeof inner.response === "string" && inner.response.trim()) return inner.response;
    if (Array.isArray(inner.messages)) {
      const asst = (inner.messages as Array<{ role: string; content: string }>)
        .find((m) => m.role === "assistant");
      if (asst?.content) return asst.content;
    }
  }

  if (typeof data.error === "string") return `⚠️ ${data.error}`;
  return "No response received.";
}

export default function JavariChatScreen() {
  const {
    messages,
    addUserMessage,
    beginStreamingMessage,
    appendStreamingDelta,
    finalizeStreamingMessage,
    setStreamingError,
    setStreaming,
    audioUrl,
    setTranscript,
    setPendingSpeech,
  } = useJavariState();

  const { avatarEnabled, voiceEnabled } = useJavariSettings();
  const realtimeEnabled = false;

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      addUserMessage(content);
      setStreaming(true);

      // ── PATH A: OpenAI Realtime (when connected) ───────────────────────
      const rt =
        typeof window !== "undefined"
          ? (
              (window as unknown as Record<string, unknown>)
                .__javariRT__ as RealtimeClient | null
            )
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

      // ── PATH B: /api/javari/chat — JavariChatController ───────────────
      // Intent classification, multi-provider routing, team mode all handled server-side.
      const assistantId = beginStreamingMessage();

      try {
        const res = await fetch("/api/javari/chat", {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            message: content,
            mode   : "single",           // "team" for full build pipeline
            userId : "roy-henderson",
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          setStreamingError(
            assistantId,
            `Javari encountered an API error (${res.status}): ${errText.slice(0, 200)}`
          );
          setStreaming(false);
          return;
        }

        const data = (await res.json()) as Record<string, unknown>;
        const reply = normaliseReply(data);

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
