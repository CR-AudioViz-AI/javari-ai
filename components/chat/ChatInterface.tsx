"use client";

import React, { useEffect, useRef, useState } from "react";
import ConversationHistory from "./ConversationHistory";
import ModeToggle from "./ModeToggle";
import ProviderSelector from "./ProviderSelector";
import MessageList from "./MessageList";
import InputBar from "./InputBar";
import CouncilPanel from "./CouncilPanel";

type Mode = "single" | "super" | "advanced" | "roadmap";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string;
  metadata?: any;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("single");
  const [provider, setProvider] = useState("openai");
  const [councilData, setCouncilData] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load last session from history
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("javari_history") || "[]");
    if (history.length > 0) {
      const last = history[0];
      loadConversation(last.id);
    } else {
      startNewConversation();
    }
  }, []);

  function startNewConversation() {
    const id = crypto.randomUUID();
    setSessionId(id);
    setActiveConversationId(id);
    setMessages([]);
    setCouncilData([]);
  }

  function loadConversation(id: string) {
    const key = `chat_${id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      setSessionId(id);
      setActiveConversationId(id);
      setMessages(data.messages || []);
      setMode(data.mode || "single");
      setProvider(data.provider || "openai");
      setCouncilData(data.councilData || []);
    }
  }

  function saveConversation(updatedMessages: Message[], updatedCouncil: any[] = []) {
    if (!sessionId) return;

    const key = `chat_${sessionId}`;
    const data = {
      id: sessionId,
      messages: updatedMessages,
      mode,
      provider,
      councilData: updatedCouncil,
      updated: Date.now()
    };

    localStorage.setItem(key, JSON.stringify(data));

    // Update global history
    const history = JSON.parse(localStorage.getItem("javari_history") || "[]");
    const existingIndex = history.findIndex((h: any) => h.id === sessionId);

    const entry = {
      id: sessionId,
      title: updatedMessages[0]?.content || "New Chat",
      lastUpdated: Date.now()
    };

    if (existingIndex >= 0) {
      history[existingIndex] = entry;
    } else {
      history.unshift(entry);
    }

    localStorage.setItem("javari_history", JSON.stringify(history));
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    saveConversation(updatedMsgs, councilData);

    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: text,
        mode,
        provider,
        sessionId,
        history: updatedMsgs
      })
    });

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let assistantBuffer = "";
    let councilBuffer: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Process SSE events
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const dataStr = line.replace("data:", "").trim();

          try {
            const event = JSON.parse(dataStr);

            if (event.type === "token") {
              assistantBuffer += event.data;
              const tempMsgs = [...updatedMsgs, { role: "assistant", content: assistantBuffer }];
              setMessages(tempMsgs);
            }

            if (event.type === "council") {
              councilBuffer = event.data;
              setCouncilData(councilBuffer);
            }

          } catch (err) {
            console.error("Stream parse error", err);
          }
        }
      }
    }

    const finalMsgs = [...updatedMsgs, { role: "assistant", content: assistantBuffer }];
    setMessages(finalMsgs);
    saveConversation(finalMsgs, councilBuffer);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">

      {/* LEFT SIDEBAR */}
      <ConversationHistory
        activeId={activeConversationId}
        onSelect={loadConversation}
      />

      {/* MAIN CHAT AREA */}
      <div className="flex flex-col flex-1 border-l border-r border-neutral-800">

        {/* Top Controls */}
        <div className="p-3 border-b border-neutral-800 flex items-center gap-4">
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === "single" && (
            <ProviderSelector provider={provider} onChange={setProvider} />
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList messages={messages} />
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-neutral-800">
          <InputBar onSend={sendMessage} />
        </div>
      </div>

      {/* RIGHT SIDEBAR – SUPERMODE ONLY */}
      <CouncilPanel visible={mode === "super"} council={councilData} />

    </div>
  );
}
