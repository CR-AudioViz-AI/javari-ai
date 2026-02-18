// app/javari/components/VoiceClient.ts
// VoiceClient: manages Javari voice output lifecycle
// Delegates to AvatarSpeechController for state management

import { AvatarSpeechController } from "./Avatar/AvatarSpeechController";
import { AvatarState } from "./Avatar/AvatarStateMachine";

export class VoiceClient {
  private controller: AvatarSpeechController;
  private active: boolean = false;

  constructor(onAvatarState: (state: AvatarState) => void) {
    this.controller = new AvatarSpeechController(onAvatarState);
  }

  enable() {
    this.active = true;
    this.controller.setEnabled(true);
  }

  disable() {
    this.active = false;
    this.controller.setEnabled(false);
  }

  async speak(text: string): Promise<void> {
    if (!this.active) return;
    await this.controller.speakText(text);
  }

  stop() {
    this.controller.stop();
  }

  onUserSpeaking() {
    this.controller.setListening();
  }

  onProcessing() {
    this.controller.setThinking();
  }

  onIdle() {
    this.controller.setIdle();
  }
}
