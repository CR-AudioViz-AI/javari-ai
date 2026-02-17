"use client";

import AvatarEngine from "./AvatarEngine";
import { AvatarState } from "./AvatarStateMachine";

export default function AvatarContainer({ state }: { state: AvatarState }) {
  return (
    <div className="p-4 flex justify-center items-center bg-black/40 border-b border-white/10">
      <AvatarEngine state={state} />
    </div>
  );
}
