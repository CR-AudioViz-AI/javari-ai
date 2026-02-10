"use client";
import React from "react";
import styles from "./javari.module.css";

export default function JavariHistoryPane({ sessions, onSelect }) {
  return (
    <aside className={styles.leftPane}>
      <h3 className={styles.leftPaneTitle}>Sessions</h3>
      <ul className={styles.sessionList}>
        {sessions.map((s) => (
          <li
            key={s.id}
            className={styles.sessionItem}
            onClick={() => onSelect(s.id)}
          >
            <div className={styles.sessionDot}></div>
            <div className={styles.sessionLabel}>{s.label}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
