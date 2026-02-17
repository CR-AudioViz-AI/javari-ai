"use client";

import LeftSidebar from "./components/Sidebar/LeftSidebar";
import RightSidebar from "./components/Sidebar/RightSidebar";
import AvatarContainer from "./components/Avatar/AvatarContainer";

export default function JavariOSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white flex">
      {/* LEFT CONTROL CENTER */}
      <LeftSidebar />

      {/* CENTER APPLICATION VIEW */}
      <div className="flex-1 flex flex-col">
        <AvatarContainer state="idle" />
        {children}
      </div>

      {/* RIGHT INTELLIGENCE PANELS */}
      <RightSidebar />
    </div>
  );
}
