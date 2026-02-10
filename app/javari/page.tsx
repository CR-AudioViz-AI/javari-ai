"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";
/**
 * JAVARI PHASE 1 — UI STABILIZATION SHELL (FIX #2)
 * ------------------------------------------------
 * - Add identity bar
 * - Add message animations
 * - Add elevation/shadows
 * - Improve bubble geometry & spacing
 * - Improve input bar
 * - Prepare theme variables for future routing + Mode 2
 */
export default function JavariChatPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I'm Javari. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input }]);
    setInput("");
    // Placeholder until Phase 2 routing engine
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Javari received your message." }
      ]);
    }, 600);
  };
  return (
    <div className={styles.javariShell}>
      {/* IDENTITY BAR */}
      <div className={styles.identityBar}>
        <div className={styles.identityLeft}>
          <span className={styles.identityTitle}>Javari — AI Orchestrator</span>
        </div>
        <div className={styles.identityRight}>
          <span className={styles.modelIndicator}>Model: GPT-4 (UX)</span>
          <span className={styles.creditsCounter}>Credits: 1,240</span>
        </div>
      </div>
      {/* CHAT WINDOW */}
      <div ref={scrollRef} className={styles.chatWindow}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user"
                ? `${styles.userBubble} ${styles.bubbleAnim}`
                : `${styles.assistantBubble} ${styles.bubbleAnim}`
            }
          >
            {msg.content}
          </div>
        ))}
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
