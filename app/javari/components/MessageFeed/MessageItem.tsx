"use client";
// app/javari/components/MessageFeed/MessageItem.tsx
// 2026-02-20 — STEP 0 repair:
//   - Fixed avatar path: /avatars/javari-default.png (confirmed exists in public/avatars/)
//   - Null-safe content rendering — handles undefined/null gracefully
//   - Streaming indicator: pulse animation when message.streaming === true
//   - No hydration issues — no conditional server/client rendering

import { JavariMessage } from "@/lib/types";
import MessageTimestamp from "./MessageTimestamp";
import { motion } from "framer-motion";
import Image from "next/image";

export default function MessageItem({ message }: { message: JavariMessage }) {
  const isAssistant = message.role === "assistant";
  const content = message.content ?? "";
  const isStreaming = message.streaming === true;

  const bubbleBase =
    "relative px-5 py-4 rounded-xl max-w-[78%] backdrop-blur-md border border-white/10 shadow-lg";

  const assistantStyle =
    "bg-gradient-to-br from-purple-600/20 to-blue-600/10 text-purple-200 border-purple-500/20 shadow-purple-500/20";

  const userStyle =
    "bg-gradient-to-br from-slate-800/60 to-slate-900/40 text-slate-200 border-slate-600/30";

  return (
    <div className={`w-full flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {/* Javari avatar — only for assistant messages */}
      {isAssistant && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30">
            <Image
              src="/avatars/javari-default.png"
              alt="Javari"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              // Suppress hydration on img — avatar src is stable
            />
          </div>
        </div>
      )}

      <motion.div
        className={`${bubbleBase} ${isAssistant ? assistantStyle : userStyle}`}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {/* Message content — null-safe, handles streaming empty content */}
        <div className="whitespace-pre-wrap leading-relaxed break-words">
          {content || (isStreaming ? "" : "…")}
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-purple-400 animate-pulse rounded-sm align-middle" />
          )}
        </div>

        {/* Voice transcript badge */}
        {message.metadata?.audio?.transcript && (
          <div className="mt-2 text-xs text-blue-300 opacity-70">
            🎤 &ldquo;{message.metadata.audio.transcript}&rdquo;
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-3 flex justify-end opacity-50">
          <MessageTimestamp />
        </div>
      </motion.div>
    </div>
  );
}
