import type { Candidate } from "./queries";

export interface RankedPick extends Candidate {
  tier: 1 | 2 | 3 | 4;
}

// Round 3 candidates split into Tier 1 (owned artist) / Tier 2 (new artist).
// Array.sort is stable, so the co-occurrence-count-DESC order from the SQL
// is preserved within each tier - Tier 1 items just move ahead of Tier 2.
export function tierFromCoOccurrence(
  candidates: Candidate[],
  ownedArtistIds: Set<number>,
): RankedPick[] {
  return candidates
    .map((c) => ({ ...c, tier: (ownedArtistIds.has(c.ArtistId) ? 1 : 2) as 1 | 2 }))
    .sort((a, b) => a.tier - b.tier);
}

export function tagTier(candidates: Candidate[], tier: 3 | 4): RankedPick[] {
  return candidates.map((c) => ({ ...c, tier }));
}
