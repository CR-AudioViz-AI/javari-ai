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

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: content }),
    });

    const data = await res.json();
    addAssistantMessage(data.messages?.[0]?.content || "");
    setStreaming(false);
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
