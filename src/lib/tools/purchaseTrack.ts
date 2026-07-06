import { tool } from "ai";
import { z } from "zod";

export const purchaseTrack = tool({
  description:
    "Purchase a track for the current customer. Only call this after the " +
    "customer has indicated which track they want to buy, using the track " +
    "name, artist name, and price from a previously presented track list.",
  inputSchema: z.object({
    trackName: z.string(),
    artistName: z.string(),
    price: z.number(),
  }),
  // No execute: this surfaces as a pending tool call on the client so the
  // customer can approve or reject before any database write happens.
});
