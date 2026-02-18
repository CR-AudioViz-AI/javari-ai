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

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.onStateChange("idle");
    }
  }

  async speakText(text: string): Promise<void> {
    if (!this.enabled) return;

    this.onStateChange("thinking");

    try {
      const res = await fetch("/api/javari/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak", text }),
      });

      if (!res.ok) {
        console.warn("[AvatarSpeechController] TTS API returned:", res.status);
        this.onStateChange("idle");
        return;
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      this.stop(); // stop any current audio

      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onplay = () => this.onStateChange("speaking");
      this.currentAudio.onended = () => {
        this.onStateChange("idle");
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      this.currentAudio.onerror = () => {
        this.onStateChange("idle");
        this.currentAudio = null;
      };

      await this.currentAudio.play();
    } catch (err) {
      console.error("[AvatarSpeechController] Error:", err);
      this.onStateChange("idle");
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  setListening() {
    if (this.enabled) this.onStateChange("listening");
  }

  setThinking() {
    if (this.enabled) this.onStateChange("thinking");
  }

  setIdle() {
    this.onStateChange("idle");
  }
}
