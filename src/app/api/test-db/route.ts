// A standalone health-check endpoint - GET /api/test-db. Not called anywhere
// in the UI; it exists purely so the developer can hit it manually (e.g. via
// browser or curl) to confirm the Turso database connection is configured
// correctly, independent of the chat flow.
import { createClient } from "@libsql/client";

export async function GET() {
  // Opens its own connection rather than importing the shared client from
  // src/lib/db.ts - this endpoint is meant to verify the raw env vars work,
  // isolated from the rest of the app's setup.
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const result = await client.execute("SELECT COUNT(*) as count FROM Track");

  return Response.json({ trackCount: result.rows[0].count });
}
