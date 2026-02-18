"use client";

import { useJavariState } from "./state/useJavariState";
import { useJavariSettings } from "./state/useJavariSettings";
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
    setPendingSpeech,
  } = useJavariState();

  const { avatarEnabled, voiceEnabled } = useJavariSettings();

  const handleSend = async (content: string) => {
    addUserMessage(content);
    setStreaming(true);

    try {
      const payload = {
        messages: [{ role: "user", content }],
        persona: "default",
        context: {},
        files: [],
        identity: "javari",
      };

      const res = await fetch("/api/javari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Chat API error:", res.status, errText);
        addAssistantMessage(
          "I\'m Javari — something went wrong on my end. Please try again."
        );
        return;
      }

      const data = await res.json();
      const reply =
        data.messages?.find((m: { role: string }) => m.role === "assistant")
          ?.content ??
        data.answer ??
        data.messages?.[0]?.content ??
        "No response received.";

      addAssistantMessage(reply);

      // Pipe reply to avatar speech if enabled
      if (avatarEnabled && voiceEnabled && reply) {
        setPendingSpeech(reply);
      }
    } catch (err) {
      console.error("Network error:", err);
      addAssistantMessage(
        "I\'m Javari — I couldn\'t reach my systems. Please check your connection."
      );
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
