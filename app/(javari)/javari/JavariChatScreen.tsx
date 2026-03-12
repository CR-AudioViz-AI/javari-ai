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
  // Legacy: data.data.output from old gateway shape
      // ── PATH A: OpenAI Realtime (when connected) ───────────────────────
      // ── PATH B: /api/javari/chat — JavariChatController ───────────────
      // Intent classification, multi-provider routing, team mode all handled server-side.
export default {}
