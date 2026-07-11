import { db } from "@/lib/db";
import { DEMO_CUSTOMER_ID } from "@/lib/config";

interface RecentPurchase {
  TrackName: string;
  ArtistName: string;
  UnitPrice: number;
}

// Runtime-dynamic tier: deliberately NOT cached. InvoiceDate is written with
// date-only precision (see purchaseTrackDb.ts), so two same-day purchases
// would be indistinguishable by date alone - ordering by InvoiceId DESC
// instead reliably reflects insertion order, since Invoice rows are only
// ever inserted, never deleted (see ARCHITECTURE.md). This component must
// stay uncached: caching it would risk showing a stale purchases list right
// after a customer approves a brand new one. Capped at the 3 most recent.
async function getRecentPurchases(): Promise<RecentPurchase[]> {
  const result = await db.execute({
    sql: `
      SELECT t.Name AS TrackName, ar.Name AS ArtistName, il.UnitPrice AS UnitPrice
      FROM Invoice i
      JOIN InvoiceLine il ON i.InvoiceId = il.InvoiceId
      JOIN Track t ON il.TrackId = t.TrackId
      JOIN Album al ON t.AlbumId = al.AlbumId
      JOIN Artist ar ON al.ArtistId = ar.ArtistId
      WHERE i.CustomerId = ?
      ORDER BY i.InvoiceId DESC
      LIMIT 3
    `,
    args: [DEMO_CUSTOMER_ID],
  });

  return result.rows as unknown as RecentPurchase[];
}

// Rendered inside a <Suspense> boundary in page.tsx - the "Recent Purchases"
// section label itself stays outside this component and shows immediately;
// only this list is allowed to stream in after the static/cached content.
export default async function RecentPurchases() {
  const purchases = await getRecentPurchases();

  if (purchases.length === 0) {
    return <p className="text-[13.5px] text-muted">No purchases yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-2.5">
      {purchases.map((purchase, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 rounded-lg border border-card-border bg-white px-3.5 py-2.5 text-[13.5px]"
        >
          <span className="min-w-0 flex-1 truncate text-ink">
            {purchase.TrackName} <span className="text-muted">by {purchase.ArtistName}</span>
          </span>
          <span className="flex-none font-semibold text-ink">
            ${purchase.UnitPrice.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Suspense fallback while RecentPurchases resolves its (uncached) query.
export function RecentPurchasesSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[42px] w-full animate-pulse rounded-lg bg-card-border" />
      ))}
    </div>
  );
}
