import { createClient } from "@libsql/client";

export async function GET() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const result = await client.execute("SELECT COUNT(*) as count FROM Track");

  return Response.json({ trackCount: result.rows[0].count });
}
