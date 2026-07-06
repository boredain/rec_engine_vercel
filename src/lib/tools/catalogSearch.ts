import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";
import { runReadOnlyQuery } from "../formatQueryResult";

const CUSTOMER_TABLES = ["invoice", "invoiceline", "customer", "employee"];

export const catalogSearch = tool({
  description:
    "Run a read-only SQL query against catalog tables only (Track, Album, Artist, " +
    "Genre, MediaType, Playlist, PlaylistTrack). No customer filtering required. " +
    "Use this to fetch catalog data such as all available genres, or to search " +
    "tracks by artist or album without needing a customer scope. " +
    "Do NOT use for customer data - use generalQuery for invoices and purchase history.",
  inputSchema: z.object({
    query: z.string().describe("The SQL query to execute"),
  }),
  execute: async ({ query }) => {
    const queryLower = query.toLowerCase();
    for (const table of CUSTOMER_TABLES) {
      if (queryLower.includes(table)) {
        return (
          `Error: catalogSearch cannot query customer tables (${table}). ` +
          "Use generalQuery for customer data."
        );
      }
    }
    return runReadOnlyQuery(db, query);
  },
});
