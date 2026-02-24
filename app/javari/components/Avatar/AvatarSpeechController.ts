// app/javari/components/Avatar/AvatarSpeechController.ts
// Controls avatar state transitions during Javari speech lifecycle

import { AvatarState } from "./AvatarStateMachine";

type StateCallback = (state: AvatarState) => void;

export class AvatarSpeechController {
  private onStateChange: StateCallback;
  private currentAudio: HTMLAudioElement | null = null;
  private enabled: boolean = true;

  constructor(onStateChange: StateCallback) {
    this.onStateChange = onStateChange;
  }

  // ── Public state transition methods ────────────────────────────────────────
  thinking(): void {
    if (this.enabled) this.onStateChange("thinking");
  }

  speaking(): void {
    if (this.enabled) this.onStateChange("speaking");
  }

  idle(): void {
    this.onStateChange("idle");
  }

  // ── Convenience aliases ────────────────────────────────────────────────────
  setListening(): void {
    if (this.enabled) this.onStateChange("listening");
  }

  setThinking(): void {
    this.thinking();
  }

  setIdle(): void {
    this.idle();
  }

  // ── Voice playback ─────────────────────────────────────────────────────────
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.onStateChange("idle");
    }
  }

  async speakText(text: string): Promise<void> {
    if (!this.enabled) return;
    this.thinking();

    try {
      const res = await fetch("/api/javari/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak", text }),
      });

      if (!res.ok) {
        console.warn("[AvatarSpeechController] TTS API returned:", res.status);
        this.idle();
        return;
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      this.stop();

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.onplay = () => this.speaking();
      this.currentAudio.onended = () => {
        this.idle();
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      this.currentAudio.onerror = () => {
        this.idle();
        this.currentAudio = null;
      };

      await this.currentAudio.play();
    } catch (err) {
      console.error("[AvatarSpeechController] Error:", err);
      this.idle();
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }
}
