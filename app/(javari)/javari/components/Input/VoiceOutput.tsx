"use client";

import { useEffect, useRef } from "react";

export default function VoiceOutput({ audioUrl }: { audioUrl?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  }, [audioUrl]);

  return <audio ref={audioRef} hidden />;
}
