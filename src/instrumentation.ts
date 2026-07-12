import { registerOTel } from "@vercel/otel";
import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";

export function register() {
  // Sets up Vercel's own span capture (infrastructure, fetch, framework
  // spans) - this alone does NOT trace AI SDK calls in v7, since OTel
  // support for the ai package was split into @ai-sdk/otel.
  registerOTel({ serviceName: "rec-engine-vercel" });

  // Registers the AI SDK's own generateText/streamText spans (including
  // recorded prompts/outputs when a call sets telemetry.recordInputs/
  // recordOutputs) onto the same OTel provider registerOTel just set up.
  registerTelemetry(new OpenTelemetry());
}
