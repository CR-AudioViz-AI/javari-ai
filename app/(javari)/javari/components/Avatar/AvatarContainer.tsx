"use client";

import { useEffect, useRef, useState } from "react";
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
  const [rtStatus, setRtStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const voiceClientRef = useRef<VoiceClient | null>(null);
  const realtimeRef = useRef<RealtimeClient | null>(null);

  // ── Init VoiceClient once ────────────────────────────────────────────────
  useEffect(() => {
    voiceClientRef.current = new VoiceClient((s) => setAvatarState(s));
    return () => {
      voiceClientRef.current?.stop();
    };
  }, []);

  // ── Sync VoiceClient enabled state ───────────────────────────────────────
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

  // ── Sync external state when not actively speaking ───────────────────────
  useEffect(() => {
    if (avatarState !== "speaking") {
      setAvatarState(externalState);
    }
  }, [externalState]);

  // ── Fetch ephemeral key + boot RealtimeClient ────────────────────────────
  useEffect(() => {
    if (!realtimeEnabled || !avatarEnabled || !voiceEnabled) {
      realtimeRef.current?.stop();
      realtimeRef.current = null;
      setRtStatus("idle");
      return;
    }

    let cancelled = false;

    async function initRealtime() {
      setRtStatus("connecting");

      let rtKey: string | null = null;

      try {
        const res = await fetch("/api/javari/realtime-key");
        if (res.ok) {
          const data = await res.json();
          rtKey = data.client_secret ?? null;
        } else {
          console.warn("[AvatarContainer] realtime-key fetch failed:", res.status, "→ REST fallback");
        }
      } catch (err) {
        console.warn("[AvatarContainer] realtime-key network error:", err, "→ REST fallback");
      }

      if (!rtKey || cancelled) {
        setRtStatus("error");
        return;
      }

      const rt = new RealtimeClient(rtKey, {
        onTextDelta: (chunk) => {
          // Signal avatar thinking → speaking as chunks arrive
          setAvatarState("thinking");
          voiceClientRef.current?.acceptTextChunk(chunk);
        },
        onResponseCompleted: () => {
          // VoiceClient handles idle after audio finishes
        },
        onError: (err) => {
          console.error("[Realtime]", err.message);
          setAvatarState("idle");
          setRtStatus("error");
        },
        onStateChange: (state) => {
          if (state === "connecting") {
            setAvatarState("thinking");
            setRtStatus("connecting");
          } else if (state === "ready") {
            setAvatarState("idle");
            setRtStatus("ready");
            // Expose ref for JavariChatScreen
            (window as unknown as Record<string, unknown>).__javariRT__ = rt;
          } else if (state === "closed" || state === "error") {
            setAvatarState("idle");
            setRtStatus(state === "error" ? "error" : "idle");
            (window as unknown as Record<string, unknown>).__javariRT__ = null;
          }
        },
      });

      rt.start();
      realtimeRef.current = rt;
    }

    initRealtime();

    return () => {
      cancelled = true;
      realtimeRef.current?.stop();
      realtimeRef.current = null;
      (window as unknown as Record<string, unknown>).__javariRT__ = null;
    };
  }, [realtimeEnabled, avatarEnabled, voiceEnabled]);

  // ── Pending speech from REST path (fallback) ─────────────────────────────
  useEffect(() => {
    if (!pendingSpeech || !avatarEnabled || !voiceEnabled) return;
    // Only use REST TTS when realtime is not active
    if (rtStatus === "ready") return;
    voiceClientRef.current?.speak(pendingSpeech).then(() => {
      onSpeechComplete?.();
    });
  }, [pendingSpeech]);

  // ── Status indicator (dev visibility) ────────────────────────────────────
  const rtIndicator =
    rtStatus === "ready" ? "● RT" :
    rtStatus === "connecting" ? "◌ RT" :
    rtStatus === "error" ? "○ REST" :
    "○ REST";

  return (
    <div className="p-4 flex justify-center items-center bg-black/40 border-b border-white/10 relative">
      <JavariAvatar state={avatarState} avatarEnabled={avatarEnabled} />
      {avatarEnabled && (
        <span className="absolute bottom-1 right-3 text-[9px] text-white/25 tracking-widest">
          {rtIndicator}
        </span>
      )}
    </div>
  );
}
