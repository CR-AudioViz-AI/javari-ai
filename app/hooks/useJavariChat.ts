import { useState } from "react";

export interface JavariMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: any;
}

export interface UseJavariChat {
  messages: JavariMessage[];
  status: "idle" | "sending" | "error";
  sendMessage: (msg: string) => Promise<void>;
}

/**
 * useJavariChat()
 *
 * Frontend hook for sending messages to JavariAI.
 * Wraps the API route created in Step 65.
 * Returns UI-ready messages and status.
 */
export function useJavariChat(): UseJavariChat {
  const [messages, setMessages] = useState<JavariMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  async function sendMessage(text: string): Promise<void> {
    setStatus("sending");

    const userMessage: JavariMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((m) => [...m, userMessage]);

    try {
      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: "ui-user",
          autoExecute: true,
          applyPolicy: true,
          applyLearning: false,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        setStatus("error");
        return;
      }

      const assistantMessage: JavariMessage = {
        id: json.data?.requestId ?? crypto.randomUUID(),
        role: "assistant",
        content: JSON.stringify(json.data, null, 2),
        metadata: json.data,
      };

      setMessages((m) => [...m, assistantMessage]);
      setStatus("idle");
    } catch (err) {
      console.error("JavariChat error:", err);
      setStatus("error");
    }
  }

  return {
    messages,
    status,
    sendMessage,
  };
}
