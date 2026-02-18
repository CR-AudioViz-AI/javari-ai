"use client";

import { useJavariState } from "./state/useJavariState";
import MessageFeed from "./components/MessageFeed/MessageFeed";
import ChatInput from "./components/Input/ChatInput";
import VoiceInput from "./components/Input/VoiceInput";
import UploadZone from "./components/Input/UploadZone";
import VoiceOutput from "./components/Input/VoiceOutput";

export default function JavariChatScreen() {
  const {
    messages,
    addUserMessage,
    addAssistantMessage,
    setStreaming,
    audioUrl,
    setTranscript,
  } = useJavariState();

  const handleSend = async (content: string) => {
    addUserMessage(content);
    setStreaming(true);

    try {
      // identity field signals the API layer to enforce Javari persona.
      // systemPrompt is locked server-side in unified.ts — UI never overrides it.
      const payload = {
        messages: [{ role: "user", content }],
        persona: "default",
        context: {},
        files: [],
        identity: "javari"
      };

      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Javari chat error:", res.status, errText);
        addAssistantMessage("Javari encountered an issue. Please try again.");
        return;
      }

      const data = await res.json();
      const reply =
        data.messages?.find((m: { role: string }) => m.role === "assistant")?.content ??
        data.messages?.[0]?.content ??
        "Javari did not return a response.";

      addAssistantMessage(reply);
    } catch (err) {
      console.error("Javari network error:", err);
      addAssistantMessage("Network error. Javari is unable to connect. Please check your connection.");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MessageFeed messages={messages} />

      <div className="px-4 pb-3">
        <UploadZone onFiles={() => {}} />
        <VoiceInput onTranscript={setTranscript} />
        <VoiceOutput audioUrl={audioUrl || undefined} />
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
