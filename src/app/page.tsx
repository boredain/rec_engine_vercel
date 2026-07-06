"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { RecommendationItem } from "@/lib/tools/getRecommendations";

export default function Home() {
  const { messages, status, sendMessage, addToolOutput } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
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
              className={`rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "inline-block bg-blue-600 text-white"
                  : "block w-full bg-gray-200 text-black"
              }`}
            >
              {message.parts.map((part, index) => {
                switch (part.type) {
                  case "text":
                    return <span key={index}>{part.text}</span>;
                  case "tool-getRecommendations":
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return (
                          <RecommendationCards
                            key={index}
                            loading
                            recommendations={[]}
                          />
                        );
                      case "output-available":
                        return (
                          <RecommendationCards
                            key={index}
                            loading={false}
                            recommendations={
                              (
                                part.output as {
                                  recommendations: RecommendationItem[];
                                }
                              ).recommendations
                            }
                          />
                        );
                      default:
                        return null;
                    }
                  case "tool-purchaseTrack":
                    switch (part.state) {
                      case "input-available":
                        return (
                          <PurchaseApproval
                            key={index}
                            toolCallId={part.toolCallId}
                            input={
                              part.input as {
                                trackName: string;
                                artistName: string;
                                price: number;
                              }
                            }
                            addToolOutput={addToolOutput}
                          />
                        );
                      default:
                        return null;
                    }
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

function RecommendationCards({
  loading,
  recommendations,
}: {
  loading: boolean;
  recommendations: RecommendationItem[];
}) {
  if (loading) {
    return (
      <div className="mt-2 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 w-full animate-pulse rounded-lg bg-gray-300"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 text-left">
      {recommendations.map((rec, i) => (
        <div key={i} className="w-full rounded-lg border bg-white p-3 shadow-sm">
          <div className="font-semibold">{rec.trackName}</div>
          <div className="text-sm text-gray-600">{rec.artistName}</div>
          <div className="text-xs text-gray-500">
            {rec.genre} - ${rec.price.toFixed(2)}
          </div>
          <div className="mt-1 text-xs italic text-gray-700">{rec.why}</div>
        </div>
      ))}
    </div>
  );
}

function PurchaseApproval({
  toolCallId,
  input,
  addToolOutput,
}: {
  toolCallId: string;
  input: { trackName: string; artistName: string; price: number };
  addToolOutput: ReturnType<typeof useChat>["addToolOutput"];
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleDecision = async (approved: boolean) => {
    setSubmitting(true);
    const response = await fetch("/api/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, approved }),
    });
    const { result } = await response.json();
    addToolOutput({
      tool: "purchaseTrack",
      toolCallId,
      output: result,
    });
  };

  return (
    <div className="mt-2 w-full rounded-lg border bg-white p-3 shadow-sm">
      <div className="font-semibold">
        Confirm purchase of &quot;{input.trackName}&quot; by {input.artistName}?
      </div>
      <div className="text-sm text-gray-600">${input.price.toFixed(2)}</div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => handleDecision(true)}
          disabled={submitting}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision(false)}
          disabled={submitting}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
