import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";
import { runReadOnlyQuery } from "../formatQueryResult";
import { DEMO_CUSTOMER_ID } from "../config";

export const generalQuery = tool({
  description:
    "Run a read-only SQL query against the Chinook music store database. " +
    `Always include 'CustomerId = ${DEMO_CUSTOMER_ID}' somewhere in the query to scope ` +
    "results to the current customer. For customer-specific lookups (invoices, " +
    "purchase history), filter the main WHERE clause by CustomerId. For catalog " +
    "searches (artist, genre, album), put CustomerId in a NOT IN subquery to " +
    "exclude tracks the customer already owns.",
  inputSchema: z.object({
    query: z.string().describe("The SQL query to execute"),
  }),
  execute: async ({ query }) => {
    if (!query.includes(`CustomerId = ${DEMO_CUSTOMER_ID}`)) {
      return (
        `Error: query must filter by CustomerId = ${DEMO_CUSTOMER_ID}. ` +
        "Always scope queries to the current customer."
      );
    }
    return runReadOnlyQuery(db, query);
  },
});
