"use client";

import KnowledgeGraphPanel from "./KnowledgeGraphPanel";
import SourceInspectorPanel from "./SourceInspectorPanel";
import FileIntelligencePanel from "./FileIntelligencePanel";

export default function RightSidebar() {
  return (
    <div className="w-80 h-full bg-black/60 border-l border-white/10 backdrop-blur-xl flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-white/10 text-white/70 text-xs tracking-widest">
        JAVARI OS — INTELLIGENCE PANELS
      </div>

      <KnowledgeGraphPanel />
      <SourceInspectorPanel />
      <FileIntelligencePanel />
    </div>
  );
}
