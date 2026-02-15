"use client";

import React from "react";

type Mode = "single" | "super" | "advanced" | "roadmap";

interface ModeToggleProps {
  mode: Mode;
  onChange: (newMode: Mode) => void;
}

const modes: { 
  key: Mode; 
  label: string; 
  description: string;
  icon: string;
}[] = [
  { 
    key: "single", 
    label: "Single", 
    description: "Fast single-AI responses",
    icon: "⚡"
  },
  { 
    key: "super", 
    label: "Super", 
    description: "Multi-AI council mode",
    icon: "🚀"
  },
  { 
    key: "advanced", 
    label: "Advanced", 
    description: "Comprehensive analysis",
    icon: "🧠"
  },
  { 
    key: "roadmap", 
    label: "Roadmap", 
    description: "Autonomous builds",
    icon: "🏗️"
  }
];

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  // Validate props
  if (!onChange) {
    console.error('[ModeToggle] ERROR: onChange prop is undefined!');
    return (
      <div className="text-red-500 text-sm p-2 border border-red-500 rounded">
        ModeToggle Error: onChange not provided
      </div>
    );
  }

  if (!mode) {
    console.warn('[ModeToggle] WARNING: mode prop is undefined, defaulting to "single"');
  }

  const currentMode = mode || 'single';
  
  console.log('[ModeToggle] Rendered:', { 
    mode: currentMode, 
    onChangeType: typeof onChange,
    onChangeDefined: !!onChange 
  });
  
  const handleClick = (newMode: Mode) => {
    console.log('[ModeToggle] Mode change requested:', {
      from: currentMode,
      to: newMode,
      onChangeAvailable: !!onChange
    });
    
    if (!onChange) {
      console.error('[ModeToggle] Cannot change mode: onChange is undefined');
      return;
    }
    
    try {
      onChange(newMode);
      console.log('[ModeToggle] onChange called successfully');
    } catch (error: any) {
      console.error('[ModeToggle] Error calling onChange:', error);
    }
  };
  
  return (
    <div 
      className="flex items-center gap-1 bg-neutral-900 text-white p-1.5 rounded-lg border border-neutral-700 shadow-sm"
      role="group"
      aria-label="Chat mode selection"
    >
      {modes.map(({ key, label, description, icon }) => {
        const active = key === currentMode;
        return (
          <button
            key={key}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClick(key);
            }}
            type="button"
            title={description}
            aria-pressed={active}
            aria-label={`${label} mode: ${description}`}
            className={`
              group relative
              px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900
              ${active 
                ? "bg-blue-600 text-white shadow-md" 
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }
            `}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-base" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </span>
            
            {/* Tooltip */}
            <span 
              className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                px-2 py-1 text-xs text-white bg-black rounded
                opacity-0 group-hover:opacity-100 transition-opacity
                pointer-events-none whitespace-nowrap
                z-10
              "
            >
              {description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
