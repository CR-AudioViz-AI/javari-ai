"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AvatarState } from "./AvatarStateMachine";

export default function AvatarEngine({ state }: { state: AvatarState }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (state === "speaking" || state === "listening") {
      setPulse(true);
    } else {
      setPulse(false);
    }
  }, [state]);

  const colorMap = {
    idle: "from-slate-700/40 to-slate-800/40",
    listening: "from-blue-500/30 to-purple-600/30",
    thinking: "from-purple-500/30 to-indigo-500/30",
    reasoning: "from-purple-600/40 to-fuchsia-500/30",
    speaking: "from-blue-500/40 to-cyan-500/40",
  };

  return (
    <motion.div
      className={`
        relative w-32 h-32 rounded-full mx-auto my-4 
        bg-gradient-to-br ${colorMap[state]}
        shadow-xl backdrop-blur-xl border border-white/10
      `}
      animate={{
        scale: pulse ? [1, 1.06, 1] : 1,
        boxShadow: pulse
          ? "0px 0px 22px rgba(120,60,255,0.55)"
          : "0px 0px 12px rgba(255,255,255,0.1)",
      }}
      transition={{ duration: 1.5, repeat: pulse ? Infinity : 0 }}
    >
      {/* Neon Circuit Glow Ring */}
      <motion.div
        className="
          absolute inset-0 rounded-full border-2 border-purple-400/20
          mix-blend-screen
        "
        animate={{
          opacity: pulse ? [0.35, 0.75, 0.35] : 0.2,
        }}
        transition={{
          duration: 2.2,
          repeat: pulse ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      {/* Avatar silhouette / image goes here later */}
      <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-60">
        ✦
      </div>
    </motion.div>
  );
}
