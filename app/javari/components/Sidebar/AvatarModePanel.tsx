"use client";

import { useJavariSettings } from "../../state/useJavariSettings";
import { motion } from "framer-motion";

function Toggle({
  checked,
  onChange,
  label,
  color = "bg-purple-600",
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-white/70">{label}</span>
      <button
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${
          checked ? color : "bg-white/20"
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function AvatarModePanel() {
  const {
    avatarEnabled,
    voiceEnabled,
    realtimeEnabled,
    setAvatarEnabled,
    setVoiceEnabled,
    toggleRealtime,
  } = useJavariSettings();

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-3">
        Avatar Mode
      </div>

      <Toggle
        checked={avatarEnabled}
        onChange={() => setAvatarEnabled(!avatarEnabled)}
        label="Animated Avatar"
        color="bg-purple-600"
      />

      {avatarEnabled && (
        <>
          <Toggle
            checked={voiceEnabled}
            onChange={() => setVoiceEnabled(!voiceEnabled)}
            label="Voice Output"
            color="bg-blue-600"
          />
          <Toggle
            checked={realtimeEnabled}
            onChange={toggleRealtime}
            label="Realtime Mode"
            color="bg-cyan-600"
          />
        </>
      )}

      <div className="mt-2 text-[10px] text-white/30 tracking-wide">
        {!avatarEnabled
          ? "○ STATIC PORTRAIT ONLY"
          : !voiceEnabled
          ? "● ANIMATED / VOICE OFF"
          : realtimeEnabled
          ? "● ANIMATED + VOICE + REALTIME"
          : "● ANIMATED + VOICE (REST)"}
      </div>
    </motion.div>
  );
}
