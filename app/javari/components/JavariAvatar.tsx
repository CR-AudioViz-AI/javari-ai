"use client";

import { AvatarState } from "./Avatar/AvatarStateMachine";

interface JavariAvatarProps {
  state?: AvatarState;
  avatarEnabled?: boolean;
}

export default function JavariAvatar({
  state = "idle",
  avatarEnabled = true,
}: JavariAvatarProps) {
  // Static portrait — no animation, no voice
  if (!avatarEnabled) {
    return (
      <div className="flex items-center justify-center py-6">
        <img
          src="/javari-portrait.png"
          alt="Javari"
          className="w-44 h-auto rounded-full border border-gray-700 opacity-70"
        />
      </div>
    );
  }

  // Animated avatar — CSS animation class driven by state
  const stateStyles: Record<string, string> = {
    idle: "animate-avatarIdle",
    listening: "animate-avatarListening",
    thinking: "animate-avatarThinking",
    speaking: "animate-avatarSpeaking",
    reasoning: "animate-avatarThinking",
    error: "animate-avatarError",
  };

  const glowColors: Record<string, string> = {
    idle: "shadow-purple-900/30",
    listening: "shadow-blue-500/60",
    thinking: "shadow-indigo-500/60",
    speaking: "shadow-cyan-400/70",
    reasoning: "shadow-fuchsia-500/60",
    error: "shadow-red-500/50",
  };

  return (
    <div className="flex items-center justify-center py-6 relative">
      {/* Glow ring behind portrait */}
      <div
        className={`absolute w-48 h-48 rounded-full blur-xl opacity-40 transition-all duration-500 ${glowColors[state] || glowColors.idle} bg-current`}
      />
      <img
        src="/javari-portrait.png"
        alt="Javari AI"
        className={`
          relative w-44 h-auto rounded-full border border-gray-700
          transition-all duration-300 ease-in-out shadow-lg
          ${stateStyles[state] || stateStyles.idle}
        `}
      />
      {/* State indicator badge */}
      {state !== "idle" && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest text-white/50 uppercase">
          {state}
        </span>
      )}
    </div>
  );
}
