"use client";

import { useState } from "react";
import { useJavariStream } from "../hooks/useJavariStream";

export default function JavariStreamingChatUI() {
  const { messages, status, sendMessage } = useJavariStream();
  const [input, setInput] = useState("");

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      <div className="border rounded p-4 h-96 overflow-y-auto bg-white shadow">
        <pre className="whitespace-pre-wrap">{messages}</pre>
      </div>

      <form
        className="flex space-x-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage(input);
          setInput("");
        }}
      >
        <input
          className="flex-1 border rounded p-2 shadow"
          placeholder="Ask something…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-green-600 text-white rounded shadow disabled:opacity-60"
          disabled={status === "streaming"}
        >
          {status === "streaming" ? "Streaming…" : "Send"}
        </button>
      </form>
    </div>
  );
}
