import { generateObject, tool } from "ai";
import { z } from "zod";
import { gateway } from "@ai-sdk/gateway";
import { DEMO_CUSTOMER_ID } from "../config";
import {
  getGenreList,
  getTopGenres,
  getOwnedArtistIds,
  getOwnedTrackIds,
  getPlaylistIdsForTracks,
  getCoOccurrenceCandidates,
  getGenreOwnedArtistFallback,
  getGenreNewArtistFallback,
} from "../recommendations/queries";
import { tierFromCoOccurrence, tagTier, type RankedPick } from "../recommendations/rank";
import { getParseIntentPrompt, getExplainPicksPrompt } from "../prompts/recommendations";

const recommendationItemSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  genre: z.string(),
  price: z.number(),
  why: z.string(),
});

export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

export const getRecommendations = tool({
  description:
    "Generates personalized track recommendations based on the customer's purchase history. " +
    "Call this when the customer asks for recommendations, suggestions, what to listen to " +
    "next, or anything resembling music discovery.",
  inputSchema: z.object({
    customerMessage: z
      .string()
      .describe("The customer's original message, copied verbatim"),
  }),
  execute: async ({ customerMessage }) => {
    const genreList = await getGenreList();

    // The only judgment call that genuinely needs a model: did the customer
    // mention a specific genre/mood, or is this a generic request? Everything
    // downstream is deterministic (see queries.ts + rank.ts).
    const { object: intent } = await generateObject({
      model: gateway("anthropic/claude-haiku-4.5"),
      schema: z.object({
        statedGenreId: z
          .number()
          .nullable()
          .describe(
            "GenreId matching a genre/mood the customer explicitly mentioned, or null if generic",
          ),
      }),
      system: getParseIntentPrompt(genreList),
      prompt: customerMessage,
      telemetry: { isEnabled: true, functionId: "recommendations-parse-intent" },
    });

    const [topGenres, ownedArtists, ownedTrackIds] = await Promise.all([
      getTopGenres(DEMO_CUSTOMER_ID),
      getOwnedArtistIds(DEMO_CUSTOMER_ID),
      getOwnedTrackIds(DEMO_CUSTOMER_ID),
    ]);

    const targetGenreId = intent.statedGenreId ?? topGenres[0]?.GenreId;
    const ownedArtistIdList = ownedArtists.map((a) => a.ArtistId);
    const ownedArtistIdSet = new Set(ownedArtistIdList);

    let picks: RankedPick[] = [];

    if (targetGenreId !== undefined) {
      const playlistIds = await getPlaylistIdsForTracks(ownedTrackIds);
      const round3 = await getCoOccurrenceCandidates(playlistIds, ownedTrackIds);
      picks = tierFromCoOccurrence(round3, ownedArtistIdSet).slice(0, 5);

      if (picks.length < 5) {
        const round4 = await getGenreOwnedArtistFallback(
          targetGenreId,
          ownedArtistIdList,
          ownedTrackIds,
        );
        picks = [...picks, ...tagTier(round4, 3)].slice(0, 5);
      }
      if (picks.length < 5) {
        const round5 = await getGenreNewArtistFallback(
          targetGenreId,
          ownedArtistIdList,
          ownedTrackIds,
        );
        picks = [...picks, ...tagTier(round5, 4)].slice(0, 5);
      }
    }

    if (picks.length === 0) {
      return { recommendations: [] };
    }

    // Track name/artist/price/genre are echoed straight from the DB rows
    // below - the model only ever generates the "why" text, so it has no
    // opportunity to hallucinate a track that doesn't exist or misquote a
    // price.
    const { object: explained } = await generateObject({
      model: gateway("anthropic/claude-haiku-4.5"),
      schema: z.object({
        whys: z.array(z.string()).length(picks.length),
      }),
      system: getExplainPicksPrompt(),
      prompt: JSON.stringify({
        customerMessage,
        topGenre: topGenres[0]?.Name,
        topArtist: ownedArtists[0]?.Name,
        picks: picks.map((p) => ({
          trackName: p.Name,
          artistName: p.ArtistName,
          genre: p.GenreName,
          tier: p.tier,
          coOccurrenceCount: p.CoOccurrenceCount ?? null,
        })),
      }),
      telemetry: { isEnabled: true, functionId: "recommendations-explain-picks" },
    });

    const recommendations: RecommendationItem[] = picks.map((p, i) => ({
      trackName: p.Name,
      artistName: p.ArtistName,
      genre: p.GenreName,
      price: p.UnitPrice,
      why: explained.whys[i],
    }));

    return { recommendations };
  },
});
