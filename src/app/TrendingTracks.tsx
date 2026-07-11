import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

interface TrendingTrack {
  TrackName: string;
  ArtistName: string;
}

// Cached-dynamic tier: a catalog-wide aggregate (most-purchased tracks
// across ALL customers), not customer-specific, so it's safe to cache
// broadly. Refreshed weekly rather than invalidated per purchase - trending
// data doesn't need per-transaction freshness. No tiebreaker on equal
// purchase counts: which 5 tracks show up among a tie is cosmetic, not a
// correctness issue (see ARCHITECTURE.md).
//
// 'use cache' is applied directly to this component, not a separate data-
// fetching helper it calls - matching Vercel's documented PPR pattern, where
// the cached value is the component's rendered JSX output rather than a
// plain data array handed off from one function to another.
export default async function TrendingTracks() {
  "use cache";
  cacheTag("trending-tracks");
  cacheLife({ expire: 604800 }); // 1 week

  const result = await db.execute(`
    SELECT t.Name AS TrackName, ar.Name AS ArtistName, COUNT(il.InvoiceLineId) AS PurchaseCount
    FROM InvoiceLine il
    JOIN Track t ON il.TrackId = t.TrackId
    JOIN Album al ON t.AlbumId = al.AlbumId
    JOIN Artist ar ON al.ArtistId = ar.ArtistId
    GROUP BY t.TrackId
    ORDER BY PurchaseCount DESC
    LIMIT 5
  `);
  const tracks = result.rows as unknown as TrendingTrack[];

  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-base font-bold text-ink">Trending Tracks</h2>
      <div className="flex flex-col gap-2">
        {tracks.map((track, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-card-border bg-white px-3.5 py-2.5"
          >
            <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-badge-bg text-[11px] font-bold text-ink">
              {i + 1}
            </div>
            <div className="text-[13.5px] text-ink">
              {track.TrackName} <span className="text-muted">by {track.ArtistName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
