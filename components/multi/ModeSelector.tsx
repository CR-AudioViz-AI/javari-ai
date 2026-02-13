// components/multi/ModeSelector.tsx
'use client';

import { useState } from 'react';

export type MultiAIMode = 'single' | 'super' | 'advanced' | 'roadmap' | 'council';

interface ModeSelectorProps {
  value: MultiAIMode;
  onChange: (mode: MultiAIMode) => void;
  disabled?: boolean;
}

const MODE_CONFIG: Record<MultiAIMode, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  single: {
    label: 'Single',
    description: 'Fast single-model responses',
    icon: '⚡',
    color: 'bg-blue-500'
  },
  super: {
    label: 'Super',
    description: 'Enhanced multi-model routing',
    icon: '🚀',
    color: 'bg-purple-500'
  },
  advanced: {
    label: 'Advanced',
    description: 'Complex task optimization',
    icon: '🧠',
    color: 'bg-indigo-500'
  },
  roadmap: {
    label: 'Roadmap',
    description: 'Strategic planning mode',
    icon: '🗺️',
    color: 'bg-teal-500'
  },
  council: {
    label: 'Council',
    description: 'Multi-AI collaborative workflow',
    icon: '👥',
    color: 'bg-orange-500'
  }
};

export function ModeSelector({ value, onChange, disabled = false }: ModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 
                   rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
      >
        <span className="text-xl">{MODE_CONFIG[value].icon}</span>
        <span className="font-medium text-white">{MODE_CONFIG[value].label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 left-0 w-80 bg-slate-800 border border-slate-700 
                          rounded-lg shadow-xl z-20 overflow-hidden">
            {(Object.keys(MODE_CONFIG) as MultiAIMode[]).map((mode) => {
              const config = MODE_CONFIG[mode];
              const isSelected = mode === value;

              return (
                <button
                  key={mode}
                  onClick={() => {
                    onChange(mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                    ${isSelected ? 'bg-slate-700' : 'hover:bg-slate-750'}`}
                >
                  <div className={`flex-shrink-0 w-10 h-10 ${config.color} rounded-lg 
                                   flex items-center justify-center text-xl`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{config.label}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{config.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
