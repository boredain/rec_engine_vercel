import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";

export const getSchema = tool({
  description:
    "Get database schema information. Call with no arguments to list all " +
    "available tables. Call with a table name to get column details and " +
    "foreign key relationships for that table. Always call this before " +
    "writing any SQL query.",
  inputSchema: z.object({
    tableName: z
      .string()
      .optional()
      .describe("The table to inspect; omit to list all tables"),
  }),
  execute: async ({ tableName }) => {
    if (!tableName) {
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      );
      return result.rows.map((r) => r.name).join("\n");
    }

    const cols = await db.execute(`PRAGMA table_info(${tableName})`);
    const fks = await db.execute(`PRAGMA foreign_key_list(${tableName})`);

    const lines = [`Table: ${tableName}`, "Columns:"];
    for (const col of cols.rows) {
      const pk = col.pk ? " (PK)" : "";
      const notnull = col.notnull ? " NOT NULL" : "";
      lines.push(`  ${col.name} ${col.type}${pk}${notnull}`);
    }
    if (fks.rows.length > 0) {
      lines.push("Foreign Keys:");
      for (const fk of fks.rows) {
        lines.push(`  ${fk.from} -> ${fk.table}.${fk.to}`);
      }
    }
    return lines.join("\n");
  },
});
