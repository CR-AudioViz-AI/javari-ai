"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";

/**
 * JAVARI PHASE 1 — UI FIX #4 (FINAL UI BASELINE)
 * ------------------------------------------------
 * - Collapsible chat history panel (UI only)
 * - Session header
 * - Scroll memory improvements
 * - Mobile overlay for history panel
 * - Clean structural foundation for Phase 2 & Mode 2
 */

type Msg = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default function JavariChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi, I'm Javari. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<string[]>([
    "Session 1 — Today",
    "Session 2 — Yesterday",
    "Session 3 — Draft Flow"
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll memory: preserve last scroll height
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages(prev => [
      ...prev,
      { role: "user", content: input, timestamp }
    ]);

    setInput("");

    // Placeholder for Phase 2 routing engine
    setTimeout(() => {
      const timestamp2 = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Javari received your message.", timestamp: timestamp2 }
      ]);
    }, 600);
  };

  const isGrouped = (index: number) => {
    if (index === 0) return false;
    return messages[index].role === messages[index - 1].role;
  };

  return (
    <div className={styles.javariShell}>

      {/* HISTORY PANEL */}
      <div className={`${styles.historyPanel} ${historyOpen ? styles.historyOpen : ""}`}>
        <div className={styles.historyHeader}>
          <span>Chat History</span>
          <button onClick={() => setHistoryOpen(false)} className={styles.closeHistory}>×</button>
        </div>
        <div className={styles.historyList}>
          {sessions.map((session, idx) => (
            <div key={idx} className={styles.historyItem}>
              {session}
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE OVERLAY WHEN HISTORY OPEN */}
      {historyOpen && (
        <div className={styles.overlay} onClick={() => setHistoryOpen(false)}></div>
      )}

      {/* HISTORY TOGGLE BUTTON */}
      <button className={styles.historyToggle} onClick={() => setHistoryOpen(true)}>
        ☰
      </button>

      {/* IDENTITY BAR */}
      <div className={styles.identityBar}>
        <div className={styles.identityLeft}>
          <span className={styles.identityTitle}>Javari — AI Orchestrator</span>
          <span className={styles.personaBadge}>● active</span>
        </div>

        <div className={styles.identityRight}>
          <span className={styles.modelIndicator}>Model: GPT-4 (UX)</span>
          <span className={styles.creditsCounter}>Credits: 1,240</span>
        </div>
      </div>

      {/* SESSION HEADER */}
      <div className={styles.sessionHeader}>
        <span>Session started: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>Mode: Standard</span>
      </div>

      {/* CHAT WINDOW */}
      <div ref={scrollRef} className={styles.chatWindow}>
        {messages.map((msg, index) => {
          const grouped = isGrouped(index);

          return (
            <div
              key={index}
              className={`${styles.messageWrapper} ${grouped ? styles.grouped : ""}`}
            >
              <div
                className={
                  msg.role === "user"
                    ? `${styles.userBubble} ${styles.bubbleAnim}`
                    : `${styles.assistantBubble} ${styles.bubbleAnim}`
                }
              >
                {msg.content}
              </div>

              <div
                className={
                  msg.role === "user"
                    ? styles.userTimestamp
                    : styles.assistantTimestamp
                }
              >
                {msg.timestamp}
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT BAR */}
      <div className={styles.inputBar}>
        <input
          type="text"
          placeholder="Message Javari..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

    </div>
  );
}
