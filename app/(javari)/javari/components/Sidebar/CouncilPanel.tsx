"use client";

import { motion } from "framer-motion";

const council = [
  { name: "Claude", active: true },
  { name: "GPT", active: true },
  { name: "Llama", active: false },
  { name: "Grok", active: false },
  { name: "Mistral", active: true },
  { name: "Gemini", active: false },
];

export default function CouncilPanel() {
  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-2">
        AI Council
      </div>

      <div className="space-y-1 text-xs">
        {council.map((m) => (
          <div
            key={m.name}
            className={`flex justify-between ${
              m.active ? "text-green-300" : "text-white/40"
            }`}
          >
            <span>{m.name}</span>
            <span>{m.active ? "● active" : "○ idle"}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
