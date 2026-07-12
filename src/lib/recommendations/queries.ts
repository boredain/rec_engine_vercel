import { db } from "../db";

export interface GenreCount {
  GenreId: number;
  Name: string;
  TrackCount: number;
}

export interface ArtistCount {
  ArtistId: number;
  Name: string;
  TrackCount: number;
}

export interface Candidate {
  TrackId: number;
  Name: string;
  ArtistId: number;
  ArtistName: string;
  GenreId: number;
  GenreName: string;
  UnitPrice: number;
  CoOccurrenceCount?: number;
}

function placeholders(count: number): string {
  return Array(count).fill("?").join(",");
}

export async function getGenreList(): Promise<{ GenreId: number; Name: string }[]> {
  const result = await db.execute("SELECT GenreId, Name FROM Genre ORDER BY Name");
  return result.rows as unknown as { GenreId: number; Name: string }[];
}

export async function getTopGenres(customerId: number): Promise<GenreCount[]> {
  const result = await db.execute({
    sql: `
      SELECT g.GenreId, g.Name, COUNT(il.TrackId) AS TrackCount
      FROM InvoiceLine il
      INNER JOIN Invoice i ON il.InvoiceId = i.InvoiceId
      INNER JOIN Track t ON il.TrackId = t.TrackId
      INNER JOIN Genre g ON t.GenreId = g.GenreId
      WHERE i.CustomerId = ?
      GROUP BY g.GenreId, g.Name
      ORDER BY TrackCount DESC
    `,
    args: [customerId],
  });
  return result.rows as unknown as GenreCount[];
}

export async function getOwnedArtistIds(customerId: number): Promise<ArtistCount[]> {
  const result = await db.execute({
    sql: `
      SELECT a.ArtistId, a.Name, COUNT(il.TrackId) AS TrackCount
      FROM InvoiceLine il
      INNER JOIN Invoice i ON il.InvoiceId = i.InvoiceId
      INNER JOIN Track t ON il.TrackId = t.TrackId
      INNER JOIN Album al ON t.AlbumId = al.AlbumId
      INNER JOIN Artist a ON al.ArtistId = a.ArtistId
      WHERE i.CustomerId = ?
      GROUP BY a.ArtistId, a.Name
      ORDER BY TrackCount DESC
    `,
    args: [customerId],
  });
  return result.rows as unknown as ArtistCount[];
}

export async function getOwnedTrackIds(customerId: number): Promise<number[]> {
  const result = await db.execute({
    sql: `
      SELECT DISTINCT il.TrackId
      FROM InvoiceLine il
      INNER JOIN Invoice i ON il.InvoiceId = i.InvoiceId
      WHERE i.CustomerId = ?
    `,
    args: [customerId],
  });
  return result.rows.map((r) => r.TrackId as number);
}

export async function getPlaylistIdsForTracks(trackIds: number[]): Promise<number[]> {
  if (trackIds.length === 0) return [];
  const result = await db.execute({
    sql: `SELECT DISTINCT PlaylistId FROM PlaylistTrack WHERE TrackId IN (${placeholders(trackIds.length)})`,
    args: trackIds,
  });
  return result.rows.map((r) => r.PlaylistId as number);
}

// Round 3: tracks that share a playlist with an owned track, ranked by how
// many of those playlists they co-occur in. No genre filter here - tier
// selection (rank.ts) splits these into Tier 1/2 by artist ownership after
// the fact, matching the original prompt's "Tier 1 then Tier 2" order.
// Verified against the live DB to match the model-generated SQL exactly
// (see ARCHITECTURE.md).
export async function getCoOccurrenceCandidates(
  playlistIds: number[],
  ownedTrackIds: number[],
): Promise<Candidate[]> {
  if (playlistIds.length === 0) return [];
  const ownedClause =
    ownedTrackIds.length > 0
      ? `AND t.TrackId NOT IN (${placeholders(ownedTrackIds.length)})`
      : "";
  const result = await db.execute({
    sql: `
      SELECT
        t.TrackId, t.Name, a.ArtistId, a.Name AS ArtistName,
        g.GenreId, g.Name AS GenreName, t.UnitPrice,
        COUNT(DISTINCT pt.PlaylistId) AS CoOccurrenceCount
      FROM PlaylistTrack pt
      INNER JOIN Track t ON pt.TrackId = t.TrackId
      INNER JOIN Album al ON t.AlbumId = al.AlbumId
      INNER JOIN Artist a ON al.ArtistId = a.ArtistId
      INNER JOIN Genre g ON t.GenreId = g.GenreId
      WHERE pt.PlaylistId IN (${placeholders(playlistIds.length)})
      ${ownedClause}
      GROUP BY t.TrackId, t.Name, a.ArtistId, a.Name, g.GenreId, g.Name, t.UnitPrice
      ORDER BY CoOccurrenceCount DESC
      LIMIT 10
    `,
    args: [...playlistIds, ...ownedTrackIds],
  });
  return result.rows as unknown as Candidate[];
}

// Round 4 (Tier 3 fallback): target genre, owned artist, no playlist signal.
export async function getGenreOwnedArtistFallback(
  genreId: number,
  ownedArtistIds: number[],
  ownedTrackIds: number[],
): Promise<Candidate[]> {
  if (ownedArtistIds.length === 0) return [];
  const ownedTrackClause =
    ownedTrackIds.length > 0
      ? `AND t.TrackId NOT IN (${placeholders(ownedTrackIds.length)})`
      : "";
  const result = await db.execute({
    sql: `
      SELECT t.TrackId, t.Name, a.ArtistId, a.Name AS ArtistName,
        g.GenreId, g.Name AS GenreName, t.UnitPrice
      FROM Track t
      INNER JOIN Album al ON t.AlbumId = al.AlbumId
      INNER JOIN Artist a ON al.ArtistId = a.ArtistId
      INNER JOIN Genre g ON t.GenreId = g.GenreId
      WHERE g.GenreId = ?
        AND a.ArtistId IN (${placeholders(ownedArtistIds.length)})
        ${ownedTrackClause}
      ORDER BY t.UnitPrice DESC
      LIMIT 10
    `,
    args: [genreId, ...ownedArtistIds, ...ownedTrackIds],
  });
  return result.rows as unknown as Candidate[];
}

// Round 5 (Tier 4 fallback): target genre, new artist, no playlist signal.
export async function getGenreNewArtistFallback(
  genreId: number,
  ownedArtistIds: number[],
  ownedTrackIds: number[],
): Promise<Candidate[]> {
  const ownedArtistClause =
    ownedArtistIds.length > 0
      ? `AND a.ArtistId NOT IN (${placeholders(ownedArtistIds.length)})`
      : "";
  const ownedTrackClause =
    ownedTrackIds.length > 0
      ? `AND t.TrackId NOT IN (${placeholders(ownedTrackIds.length)})`
      : "";
  const result = await db.execute({
    sql: `
      SELECT t.TrackId, t.Name, a.ArtistId, a.Name AS ArtistName,
        g.GenreId, g.Name AS GenreName, t.UnitPrice
      FROM Track t
      INNER JOIN Album al ON t.AlbumId = al.AlbumId
      INNER JOIN Artist a ON al.ArtistId = a.ArtistId
      INNER JOIN Genre g ON t.GenreId = g.GenreId
      WHERE g.GenreId = ?
        ${ownedArtistClause}
        ${ownedTrackClause}
      ORDER BY t.UnitPrice DESC
      LIMIT 10
    `,
    args: [genreId, ...ownedArtistIds, ...ownedTrackIds],
  });
  return result.rows as unknown as Candidate[];
}
