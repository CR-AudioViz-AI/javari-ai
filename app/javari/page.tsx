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
  const [creditBalance, setCreditBalance] = useState(100.0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const messagesEndRef = useRef(null);

  async function sendMessage() {
    if (!input.trim()) return;
    if (creditBalance <= 0) {
      setIsBlocked(true);
      setErrorMessage("Out of credits! Please purchase more to continue.");
      return;
    }

    const userMsg = {
      role: "user",
      content: input,
      time: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAvatarState("thinking");
    setActiveModel("routing…");
    setErrorMessage("");

    try {
      const response = await fetch("/api/javari/router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 401) {
          setErrorMessage("Please log in to use Javari.");
          setAvatarState("idle");
          return;
        }
        
        if (response.status === 402) {
          setErrorMessage(errorData.error || "Insufficient credits.");
          setIsBlocked(true);
          setCreditBalance(errorData.credit_balance || 0);
          setAvatarState("idle");
          return;
        }

        throw new Error(errorData.error || "Request failed");
      }

      const reply = await response.json();

      setAvatarState("speaking");
      setActiveModel(reply.model);
      setCreditBalance(reply.credit_balance);

      const aiMsg = {
        role: "assistant",
        content: reply.reply,
        time: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, aiMsg]);
      setAvatarState("idle");

      // Check if balance is now zero
      if (reply.credit_balance <= 0) {
        setIsBlocked(true);
        setErrorMessage("You've run out of credits!");
      }

    } catch (error: any) {
      setErrorMessage(error.message || "Something went wrong.");
      setAvatarState("idle");
      
      const errorMsg = {
        role: "assistant",
        content: `Error: ${error.message}`,
        time: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
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
        <div className={styles.chatHeader}>
          <span>Javari AI</span>
          <span className={styles.headerCredits}>
            Credits: <span style={{ 
              color: creditBalance <= 0 ? "#ef4444" : 
                     creditBalance < 10 ? "#f59e0b" : 
                     creditBalance < 50 ? "#fbbf24" : "#10b981"
            }}>
              {creditBalance.toFixed(2)}
            </span>
          </span>
        </div>

        {/* OUT OF CREDITS BANNER */}
        {isBlocked && (
          <div className={styles.creditBanner}>
            <div className={styles.bannerIcon}>⚠️</div>
            <div className={styles.bannerText}>
              <strong>Out of Credits</strong>
              <p>Purchase more credits to continue using Javari AI.</p>
            </div>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {errorMessage && !isBlocked && (
          <div className={styles.errorBanner}>
            {errorMessage}
          </div>
        )}

        <div className={styles.chatWindow}>
          {messages.map((m, i) => (
            <JavariMessageBubble key={i} msg={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputRow}>
          <input
            value={input}
            placeholder={
              isBlocked ? "Out of credits..." : "Ask Javari anything…"
            }
            className={styles.inputBox}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isBlocked && sendMessage()}
            disabled={isBlocked}
          />
          <button 
            onClick={sendMessage} 
            className={styles.sendBtn}
            disabled={isBlocked || !input.trim()}
            style={{
              opacity: isBlocked || !input.trim() ? 0.5 : 1,
              cursor: isBlocked || !input.trim() ? "not-allowed" : "pointer"
            }}
          >
            {isBlocked ? "Blocked" : "Send"}
          </button>
        </div>
      </section>

      {/* RIGHT COLUMN — AVATAR */}
      <JavariRightPane 
        avatarState={avatarState} 
        activeModel={activeModel}
        creditBalance={creditBalance}
      />
    </div>
  );
}
