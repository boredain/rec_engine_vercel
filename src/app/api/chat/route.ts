import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { getSystemPrompt } from "@/lib/prompts/system";
import { getSchema } from "@/lib/tools/getSchema";
import { generalQuery } from "@/lib/tools/generalQuery";
import { catalogSearch } from "@/lib/tools/catalogSearch";
import { getRecommendations } from "@/lib/tools/getRecommendations";
import { purchaseTrack } from "@/lib/tools/purchaseTrack";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gateway("anthropic/claude-sonnet-4.6"),
    system: getSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools: { getSchema, generalQuery, catalogSearch, getRecommendations, purchaseTrack },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
