import { Suspense } from "react";
import Greeting from "./Greeting";
import TrendingTracks from "./TrendingTracks";
import RecentPurchases, { RecentPurchasesSkeleton } from "./RecentPurchases";
import ChatWidget from "./ChatWidget";

// Server Component (no "use client" here) - composes the three Cache
// Components rendering tiers side by side with the interactive chat:
// Greeting (cached ~indefinitely), TrendingTracks (cached weekly), and
// RecentPurchases (uncached, streamed via Suspense). ChatWidget is the one
// Client Component leaf, isolated on the right so the rest of this page can
// stay server-rendered. See ARCHITECTURE.md for the full reasoning behind
// each tier and the two-column layout.
export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-white">
      <Greeting />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-1/2 flex-col gap-[18px] overflow-hidden border-r border-divider bg-surface-left p-6">
          <TrendingTracks />
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
            {/* Section label stays outside the Suspense boundary so it
                renders immediately - only the actual (uncached) purchase
                rows are allowed to stream in after it. */}
            <h2 className="text-base font-bold text-ink">Recent Purchases</h2>
            <Suspense fallback={<RecentPurchasesSkeleton />}>
              <RecentPurchases />
            </Suspense>
          </div>
        </div>
        <div className="flex w-1/2 flex-col bg-white">
          {/* useChat (inside ChatWidget) uses Math.random() internally during
              its initial render, which Cache Components treats as
              non-deterministic - it has to sit under a Suspense boundary so
              Next.js knows this subtree resolves dynamically at request time
              rather than trying to bake it into the prerendered static shell. */}
          <Suspense fallback={<div className="flex h-full flex-col bg-white" />}>
            <ChatWidget />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
