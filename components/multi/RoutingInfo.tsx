// components/multi/RoutingInfo.tsx
'use client';

import { useState } from 'react';

interface RoutingInfoProps {
  selectedModel: string;
  modelId: string;
  provider: string;
  reason: string;
  costEstimate: number;
  confidence: number;
  executionTime?: number;
}

export function RoutingInfo({
  selectedModel,
  modelId,
  provider,
  reason,
  costEstimate,
  confidence,
  executionTime
}: RoutingInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2 border-t border-slate-700 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">Routing Details</span>
        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded">
          {selectedModel}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 p-3 bg-slate-800 rounded-lg space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Model:</span>
            <span className="text-white font-medium">{selectedModel}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Model ID:</span>
            <span className="text-slate-300 font-mono text-xs">{modelId}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Provider:</span>
            <span className="text-white capitalize">{provider}</span>
          </div>
          
          <div className="flex items-start justify-between">
            <span className="text-slate-400">Reason:</span>
            <span className="text-slate-300 text-right max-w-[60%]">{reason}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cost Estimate:</span>
            <span className="text-green-400 font-medium">
              ${costEstimate.toFixed(6)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Confidence:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-white font-medium">
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          
          {executionTime && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Execution Time:</span>
              <span className="text-white font-medium">
                {executionTime}ms
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
