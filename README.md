# Recommendation-Driven Sales Engine

A customer support agent for a digital music retailer (built on the Chinook dataset) that does more than answer questions — it recognizes buying signals in the conversation and closes the loop into an actual purchase, with a human approval step before any money moves.

## The business case

Most customer support agents stop at answering the question. This one is built around a different premise: a support conversation is also a sales opportunity. When a customer asks "do you have anything by [artist]," or "what should I listen to next," that's a buying signal — and the agent is designed to act on it, not just respond to it.

Concretely, the agent:
1. Surfaces what's available to purchase (not just what's owned) whenever a customer asks about an artist, album, or genre
2. Proactively recommends unowned tracks personalized to the customer's actual purchase history, not generic bestsellers
3. Asks directly which track the customer wants to buy, and completes the transaction in the same conversation

The result: a support interaction that can end in a sale, instead of ending in an answer. That's the mechanism for **increasing revenue per customer** — every support touchpoint becomes a merchandising opportunity, not just a cost center.

## Agentic architecture

**Main agent** (Claude Sonnet, via Vercel AI Gateway) orchestrates the conversation through tool calling — it decides which capability a request needs and calls the right tool:

- `generalQuery` / `catalogSearch` — dynamic, guarded SQL against the customer's account data and the catalog
- `getRecommendations` — personalized track recommendations
- `purchaseTrack` — completes a purchase, gated on human approval

**`getRecommendations` is itself a nested agent** (Claude Haiku), not a single function call. When invoked, it runs its own independent multi-step tool-calling loop: it looks up the schema, gathers the customer's purchase history and catalog signals across several rounds of SQL, and applies a tiered ranking algorithm before returning a result:

- **Tier 1**: unowned tracks that share a playlist with something the customer already owns, in a genre they favor, by an artist they've already bought from (highest-confidence signal)
- **Tier 2**: same playlist co-occurrence signal, but a new artist
- **Tier 3**: no playlist signal, but genre + an artist the customer already owns
- **Tier 4**: broadest fallback — genre match with a new artist

The main agent never sees the intermediate SQL or ranking logic — it receives a finished, structured recommendation set and hands it to the UI. This is a genuine agent-as-a-tool pattern: one model orchestrating a request that's actually served by a second, independent agent underneath it.

**The purchase flow is human-in-the-loop by design.** `purchaseTrack` has no automatic execution step — when the model calls it, the pending call surfaces directly in the UI as an approval card (track, artist, price) instead of running immediately. Only after the customer clicks Approve does a dedicated server route perform the actual database write (as a single transaction — the Invoice and InvoiceLine rows are committed together or not at all). Rejecting cancels the flow with zero writes. No purchase ever happens without an explicit human decision in the loop.

## Tech stack

- **Next.js (App Router)** + TypeScript, deployed on Vercel
- **Vercel AI SDK** — tool calling, multi-step agent loops, streaming UI
- **Vercel AI Gateway** — model routing (Claude Sonnet for orchestration, Claude Haiku for the recommendations subagent) through a single provider-agnostic interface
- **Turso (libSQL)** — serverless, SQLite-compatible database hosting the Chinook dataset

## Built for a real production path, not just a demo

A few design decisions here are specifically about what it takes to take this from a portfolio demo to something a real business could run:

**Database-agnostic by construction.** Every tool (`generalQuery`, `catalogSearch`, `getSchema`, the purchase transaction) talks to the database through plain parameterized SQL via a single shared client — nothing in the tool logic, the prompts, or the ranking algorithm is Turso-specific. Pointing this at Postgres, Neon, PlanetScale, or any other SQL-compatible store is a matter of swapping the client in one file, not rewriting the agent.

**The purchase flow is built to slot in a real payment provider.** Right now, approval triggers a direct database write for demo purposes. In production, that same approval event would instead:
1. Create a Stripe PaymentIntent server-side and return its `client_secret` to the frontend
2. Let Stripe Elements collect and confirm the actual charge client-side
3. Have a Stripe webhook (`payment_intent.succeeded`) call back to the server to trigger the real Invoice/InvoiceLine write

This matters because "the customer clicked approve" and "the payment actually cleared" are two different events with real money involved — the webhook is what lets the write wait for genuine payment confirmation instead of trusting the client-side click alone.

**Identity is the one deliberate demo shortcut.** The customer ID is hardcoded for this build so the agent can be evaluated without an auth flow in the way. The production swap is a session-derived customer ID (e.g., via NextAuth or Clerk) in place of the constant — every tool already takes the customer ID as a parameter, so nothing about the query or approval logic changes, only where that ID comes from.

## Running locally

```bash
npm install
```

Create a `.env.local` with:
```
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
AI_GATEWAY_API_KEY=your_ai_gateway_api_key
```

```bash
npm run dev
```
