// app/javari/components/Avatar/AvatarStateMachine.ts

export type AvatarState =
  | "idle"
  | "listening"
  | "thinking"
  | "reasoning"
  | "speaking";

export function determineAvatarState(input: {
  listening?: boolean;
  streaming?: boolean;
  reasoning?: boolean;
  speaking?: boolean;
}): AvatarState {
  if (input.listening) return "listening";
  if (input.reasoning) return "reasoning";
  if (input.speaking) return "speaking";
  if (input.streaming) return "thinking";
  return "idle";
}
