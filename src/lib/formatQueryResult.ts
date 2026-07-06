import type { ResultSet } from "@libsql/client";

export async function runReadOnlyQuery(
  db: { execute: (query: string) => Promise<ResultSet> },
  query: string,
): Promise<string> {
  try {
    const result = await db.execute(query);
    if (result.rows.length === 0) {
      return "No results found.";
    }
    const keys = result.columns;
    const lines = [keys.join(" | ")];
    for (const row of result.rows) {
      lines.push(keys.map((k) => String(row[k])).join(" | "));
    }
    return lines.join("\n");
  } catch (e) {
    return `Query error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
