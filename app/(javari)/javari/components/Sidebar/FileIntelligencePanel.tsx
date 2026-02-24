"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function FileIntelligencePanel() {
  const [files] = useState([
    {
      name: "example.pdf",
      size: "1.2 MB",
      summary: "Extracted summary will appear here.",
    },
  ]);

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-3">
        File Intelligence
      </div>

      <div className="space-y-2 text-xs">
        {files.map((file, idx) => (
          <div
            key={idx}
            className="p-2 bg-black/40 rounded-xl border border-white/10"
          >
            <div className="font-medium">{file.name}</div>
            <div className="opacity-60">Size: {file.size}</div>

            <div className="mt-2 text-white/70 text-[11px]">
              {file.summary}
            </div>

            <button className="mt-2 text-purple-300 text-[11px] underline">
              Re-run Analysis
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
