import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the Cache Components rendering model (Next.js 16's shipped
  // implementation of Partial Prerendering): routes are dynamic by default,
  // and caching is explicitly opted into per function/component via
  // 'use cache: remote'. See ARCHITECTURE.md for how this is used on the
  // home page (Greeting, TrendingTracks cached; RecentPurchases left dynamic).
  cacheComponents: true,
};

export default nextConfig;
