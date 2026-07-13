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
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type { RecommendationItem } from "@/lib/tools/getRecommendations";

export default function ChatWidget() {
  // useChat owns the whole conversation: the growing `messages` array, the
  // request lifecycle (`status`: "ready" | "submitted" | "streaming" |
  // "error"), and the functions to send a message or feed a tool's result
  // back in. Under the hood it POSTs to /api/chat (src/app/api/chat/route.ts)
  // - the same five-tool agent loop walked through in ARCHITECTURE.md.
  const { messages, status, sendMessage, addToolOutput } = useChat({
    // Without this, useChat waits for the human to send the next message.
    // This makes it auto-continue the turn once the assistant's last message
    // finishes with a *completed* tool call (e.g. getRecommendations already
    // returned its cards) - so the model can react to its own tool's output
    // without requiring the customer to type anything first.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input }); // Fires the POST to /api/chat.
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-6">
        {/* One conversational turn per message (role "user" or "assistant").
            Each message is a list of "parts" - plain text, or a tool call at
            some stage of its lifecycle - never just a single content string,
            which is why this renders message.parts.map(...) rather than
            message.content. */}
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
                  // Streamdown renders the model's Markdown (bold, bullet
                  // lists, etc.) safely even while text is still streaming
                  // in - a plain <span> would show raw "**text**" syntax
                  // instead of actually formatting it. isAnimating drives
                  // Streamdown's own fade-in effect while tokens arrive.
                  case "text":
                    return (
                      <Streamdown key={index} isAnimating={status === "streaming"}>
                        {part.text}
                      </Streamdown>
                    );

                  // Maps directly to the `getRecommendations` tool registered
                  // in api/chat/route.ts. That tool runs the deterministic
                  // orchestration in lib/tools/getRecommendations.ts (real DB
                  // queries + tiered ranking, with the model only handling
                  // intent-parsing and "why" copy) - see ARCHITECTURE.md for
                  // why it's no longer a nested agentic loop.
                  case "tool-getRecommendations":
                    switch (part.state) {
                      // The tool has been called but hasn't resolved yet -
                      // show a loading indicator instead of a blank gap while
                      // the two generateObject calls and parallel DB queries
                      // run server-side.
                      case "input-streaming":
                      case "input-available":
                        return (
                          <RecommendationCards key={index} loading recommendations={[]} />
                        );
                      // part.output is exactly what getRecommendations.ts's
                      // execute() returned: { recommendations: RecommendationItem[] }.
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

                  // Maps to lib/tools/purchaseTrack.ts, which deliberately has
                  // no execute() function - so this tool call can only ever
                  // reach "input-available," never "output-available" on its
                  // own. That's the entire human-in-the-loop mechanism: the
                  // call just sits here, pending, until a person clicks
                  // Approve or Reject in PurchaseApproval below.
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
        {/* Only covers the brief window right after sending, before the first
            token streams back - status goes "ready" -> "submitted" ->
            "streaming" -> "ready" again. */}
        {status === "submitted" && (
          <div className="text-left text-sm text-muted">Thinking...</div>
        )}
      </div>

      {/* The only interactive input in the whole page - disabled any time a
          request is already in flight, so a customer can't fire a second
          message mid-turn. */}
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

// Renders the getRecommendations tool's output as track cards - or the
// loading indicator below while the backend orchestration (parallel DB
// queries + two small model calls in lib/tools/getRecommendations.ts) is
// still running.
function RecommendationCards({
  loading,
  recommendations,
}: {
  loading: boolean;
  recommendations: RecommendationItem[];
}) {
  if (loading) {
    // A small fixed-size indicator instead of stacked skeleton blocks - its
    // size doesn't grow with how long the backend takes, so it reads as
    // "working" rather than a stuck/broken layout during a slow call.
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
        Finding recommendations...
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

// Renders the human-approval checkpoint for a pending purchaseTrack tool
// call. This component is the ONLY place in the entire app that can trigger
// a real database write - the model itself never writes to the database.
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
    // A plain, non-AI backend endpoint (src/app/api/purchase/route.ts) -
    // deliberately separate from /api/chat, so the actual write path never
    // depends on the model deciding to call anything again.
    const response = await fetch("/api/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, approved }),
    });
    const { result } = await response.json();
    // Feeds the write's result back into the conversation as this tool
    // call's "output" - this is what lets the model see what happened and
    // confirm the purchase (or acknowledge the rejection) in its next
    // message, even though purchaseTrack itself never executed inside
    // /api/chat.
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
