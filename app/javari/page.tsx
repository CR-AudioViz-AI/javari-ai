"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./javari.module.css";
import JavariHistoryPane from "@/components/javari/JavariHistoryPane";
import JavariRightPane from "@/components/javari/JavariRightPane";
import JavariMessageBubble from "@/components/javari/JavariMessageBubble";
import { CouncilTimelineStep, ModelContributorScore } from "@/app/api/javari/router/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
  supermode?: boolean;
  contributors?: ModelContributorScore[];
  validated?: boolean;
}

export default function JavariPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState([
    { id: "session-1", label: "Today" },
    { id: "session-2", label: "Yesterday" }
  ]);
  const [avatarState, setAvatarState] = useState("idle");
  const [activeModel, setActiveModel] = useState("none");
  const [creditBalance, setCreditBalance] = useState(100.0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [supermodeEnabled, setSupermodeEnabled] = useState(false);
  const [timeline, setTimeline] = useState<CouncilTimelineStep[]>([]);
  const [contributors, setContributors] = useState<ModelContributorScore[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleSupermode = () => {
    setSupermodeEnabled(!supermodeEnabled);
    setErrorMessage("");
  };

  async function sendMessage() {
    if (!input.trim()) return;
    if (creditBalance <= 0) {
      setIsBlocked(true);
      setErrorMessage("Out of credits! Please purchase more to continue.");
      return;
    }

    const userMsg: Message = {
      role: "user",
      content: input,
      time: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    
    if (supermodeEnabled) {
      setAvatarState("supermodeThinking");
      setActiveModel("AI Council");
    } else {
      setAvatarState("thinking");
      setActiveModel("routing…");
    }
    
    setErrorMessage("");
    setTimeline([]);
    setContributors([]);

    try {
      const response = await fetch("/api/javari/router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg.content,
          supermode: supermodeEnabled
        })
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

      if (supermodeEnabled) {
        setAvatarState("supermodeSpeak");
      } else {
        setAvatarState("speaking");
      }

      setActiveModel(reply.model);
      setCreditBalance(reply.credit_balance);

      if (reply.timeline) {
        setTimeline(reply.timeline);
      }
      if (reply.contributors) {
        setContributors(reply.contributors);
      }

      const aiMsg: Message = {
        role: "assistant",
        content: reply.reply,
        time: new Date().toLocaleTimeString(),
        supermode: reply.supermode,
        contributors: reply.contributors,
        validated: reply.supermode
      };

      setMessages((prev) => [...prev, aiMsg]);
      
      setTimeout(() => {
        if (supermodeEnabled) {
          setAvatarState("supermodeIdle");
        } else {
          setAvatarState("idle");
        }
      }, 2000);

      if (reply.credit_balance <= 0) {
        setIsBlocked(true);
        setErrorMessage("You've run out of credits!");
      }

    } catch (error: any) {
      setErrorMessage(error.message || "Something went wrong.");
      setAvatarState("idle");
      
      const errorMsg: Message = {
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

  useEffect(() => {
    if (avatarState === "idle" || avatarState === "supermodeIdle") {
      setAvatarState(supermodeEnabled ? "supermodeIdle" : "idle");
    }
  }, [supermodeEnabled]);

  return (
    <div className={styles.outerContainer}>
      
      <JavariHistoryPane sessions={sessions} onSelect={() => {}} />

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

        {isBlocked && (
          <div className={styles.creditBanner}>
            <div className={styles.bannerIcon}>⚠️</div>
            <div className={styles.bannerText}>
              <strong>Out of Credits</strong>
              <p>Purchase more credits to continue using Javari AI.</p>
            </div>
          </div>
        )}

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
              isBlocked ? "Out of credits..." : 
              supermodeEnabled ? "Ask the AI Council anything…" :
              "Ask Javari anything…"
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
            {isBlocked ? "Blocked" : supermodeEnabled ? "Ask Council" : "Send"}
          </button>
        </div>
      </section>

      <JavariRightPane 
        avatarState={avatarState} 
        activeModel={activeModel}
        creditBalance={creditBalance}
        supermodeEnabled={supermodeEnabled}
        onToggleSupermode={toggleSupermode}
        timeline={timeline}
        contributors={contributors}
      />
    </div>
  );
}
