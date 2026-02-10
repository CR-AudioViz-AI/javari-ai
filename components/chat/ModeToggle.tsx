"use client";

import React from "react";

type Mode = "single" | "super" | "advanced" | "roadmap";

interface ModeToggleProps {
  mode: Mode;
  onChange: (newMode: Mode) => void;
}

const modes: { key: Mode; label: string }[] = [
  { key: "single", label: "Single" },
  { key: "super", label: "Super" },
  { key: "advanced", label: "Advanced" },
  { key: "roadmap", label: "Roadmap" }
];

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-neutral-900 text-white p-2 rounded-md border border-neutral-700">
      {modes.map(({ key, label }) => {
        const active = key === mode;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`
              px-3 py-1 rounded-md text-sm transition
              ${active ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
