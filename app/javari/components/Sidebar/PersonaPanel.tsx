"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const modes = [
  "Neutral Analyst",
  "Executive",
  "Teacher",
  "Creator",
  "Developer",
  "Friendly",
  "Strategist",
  "Compliance Mode",
];

export default function PersonaPanel() {
  const [active, setActive] = useState("Neutral Analyst");

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-2">
        Persona
      </div>

      <div className="space-y-1 text-xs">
        {modes.map((mode) => (
          <button
            key={mode}
            onClick={() => setActive(mode)}
            className={`w-full text-left px-2 py-1 rounded ${
              active === mode
                ? "bg-purple-600/30 text-purple-200"
                : "text-white/60 hover:bg-white/5"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
