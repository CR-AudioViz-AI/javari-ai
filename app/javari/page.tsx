"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";
import JavariHistoryPane from "@/components/javari/JavariHistoryPane";
import JavariRightPane from "@/components/javari/JavariRightPane";
import JavariMessageBubble from "@/components/javari/JavariMessageBubble";

export default function JavariPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([
    { id: "session-1", label: "Today" },
    { id: "session-2", label: "Yesterday" }
  ]);
  const [avatarState, setAvatarState] = useState("idle");
  const [activeModel, setActiveModel] = useState("none");

  const messagesEndRef = useRef(null);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg = {
      role: "user",
      content: input,
      time: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAvatarState("thinking");
    setActiveModel("routing…");

    const reply = await fetch("/api/javari/router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg.content })
    }).then((r) => r.json());

    setAvatarState("speaking");
    setActiveModel(reply.model);

    const aiMsg = {
      role: "assistant",
      content: reply.reply,
      time: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, aiMsg]);
    setAvatarState("idle");
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={styles.outerContainer}>
      
      {/* LEFT COLUMN — HISTORY */}
      <JavariHistoryPane sessions={sessions} onSelect={() => {}} />

      {/* CENTER — CHAT */}
      <section className={styles.chatColumn}>
        <div className={styles.chatHeader}>Javari AI</div>

        <div className={styles.chatWindow}>
          {messages.map((m, i) => (
            <JavariMessageBubble key={i} msg={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputRow}>
          <input
            value={input}
            placeholder="Ask Javari anything…"
            className={styles.inputBox}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} className={styles.sendBtn}>
            Send
          </button>
        </div>
      </section>

      {/* RIGHT COLUMN — AVATAR */}
      <JavariRightPane avatarState={avatarState} activeModel={activeModel} />
    </div>
  );
}
