import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `DIRECT_URL` (session-mode pooler, port 5432) is used for migrations.
 * The transaction pooler on 6543 cannot hold the session-scoped advisory lock
 * that DDL migrations require.
 */
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DIRECT_URL (or DATABASE_URL) is required for drizzle-kit. Load .env.local first.",
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: false,
});
