// Client Component - the only piece of this page that genuinely needs
// interactivity (typing, streaming messages, click handlers). Extracted out
// of page.tsx so the rest of the page can stay server-rendered instead of
// the whole route being dragged into client-side rendering just because
// this one part needs it (see ARCHITECTURE.md, "leaf node" principle).
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { RecommendationItem } from "@/lib/tools/getRecommendations";

export default function ChatWidget() {
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
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[70%] rounded-[14px_14px_2px_14px] bg-ink px-4 py-2.5 text-sm text-white"
                  : "max-w-[80%] rounded-[2px_14px_14px_14px] bg-agent-bubble px-4 py-3.5 text-sm leading-relaxed text-ink"
              }
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
                          <RecommendationCards key={index} loading recommendations={[]} />
                        );
                      case "output-available":
                        return (
                          <RecommendationCards
                            key={index}
                            loading={false}
                            recommendations={
                              (part.output as { recommendations: RecommendationItem[] })
                                .recommendations
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
          <div className="text-left text-sm text-muted">Thinking...</div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2.5 border-t border-chat-divider px-6 py-[18px]"
      >
        <input
          className="flex-1 rounded-lg border border-input-border bg-input-bg px-3.5 py-3 text-sm text-ink"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Ask about your account, invoices, or the catalog..."
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          className="rounded-lg bg-ink px-[22px] py-3 text-sm font-semibold text-white disabled:opacity-50"
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
          <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-card-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 text-left">
      {recommendations.map((rec, i) => (
        <div key={i} className="w-full rounded-lg border border-card-border bg-white p-3 shadow-sm">
          <div className="font-semibold text-ink">{rec.trackName}</div>
          <div className="text-sm text-muted">{rec.artistName}</div>
          <div className="text-xs text-muted">
            {rec.genre} - ${rec.price.toFixed(2)}
          </div>
          <div className="mt-1 text-xs italic text-ink">{rec.why}</div>
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
  const router = useRouter();

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

    // Re-renders the server-rendered parts of the page (RecentPurchases in
    // particular) with fresh data after a successful write, without losing
    // this component's own client-side conversation state. RecentPurchases
    // has to stay uncached for this to actually surface the new purchase -
    // see ARCHITECTURE.md.
    if (approved) {
      router.refresh();
    }
  };

  return (
    <div className="mt-2 w-full rounded-lg border border-card-border bg-white p-3 shadow-sm">
      <div className="font-semibold text-ink">
        Confirm purchase of &quot;{input.trackName}&quot; by {input.artistName}?
      </div>
      <div className="text-sm text-muted">${input.price.toFixed(2)}</div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => handleDecision(true)}
          disabled={submitting}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision(false)}
          disabled={submitting}
          className="rounded bg-gray-300 px-3 py-1 text-sm text-ink disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
