"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

export default function Home() {
  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "text-right" : "text-left"}
          >
            <div
              className={`inline-block rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case "text":
                    return <span key={index}>{part.text}</span>;
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}
        {status === "submitted" && (
          <div className="text-left text-sm text-gray-500">Thinking...</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Ask about your account, invoices, or the catalog..."
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
