"use client";
import { useState, useEffect } from "react";
export default function JavariAvatar({ state = "idle" }) {
  const glow =
    state === "listening"
      ? "shadow-[0_0_20px_#4fd1ff]"
      : state === "thinking"
      ? "shadow-[0_0_25px_#7f5cff]"
      : state === "speaking"
      ? "shadow-[0_0_25px_#4cff7a]"
      : "shadow-[0_0_10px_#4fa0ff70]";
  return (
    <div className="flex items-center justify-center py-6">
      <img
        src="/javari-portrait.png"
        alt="Javari Avatar"
        className={`w-40 h-auto rounded-full border border-gray-700 transition-all duration-300 ${glow}`}
      />
    </div>
  );
}
