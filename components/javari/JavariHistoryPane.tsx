"use client";

import React from "react";
import styles from "@/app/javari/javari.module.css";

interface Session {
  id: string;
  label: string;
}

interface JavariHistoryPaneProps {
  sessions: Session[];
  onSelect: (sessionId: string) => void;
}

export default function JavariHistoryPane({ sessions, onSelect }: JavariHistoryPaneProps) {
  return (
    <aside className={styles.historyPane}>
      <div className={styles.historyHeader}>
        <h2 className={styles.historyTitle}>History</h2>
        <button className={styles.newChatBtn} aria-label="New chat">
          + New Chat
        </button>
      </div>

      <div className={styles.sessionList}>
        {sessions.map((session) => (
          <button
            key={session.id}
            className={styles.sessionItem}
            onClick={() => onSelect(session.id)}
            aria-label={`Load session ${session.label}`}
          >
            <span className={styles.sessionIcon}>💬</span>
            <span className={styles.sessionLabel}>{session.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
