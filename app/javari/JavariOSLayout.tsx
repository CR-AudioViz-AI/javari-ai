"use client";

import LeftSidebar from "./components/Sidebar/LeftSidebar";
import RightSidebar from "./components/Sidebar/RightSidebar";
import AvatarContainer from "./components/Avatar/AvatarContainer";
import { useJavariState } from "./state/useJavariState";
import { determineAvatarState } from "./components/Avatar/AvatarStateMachine";

export default function JavariOSLayout({ children }: { children: React.ReactNode }) {
  const { streaming, pendingSpeech, clearPendingSpeech } = useJavariState();

  const avatarState = determineAvatarState({ streaming });

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white flex">
      {/* LEFT CONTROL CENTER */}
      <LeftSidebar />

      {/* CENTER APPLICATION VIEW */}
      <div className="flex-1 flex flex-col">
        <AvatarContainer
          state={avatarState}
          pendingSpeech={pendingSpeech}
          onSpeechComplete={clearPendingSpeech}
        />
        {children}
      </div>

      {/* RIGHT INTELLIGENCE PANELS */}
      <RightSidebar />
    </div>
  );
}
