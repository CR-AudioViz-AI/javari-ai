"use client";

import React from "react";

interface CouncilMessage {
  provider: string;
  output: string;
  confidence?: number;
  reasoning?: string;
  validated?: boolean;
  error?: string;
}

interface CouncilPanelProps {
  council: CouncilMessage[];
  visible: boolean;
}

export default function CouncilPanel({ council, visible }: CouncilPanelProps) {
  if (!visible) return null;

  return (
    <aside className="w-80 bg-neutral-950 border-l border-neutral-800 text-white overflow-y-auto">
      <div className="p-3 font-semibold text-neutral-300 border-b border-neutral-800">
        SuperMode Council
      </div>

      {council.length === 0 && (
        <div className="p-4 text-neutral-500 text-sm">
          No council data available.
        </div>
      )}

      <ul className="space-y-3 p-3">
        {council.map((msg, idx) => (
          <li
            key={idx}
            className="bg-neutral-900 p-3 rounded-md border border-neutral-700"
          >
            <div className="font-bold text-blue-400 mb-1">
              {msg.provider}
            </div>

            {msg.confidence !== undefined && (
              <div className="text-xs text-neutral-400 mb-1">
                Confidence: {(msg.confidence * 100).toFixed(0)}%
              </div>
            )}

            <div className="text-sm whitespace-pre-wrap mb-2">
              {msg.output || "(no output)"}
            </div>

            {msg.reasoning && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-400">
                  Reasoning
                </summary>
                <div className="mt-1 text-xs text-neutral-500 whitespace-pre-wrap">
                  {msg.reasoning}
                </div>
              </details>
            )}

            {msg.validated !== undefined && (
              <div
                className={`mt-2 text-xs font-semibold ${
                  msg.validated ? "text-green-400" : "text-red-400"
                }`}
              >
                {msg.validated ? "Validated by Claude" : "Validation Failed"}
              </div>
            )}

            {msg.error && (
              <div className="mt-2 text-xs text-red-400">{msg.error}</div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
