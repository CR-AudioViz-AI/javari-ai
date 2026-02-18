"use client";

import { useJavariSettings } from "../../state/useJavariSettings";
import { motion } from "framer-motion";

export default function AvatarModePanel() {
  const { avatarEnabled, voiceEnabled, setAvatarEnabled, setVoiceEnabled } =
    useJavariSettings();

  return (
    <motion.div
      className="p-4 border-b border-white/10 text-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-sm font-semibold text-purple-300 mb-3">
        Avatar Mode
      </div>

      {/* Avatar toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/70">Animated Avatar</span>
        <button
          onClick={() => setAvatarEnabled(!avatarEnabled)}
          className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${
            avatarEnabled ? "bg-purple-600" : "bg-white/20"
          }`}
          aria-label={avatarEnabled ? "Disable avatar" : "Enable avatar"}
          role="switch"
          aria-checked={avatarEnabled}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
              avatarEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Voice toggle — only shown when avatar is on */}
      {avatarEnabled && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">Voice Output</span>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none ${
              voiceEnabled ? "bg-blue-600" : "bg-white/20"
            }`}
            aria-label={voiceEnabled ? "Disable voice" : "Enable voice"}
            role="switch"
            aria-checked={voiceEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
                voiceEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

      <div className="mt-2 text-[10px] text-white/30 tracking-wide">
        {avatarEnabled
          ? voiceEnabled
            ? "● ANIMATED + VOICE ACTIVE"
            : "● ANIMATED / VOICE OFF"
          : "○ STATIC PORTRAIT ONLY"}
      </div>
    </motion.div>
  );
}
