import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and configure your Supabase connection string.",
  );
}

/**
 * Supabase's transaction pooler (pgbouncer, port 6543) does not support
 * prepared statements. `prepare: false` is required or every query fails
 * intermittently under load.
 */
const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });

export { client as sqlClient };
export * from "./schema";
