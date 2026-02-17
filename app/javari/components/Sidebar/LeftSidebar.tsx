"use client";

import ModelRouterPanel from "./ModelRouterPanel";
import CouncilPanel from "./CouncilPanel";
import PersonaPanel from "./PersonaPanel";
import JavariLogo from "../JavariLogo";

export default function LeftSidebar() {
  return (
    <div className="w-72 h-full bg-black/60 border-r border-white/10 backdrop-blur-xl flex flex-col overflow-y-auto">
      <div className="border-b border-white/10">
        <JavariLogo />
      </div>
      
      <div className="p-4 border-b border-white/10 text-white/70 text-xs tracking-widest">
        JAVARI OS — CONTROL CENTER
      </div>

      <ModelRouterPanel />
      <CouncilPanel />
      <PersonaPanel />
    </div>
  );
}
