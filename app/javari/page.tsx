"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";
/**
 * JAVARI PHASE 1 — UI FIX #3
 * ------------------------------------------------
 * - Add timestamps
 * - Add message grouping (user/user, assistant/assistant)
 * - Add Javari persona badge
 * - Improved spacing + visual rhythm
 * - Animation refinements
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // Scroll to bottom when messages update
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
    // Placeholder assistant response — Phase 2 replaces this with routed model
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
