"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function SourceInspectorPanel() {
  const [sources] = useState([
    {
      title: "AI Response",
      score: 0.92,
      content: "Example source data here...",
    },
  ]);

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-3">
        Source Inspector
      </div>

      <div className="space-y-2 text-xs">
        {sources.map((src, idx) => (
          <div
            key={idx}
            className="p-2 bg-black/40 rounded-xl border border-white/10"
          >
            <div className="font-medium text-purple-300">{src.title}</div>
            <div className="opacity-60">Similarity: {src.score}</div>
            <div className="mt-1 text-white/70 text-[11px] leading-snug">
              {src.content}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
