"use client";
// app/(javari)/javari/JavariChatScreen.tsx
// Purpose: Javari avatar chat screen — handles user input, command classification,
//          and response rendering.
// Date: 2026-03-07 — v2.0: route ALL messages through /api/javari/execute.
//   - classifyCommand() converts natural language to structured command payloads
//   - normaliseReply() reads reply field from execute response shape
//   - Removed broken /api/javari/chat call (that route requires userId + message,
//     returns { ok, data: result } — incompatible with avatar screen expectations)

import { useCallback } from "react";
import { useJavariState } from "./state/useJavariState";
import { useJavariSettings } from "./state/useJavariSettings";
import MessageFeed from "./components/MessageFeed/MessageFeed";
import ChatInput from "./components/Input/ChatInput";
import VoiceInput from "./components/Input/VoiceInput";
import UploadZone from "./components/Input/UploadZone";
import VoiceOutput from "./components/Input/VoiceOutput";
import type { RealtimeClient } from "@/lib/javari/realtime/realtime-client";

// ── Command classifier ──────────────────────────────────────────────────────
// Maps natural language → structured /api/javari/execute payload.
// Returns null when the input is plain conversation (not a command).
function classifyCommand(
  text: string
): { mode: "command"; command: string } | null {
  const t = text.toLowerCase().trim();

  if (t.includes("run next") || t.includes("next task") || t.includes("run task"))
    return { mode: "command", command: "run_next_task" };

  if (
    t.includes("start roadmap") ||
    t.includes("begin roadmap") ||
    t.includes("execute roadmap")
  )
    return { mode: "command", command: "start_roadmap" };

  if (
    t.includes("pause") &&
    (t.includes("execut") || t.includes("roadmap") || t.includes("queue"))
  )
    return { mode: "command", command: "pause_execution" };

  if (
    t.includes("resume") &&
    (t.includes("execut") || t.includes("roadmap") || t.includes("queue"))
  )
    return { mode: "command", command: "resume_execution" };

  if (t.includes("memory") || t.includes("memoryos") || t.includes("knowledge"))
    return { mode: "command", command: "memory_status" };

  if (t.includes("queue") || t.includes("queue status") || t.includes("task status"))
    return { mode: "command", command: "queue_status" };

  return null; // plain chat
}

// ── Response normaliser ─────────────────────────────────────────────────────
// /api/javari/execute returns { ok, mode, reply, model, cost, ... }
// Handles every possible field that could carry the assistant text.
function normaliseReply(data: Record<string, unknown>): string {
  if (typeof data.reply === "string" && data.reply.trim())
    return data.reply;

  // Fallback: data.data.output (gateway result object)
  const inner = data.data as Record<string, unknown> | undefined;
  if (inner) {
    if (typeof inner.output === "string" && inner.output.trim())
      return inner.output;
    if (typeof inner.answer === "string" && inner.answer.trim())
      return inner.answer;
    if (typeof inner.response === "string" && inner.response.trim())
      return inner.response;
    // Last resort: messages array from older chat routes
    if (Array.isArray(inner.messages)) {
      const asst = (
        inner.messages as Array<{ role: string; content: string }>
      ).find((m) => m.role === "assistant");
      if (asst?.content) return asst.content;
    }
  }

  if (typeof data.answer === "string" && data.answer.trim()) return data.answer;
  if (typeof data.response === "string" && data.response.trim()) return data.response;
  if (typeof data.output === "string" && data.output.trim()) return data.output;
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

      // ── PATH B: /api/javari/execute — commands + chat ──────────────────
      const assistantId = beginStreamingMessage();

      try {
        // Classify: is this a system command or plain chat?
        const classified = classifyCommand(content);

        const payload: Record<string, unknown> = classified
          ? {
              // Structured command — { mode:"command", command:"memory_status" }
              ...classified,
              userId: "system",
            }
          : {
              // Plain conversation
              mode   : "chat",
              message: content,
              userId : "roy-henderson",
            };

        const res = await fetch("/api/javari/execute", {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify(payload),
        });

        if (!res.ok) {
          // HTTP error — surface status in message rather than generic error
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          setStreamingError(
            assistantId,
            `Javari encountered an API error (${res.status}): ${errText.slice(0, 200)}`
          );
          setStreaming(false);
          return;
        }

        const data = (await res.json()) as Record<string, unknown>;

        // Extract reply using normaliser — handles every known response shape
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
