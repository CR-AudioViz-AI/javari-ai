"use client";

import { useState } from "react";
import { useJavariChat } from "../hooks/useJavariChat";

export default function JavariChatUI() {
  const { messages, status, sendMessage } = useJavariChat();
  const [input, setInput] = useState("");

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Messages */}
      <div className="border rounded-lg p-4 h-96 overflow-y-auto bg-white shadow">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center pt-10">
            Start a conversation with Javari...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="mb-4">
            <div
              className={
                msg.role === "user"
                  ? "font-bold text-blue-700 mb-1"
                  : "font-bold text-green-700 mb-1"
              }
            >
              {msg.role === "user" ? "You" : "Javari"}
            </div>

            <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded border text-sm">
              {msg.content}
            </pre>
          </div>
        ))}
      </div>

      {/* Input Bar */}
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
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status === "sending"}
        />

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded shadow disabled:opacity-60"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending..." : "Send"}
        </button>
      </form>

      {/* Error Message */}
      {status === "error" && (
        <div className="text-red-600 text-center">Error sending message.</div>
      )}
    </div>
  );
}
