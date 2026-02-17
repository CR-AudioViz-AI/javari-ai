"use client";

import { JavariMessage } from "@/lib/types";
import MessageTimestamp from "./MessageTimestamp";
import { motion } from "framer-motion";

export default function MessageItem({ message }: { message: JavariMessage }) {
  const isAssistant = message.role === "assistant";

  const bubbleClasses =
    "relative px-5 py-4 rounded-xl max-w-[78%] backdrop-blur-md border border-white/10 shadow-lg";

  const assistantStyle =
    "bg-gradient-to-br from-purple-600/20 to-blue-600/10 text-purple-200 border-purple-500/20 shadow-purple-500/20";

  const userStyle =
    "bg-gradient-to-br from-slate-800/60 to-slate-900/40 text-slate-200 border-slate-600/30";

  return (
    <div className={`w-full flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <motion.div
        className={`${bubbleClasses} ${
          isAssistant ? assistantStyle : userStyle
        }`}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {/* STREAMING CONTENT HERE */}
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>

        {message.metadata?.audio?.transcript && (
          <div className="mt-2 text-xs text-blue-300 opacity-70">
            🎤 "{message.metadata.audio.transcript}"
          </div>
        )}

        <div className="mt-3 flex justify-end opacity-50">
          <MessageTimestamp />
        </div>
      </motion.div>
    </div>
  );
}
