"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function ChatInput({ onSend }: { onSend: (msg: string) => void }) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className="border-t border-white/10 p-4 bg-black/60 backdrop-blur-xl flex items-center gap-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Type or speak to Javari…"
        className="flex-1 bg-black/40 text-white border border-white/10 rounded-xl p-3 resize-none outline-none focus:border-purple-400/40 transition-all"
      />

      <motion.button
        onClick={handleSend}
        whileTap={{ scale: 0.9 }}
        className="px-4 py-2 rounded-xl bg-gradient-to-br from-purple-600/60 to-blue-600/60 text-white font-medium border border-purple-400/30 shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
      >
        Send
      </motion.button>
    </div>
  );
}
