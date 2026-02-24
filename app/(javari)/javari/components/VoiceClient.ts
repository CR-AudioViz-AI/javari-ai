// app/javari/components/VoiceClient.ts
// VoiceClient: manages Javari voice output
// Buffers text chunks → calls TTS → plays via WebAudio

import { AvatarSpeechController } from "./Avatar/AvatarSpeechController";
import { AvatarState } from "./Avatar/AvatarStateMachine";

export class VoiceClient {
  private controller: AvatarSpeechController;
  isEnabled: boolean = false;

  // Text chunk buffer for streaming TTS
  private chunkBuffer: string = "";
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private audioCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;

  constructor(onAvatarState: (state: AvatarState) => void) {
    this.controller = new AvatarSpeechController(onAvatarState);
  }

  enable(): void {
    this.isEnabled = true;
    this.controller.setEnabled(true);
  }

  disable(): void {
    this.isEnabled = false;
    this.controller.setEnabled(false);
    this.stopAllAudio();
  }

  stopAllAudio(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.chunkBuffer = "";
    if (this.activeSource) {
      try { this.activeSource.stop(); } catch { /* already stopped */ }
      this.activeSource = null;
    }
    this.controller.idle();
  }

  // ── Simple TTS via ElevenLabs/OpenAI voice API ────────────────────────────
  async speak(text: string): Promise<void> {
    if (!this.isEnabled) return;
    await this.controller.speakText(text);
  }

  // ── Streaming TTS: buffer chunks, flush after 300ms silence ──────────────
  acceptTextChunk(chunk: string): void {
    if (!this.isEnabled) return;
    this.chunkBuffer += chunk;
    this.controller.thinking();

    if (this.flushTimeout) clearTimeout(this.flushTimeout);
    this.flushTimeout = setTimeout(() => {
      this.flushBuffer();
    }, 300);
  }

  private async flushBuffer(): Promise<void> {
    const text = this.chunkBuffer.trim();
    this.chunkBuffer = "";
    if (!text || !this.isEnabled) return;

    try {
      // Use OpenAI TTS endpoint via our proxy
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model: "tts-1",
          voice: "alloy",
        }),
      });

      if (!res.ok) {
        // Fallback: use ElevenLabs route
        await this.controller.speakText(text);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      await this.playAudioBuffer(arrayBuffer);
    } catch (err) {
      console.error("[VoiceClient] TTS error:", err);
      this.controller.idle();
    }
  }

  private async playAudioBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.isEnabled) return;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    try {
      const decoded = await this.audioCtx.decodeAudioData(arrayBuffer);
      const source = this.audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(this.audioCtx.destination);

      this.activeSource = source;
      this.controller.speaking();

      source.onended = () => {
        this.activeSource = null;
        this.controller.idle();
      };

      source.start(0);
    } catch (err) {
      console.error("[VoiceClient] Audio decode error:", err);
      this.controller.idle();
    }
  }

  // ── Lifecycle forwarding ───────────────────────────────────────────────────
  stop(): void {
    this.stopAllAudio();
  }

  onUserSpeaking(): void {
    this.controller.setListening();
  }

  onProcessing(): void {
    this.controller.thinking();
  }

  onIdle(): void {
    this.controller.idle();
  }
}
