"use client";
import { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";
/**
 * JAVARI PHASE 1 — UI STABILIZATION SHELL
 * ---------------------------------------
 * - Dark theme (isolated to Javari only)
 * - Dedicated chat viewport
 * - Clean bubble system
 * - Mobile-safe input bar
 * - Model + credits placeholders for Phase 2
 * - Zero impact on CRAudioVizAI global header/footer
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
    // Phase 2+ will replace this with routed LLM logic
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Javari received your message." }
      ]);
    }, 600);
  };
  return (
    <div className={styles.javariShell}>
      {/* HEADER ROW — MODEL + CREDITS (PLACEHOLDERS FOR PHASE 2) */}
      <div className={styles.topBar}>
        <span className={styles.modelIndicator}>Model: GPT-4 (UX)</span>
        <span className={styles.creditsCounter}>Credits: 1,240</span>
      </div>
      {/* CHAT AREA */}
      <div ref={scrollRef} className={styles.chatWindow}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user"
                ? styles.userBubble
                : styles.assistantBubble
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
