"use client";
import { useState, useEffect } from "react";
export default function JavariAvatar({ state = "idle" }) {
  const stateStyles = {
    idle: "animate-avatarIdle",
    listening: "animate-avatarListening",
    thinking: "animate-avatarThinking",
    speaking: "animate-avatarSpeaking",
    error: "animate-avatarError"
  };

  return (
    <div className="flex items-center justify-center py-6">
      <img
        src="/javari-portrait.png"
        alt="Javari Avatar"
        className={`
          w-44 h-auto rounded-full border border-gray-700 
          transition-all duration-300 ease-in-out
          ${stateStyles[state] || stateStyles.idle}
        `}
      />
    </div>
  );
}
