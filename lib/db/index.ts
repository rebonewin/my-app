import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;
type Sql = ReturnType<typeof postgres>;

let _client: Sql | undefined;
let _db: Db | undefined;

/**
 * Builds (and caches) the Drizzle client on first use.
 *
 * The connection string is read lazily so importing this module — which the
 * production build does for every route and static page — never requires
 * `DATABASE_URL` to be present at build time. The clear validation error is
 * raised only when a query actually needs a connection.
 */
function getDb(): Db {
  if (_db) return _db;

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
  _client = postgres(connectionString, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // Recycle checked-out sockets periodically. A request aborted mid-query
    // can leave a backend waiting on `ClientRead`; without a lifetime cap that
    // slot stays occupied and the pool slowly starves.
    max_lifetime: 60 * 10,
  });
  _db = drizzle(_client, { schema });
  return _db;
}

function getSql(): Sql {
  getDb();
  return _client as Sql;
}

/**
 * Proxy over the lazily-created Drizzle instance. Methods are bound to the real
 * instance so existing query chains (`db.select().from().where()`) behave
 * exactly as before.
 */
export const db = new Proxy({} as Db, {
  get(_target, property: keyof Db) {
    const real = getDb() as unknown as Record<keyof Db, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const sqlClient = new Proxy(function () {} as unknown as Sql, {
  get(_target, property) {
    const real = getSql() as unknown as Record<PropertyKey, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
  apply(_target, _thisArg, args) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
});

export * from "./schema";
