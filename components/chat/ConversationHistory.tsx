"use client";

import React, { useEffect, useState } from "react";

interface ConversationEntry {
  id: string;
  title: string;
  lastUpdated: number;
}

interface ConversationHistoryProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationHistory({
  activeId,
  onSelect
}: ConversationHistoryProps) {
  const [history, setHistory] = useState<ConversationEntry[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("javari_history");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ConversationEntry[];
        setHistory(parsed.sort((a, b) => b.lastUpdated - a.lastUpdated));
      } catch (e) {
        console.error("History parse error:", e);
      }
    }
  }, []);

  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-800 text-white overflow-y-auto">
      <div className="p-3 font-semibold text-neutral-300">
        Conversation History
      </div>

      <ul className="space-y-1 px-2">
        {history.length === 0 && (
          <li className="text-neutral-500 text-sm px-2 py-2">
            No previous conversations.
          </li>
        )}

        {history.map((entry) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                onClick={() => onSelect(entry.id)}
                className={`
                  w-full text-left px-3 py-2 rounded-md text-sm
                  transition border border-transparent
                  ${
                    active
                      ? "bg-blue-600 border-blue-400"
                      : "bg-neutral-900 hover:bg-neutral-800"
                  }
                `}
              >
                <div className="font-medium">{entry.title || "Untitled Chat"}</div>
                <div className="text-xs text-neutral-500">
                  {new Date(entry.lastUpdated).toLocaleString()}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
