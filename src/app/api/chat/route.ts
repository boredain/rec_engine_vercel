// Route Handler: a file named route.ts inside app/api/... becomes a real HTTP
// endpoint at the matching URL - this one serves POST /api/chat. This is the
// single backend "brain" of the app: src/app/page.tsx's useChat hook calls
// this endpoint every time the conversation needs a new model response.
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { getSystemPrompt } from "@/lib/prompts/system";
import { getSchema } from "@/lib/tools/getSchema";
import { generalQuery } from "@/lib/tools/generalQuery";
import { catalogSearch } from "@/lib/tools/catalogSearch";
import { getRecommendations } from "@/lib/tools/getRecommendations";
import { purchaseTrack } from "@/lib/tools/purchaseTrack";

export async function POST(req: Request) {
  // useChat sends the entire conversation history on every request, not just
  // the newest message - there's no server-side session state here, so the
  // model needs full context replayed each turn.
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    // gateway(...) routes this call through Vercel's AI Gateway instead of
    // hitting Anthropic directly. The model string can change to a different
    // model or provider without touching any other line in this file.
    model: gateway("anthropic/claude-sonnet-4.6"),
    system: getSystemPrompt(),
    // Adapts the UI message format (with its "parts" array - text, tool calls,
    // tool results) into the plain role/content format the model API expects.
    messages: await convertToModelMessages(messages),
    // Every tool the model may call this turn. Each is defined independently
    // in src/lib/tools/ and enforces its own rules (e.g. generalQuery refuses
    // to run without a CustomerId filter; purchaseTrack has no execute() at
    // all, so calling it just pauses - see that file and page.tsx's handling
    // of the "tool-purchaseTrack" part type for why).
    tools: { getSchema, generalQuery, catalogSearch, getRecommendations, purchaseTrack },
    // Caps the model at 8 tool-call round trips in a single turn - a safety/
    // cost limit so a confused model can't loop on tool calls indefinitely.
    stopWhen: stepCountIs(8),
    // Emits this call (and any nested tool-call LLM calls, e.g.
    // getRecommendations' internal generateText loop) as OpenTelemetry spans.
    // Requires src/instrumentation.ts's registerOTel() and Session Tracing
    // enabled via the Vercel Toolbar on a deployed preview/prod URL to view -
    // see ARCHITECTURE.md.
    experimental_telemetry: {
      isEnabled: true,
      functionId: "main-agent",
      recordInputs: true,
      recordOutputs: true,
    },
  });

  // Converts the streaming result into the exact wire format useChat expects,
  // so text and tool-call state updates arrive incrementally on the client
  // instead of all at once after the model finishes.
  return result.toUIMessageStreamResponse();
}
