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
  // Static portrait only — no animation, no voice
  if (!avatarEnabled) {
    return (
      <div className="flex items-center justify-center py-6">
        <img
          src="/javari-portrait.png"
          alt="Javari"
          className="w-32 h-32 rounded-full border border-gray-700 opacity-70"
        />
      </div>
    );
  }

  // CSS class map — speaking gets the animated glow pulse
  const stateClass: Record<string, string> = {
    idle: "",
    listening: "animate-avatarListening",
    thinking: "animate-avatarThinking",
    speaking: "javari-speaking",
    reasoning: "animate-avatarThinking",
    error: "",
  };

  // Glow ring color per state
  const glowColor: Record<string, string> = {
    idle: "rgba(168,85,247,0.15)",
    listening: "rgba(59,130,246,0.45)",
    thinking: "rgba(99,102,241,0.45)",
    speaking: "rgba(93,212,255,0.55)",
    reasoning: "rgba(192,38,211,0.45)",
    error: "rgba(239,68,68,0.4)",
  };

  return (
    <div className="flex items-center justify-center py-6 relative">
      {/* Glow ring */}
      <div
        className="absolute w-48 h-48 rounded-full blur-xl opacity-40 transition-all duration-500"
        style={{ background: glowColor[state] ?? glowColor.idle }}
      />
      <img
        src="/javari-portrait.png"
        alt="Javari AI"
        className={`
          relative w-44 h-auto rounded-full border border-gray-700
          transition-all duration-300 ease-in-out shadow-lg
          ${stateClass[state] ?? ""}
        `}
      />
      {state !== "idle" && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest text-white/40 uppercase">
          {state}
        </span>
      )}
    </div>
  );
}
