import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { DEMO_CUSTOMER_ID } from "@/lib/config";

// Static tier of the Cache Components model: the customer's name is looked
// up once and cached for a very long time, rather than queried on every
// request. This is honestly correct for THIS demo, since DEMO_CUSTOMER_ID is
// hardcoded and never changes - in a real multi-tenant app this would
// instead read the logged-in session and need to stay genuinely dynamic
// (no cache) per visitor. See ARCHITECTURE.md.
//
// 'use cache' is applied directly to this component (see TrendingTracks.tsx
// for why) rather than a separate data-fetching helper it calls.
export default async function Greeting() {
  "use cache";
  cacheTag("customer-greeting");
  cacheLife({ expire: 31536000 }); // ~1 year - effectively permanent for a single hardcoded demo customer

  const result = await db.execute({
    sql: "SELECT FirstName FROM Customer WHERE CustomerId = ?",
    args: [DEMO_CUSTOMER_ID],
  });
  const firstName = (result.rows[0]?.FirstName as string) ?? "there";

  return (
    <div className="w-1/2 bg-ink px-8 py-5 text-white">
      <h1 className="text-xl font-semibold">Hey, {firstName}!</h1>
    </div>
  );
}
