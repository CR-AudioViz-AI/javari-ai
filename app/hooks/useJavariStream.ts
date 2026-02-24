"use client";

import { useEffect, useRef, useState } from "react";

export function useJavariStream() {
  const [messages, setMessages] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const controllerRef = useRef<EventSource | null>(null);

  const sendMessage = async (text: string, userId?: string) => {
    setStatus("streaming");
    setMessages("");

    // First, send the POST request to initiate streaming
    const response = await fetch("/api/javari/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, userId }),
    });

    // The response is the SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      setStatus("error");
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setStatus("done");
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.token) {
                setMessages((m) => m + parsed.token + " ");
              } else if (parsed.complete) {
                setStatus("done");
              } else if (parsed.error) {
                setStatus("error");
              }
            } catch (e) {
              // Ignore parse errors for non-JSON data
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setStatus("error");
    }
  };

  return { messages, status, sendMessage };
}
