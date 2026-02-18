"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import JavariAvatar from "../JavariAvatar";
import { AvatarState } from "./AvatarStateMachine";
import { VoiceClient } from "../VoiceClient";
import { RealtimeClient } from "@/lib/javari/realtime/realtime-client";
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
  const { avatarEnabled, voiceEnabled, realtimeEnabled } = useJavariSettings();
  const [avatarState, setAvatarState] = useState<AvatarState>(externalState);
  const voiceClientRef = useRef<VoiceClient | null>(null);
  const realtimeRef = useRef<RealtimeClient | null>(null);

  // ── Init VoiceClient ─────────────────────────────────────────────────────
  useEffect(() => {
    voiceClientRef.current = new VoiceClient((s) => setAvatarState(s));
    return () => {
      voiceClientRef.current?.stop();
    };
  }, []);

  // ── Sync enabled state → VoiceClient ────────────────────────────────────
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

  // ── Sync external state (only when not speaking) ─────────────────────────
  useEffect(() => {
    if (avatarState !== "speaking") {
      setAvatarState(externalState);
    }
  }, [externalState]);

  // ── Init RealtimeClient when realtimeEnabled ──────────────────────────────
  useEffect(() => {
    if (!realtimeEnabled || !avatarEnabled || !voiceEnabled) {
      realtimeRef.current?.stop();
      realtimeRef.current = null;
      return;
    }

    // API key comes from window (injected by layout or env — never exposed to client in prod)
    // For preview builds we gracefully skip if key unavailable
    const apiKey =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, string>).__OPENAI_RT_KEY__ ?? ""
        : "";

    if (!apiKey) {
      console.info("[AvatarContainer] Realtime key not available — using REST fallback");
      return;
    }

    const rt = new RealtimeClient(apiKey, {
      onTextDelta: (chunk) => {
        voiceClientRef.current?.acceptTextChunk(chunk);
      },
      onResponseCompleted: () => {
        // Voice client handles idle transition after audio ends
      },
      onError: (err) => {
        console.error("[Realtime]", err.message);
        setAvatarState("idle");
      },
      onStateChange: (state) => {
        if (state === "connecting") setAvatarState("thinking");
        if (state === "closed" || state === "error") setAvatarState("idle");
      },
    });

    rt.start();
    realtimeRef.current = rt;

    return () => {
      rt.stop();
      realtimeRef.current = null;
    };
  }, [realtimeEnabled, avatarEnabled, voiceEnabled]);

  // ── Pending speech from REST path ─────────────────────────────────────────
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
