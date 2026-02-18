"use client";

import { useEffect, useRef, useState } from "react";
import JavariAvatar from "../JavariAvatar";
import { AvatarState } from "./AvatarStateMachine";
import { VoiceClient } from "../VoiceClient";
import { useJavariSettings } from "../../state/useJavariSettings";

interface AvatarContainerProps {
  state?: AvatarState;
  pendingSpeech?: string | null;
  onSpeechComplete?: () => void;
}

export default function AvatarContainer({
  state: externalState = "idle",
  pendingSpeech,
  onSpeechComplete,
}: AvatarContainerProps) {
  const { avatarEnabled, voiceEnabled } = useJavariSettings();
  const [avatarState, setAvatarState] = useState<AvatarState>(externalState);
  const voiceClientRef = useRef<VoiceClient | null>(null);

  // Initialize VoiceClient once
  useEffect(() => {
    voiceClientRef.current = new VoiceClient((s) => setAvatarState(s));
    return () => {
      voiceClientRef.current?.stop();
    };
  }, []);

  // Sync enabled state
  useEffect(() => {
    const vc = voiceClientRef.current;
    if (!vc) return;
    if (avatarEnabled && voiceEnabled) {
      vc.enable();
    } else {
      vc.disable();
      setAvatarState("idle");
    }
  }, [avatarEnabled, voiceEnabled]);

  // Sync external state when not speaking
  useEffect(() => {
    if (avatarState !== "speaking") {
      setAvatarState(externalState);
    }
  }, [externalState]);

  // Handle new speech from assistant
  useEffect(() => {
    if (!pendingSpeech || !avatarEnabled || !voiceEnabled) return;
    const vc = voiceClientRef.current;
    if (!vc) return;

    vc.speak(pendingSpeech).then(() => {
      onSpeechComplete?.();
    });
  }, [pendingSpeech]);

  return (
    <div className="p-4 flex justify-center items-center bg-black/40 border-b border-white/10">
      <JavariAvatar state={avatarState} avatarEnabled={avatarEnabled} />
    </div>
  );
}
