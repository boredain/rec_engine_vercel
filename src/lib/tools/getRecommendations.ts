import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { gateway } from "@ai-sdk/gateway";
import { getRecommendationsPrompt } from "../prompts/recommendations";
import { getSchema } from "./getSchema";
import { generalQuery } from "./generalQuery";
import { catalogSearch } from "./catalogSearch";

const recommendationItemSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  genre: z.string(),
  price: z.number(),
  why: z.string(),
});

export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

export const getRecommendations = tool({
  description:
    "Generates personalized track recommendations based on the customer's purchase history. " +
    "Call this when the customer asks for recommendations, suggestions, what to listen to " +
    "next, or anything resembling music discovery.",
  inputSchema: z.object({
    customerMessage: z
      .string()
      .describe("The customer's original message, copied verbatim"),
  }),
  execute: async ({ customerMessage }) => {
    let captured: RecommendationItem[] | null = null;

    const submitRecommendations = tool({
      description:
        "Submit the final list of recommendations. Call this exactly once when done.",
      inputSchema: z.object({
        recommendations: z.array(recommendationItemSchema),
      }),
      execute: async ({ recommendations }) => {
        captured = recommendations;
        return "Recommendations submitted.";
      },
    });

    await generateText({
      model: gateway("anthropic/claude-haiku-4.5"),
      system: getRecommendationsPrompt(),
      prompt: customerMessage,
      tools: { getSchema, generalQuery, catalogSearch, submitRecommendations },
      stopWhen: stepCountIs(10),
      // Traced as a child span under the main agent's streamText call (see
      // route.ts) - this is the nested agentic loop that currently issues
      // 6-8 sequential LLM round trips per recommendation request.
      telemetry: {
        isEnabled: true,
        functionId: "recommendations-subagent",
        recordInputs: true,
        recordOutputs: true,
      },
    });

    return { recommendations: captured ?? [] };
  },
});
