#!/usr/bin/env node
/**
 * Phase 3 schema migration: asset inventory, scan orchestration and findings.
 *
 * The script is intentionally idempotent. It is safe to run on a database that
 * already contains some or all of these objects (for example a preview branch
 * created with `drizzle-kit push`).
 *
 * Usage:
 *   npm run migrate:phase3
 */
import postgres from "postgres";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) is required. Load .env.local first.");
  process.exit(1);
}

const sql = postgres(url, {
  prepare: false,
  max: 1,
  connect_timeout: 20,
  idle_timeout: 5,
});

const statements = [
  /* ---------------------------------------------------------------------- */
  /* Assets                                                                  */
  /* ---------------------------------------------------------------------- */
  `CREATE TABLE IF NOT EXISTS "asset" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "organization_id" text REFERENCES "organization"("id") ON DELETE set null,
    "name" text NOT NULL,
    "target_url" text NOT NULL,
    "domain" text NOT NULL,
    "ip_address" text,
    "type" varchar(32) DEFAULT 'website' NOT NULL,
    "environment" varchar(24) DEFAULT 'production' NOT NULL,
    "criticality" varchar(16) DEFAULT 'medium' NOT NULL,
    "owner" text,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "description" text,
    "status" varchar(16) DEFAULT 'active' NOT NULL,
    "risk_score" integer DEFAULT 0 NOT NULL,
    "risk_level" varchar(16) DEFAULT 'unknown' NOT NULL,
    "open_findings" integer DEFAULT 0 NOT NULL,
    "last_scan_at" timestamp with time zone,
    "last_scan_id" text,
    "ssl_expires_at" timestamp with time zone,
    "ssl_issuer" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "asset_user_id_idx" ON "asset" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "asset_organization_id_idx" ON "asset" ("organization_id")`,
  `CREATE INDEX IF NOT EXISTS "asset_status_idx" ON "asset" ("status")`,
  `CREATE INDEX IF NOT EXISTS "asset_risk_idx" ON "asset" ("risk_level")`,
  `CREATE INDEX IF NOT EXISTS "asset_domain_idx" ON "asset" ("domain")`,
  `CREATE INDEX IF NOT EXISTS "asset_last_scan_idx" ON "asset" ("last_scan_at")`,

  /* ---------------------------------------------------------------------- */
  /* Custom scan profiles                                                    */
  /* ---------------------------------------------------------------------- */
  `CREATE TABLE IF NOT EXISTS "scan_profile" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text REFERENCES "user"("id") ON DELETE cascade,
    "organization_id" text REFERENCES "organization"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "description" text,
    "modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "scan_profile_user_idx" ON "scan_profile" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "scan_profile_org_idx" ON "scan_profile" ("organization_id")`,

  /* ---------------------------------------------------------------------- */
  /* Extend the existing scan table in place (history is preserved)          */
  /* ---------------------------------------------------------------------- */
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "asset_id" text`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "profile_id" text`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "profile_name" text`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "profile_modules" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "current_module" text`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "security_score" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "critical_count" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone`,
  `ALTER TABLE "scan" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone`,

  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'scan_asset_id_asset_id_fk'
    ) THEN
      ALTER TABLE "scan"
        ADD CONSTRAINT "scan_asset_id_asset_id_fk"
        FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE set null;
    END IF;
  END $$`,

  `CREATE INDEX IF NOT EXISTS "scan_asset_id_idx" ON "scan" ("asset_id")`,
  `CREATE INDEX IF NOT EXISTS "scan_profile_id_idx" ON "scan" ("profile_id")`,

  /* ---------------------------------------------------------------------- */
  /* Normalized findings                                                     */
  /* ---------------------------------------------------------------------- */
  `CREATE TABLE IF NOT EXISTS "finding" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "organization_id" text REFERENCES "organization"("id") ON DELETE set null,
    "asset_id" text NOT NULL REFERENCES "asset"("id") ON DELETE cascade,
    "last_scan_id" text REFERENCES "scan"("id") ON DELETE set null,
    "fingerprint" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "severity" varchar(16) DEFAULT 'medium' NOT NULL,
    "category" varchar(48) DEFAULT 'general' NOT NULL,
    "status" varchar(16) DEFAULT 'open' NOT NULL,
    "cvss" double precision DEFAULT 0 NOT NULL,
    "evidence" jsonb,
    "remediation" text,
    "assigned_to" text,
    "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "finding_asset_fingerprint_idx" ON "finding" ("asset_id", "fingerprint")`,
  `CREATE INDEX IF NOT EXISTS "finding_user_id_idx" ON "finding" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "finding_organization_id_idx" ON "finding" ("organization_id")`,
  `CREATE INDEX IF NOT EXISTS "finding_scan_idx" ON "finding" ("last_scan_id")`,
  `CREATE INDEX IF NOT EXISTS "finding_severity_idx" ON "finding" ("severity")`,
  `CREATE INDEX IF NOT EXISTS "finding_status_idx" ON "finding" ("status")`,
  `CREATE INDEX IF NOT EXISTS "finding_last_seen_idx" ON "finding" ("last_seen_at")`,

  /* ---------------------------------------------------------------------- */
  /* Per-scan finding snapshots and SSL observations                         */
  /* ---------------------------------------------------------------------- */
  `CREATE TABLE IF NOT EXISTS "scan_finding" (
    "id" text PRIMARY KEY NOT NULL,
    "scan_id" text NOT NULL REFERENCES "scan"("id") ON DELETE cascade,
    "finding_id" text REFERENCES "finding"("id") ON DELETE set null,
    "asset_id" text REFERENCES "asset"("id") ON DELETE cascade,
    "fingerprint" text NOT NULL,
    "title" text NOT NULL,
    "severity" varchar(16) DEFAULT 'medium' NOT NULL,
    "category" varchar(48) DEFAULT 'general' NOT NULL,
    "cvss" double precision DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "scan_finding_scan_fingerprint_idx" ON "scan_finding" ("scan_id", "fingerprint")`,
  `CREATE INDEX IF NOT EXISTS "scan_finding_asset_idx" ON "scan_finding" ("asset_id")`,
  `CREATE INDEX IF NOT EXISTS "scan_finding_finding_idx" ON "scan_finding" ("finding_id")`,

  `CREATE TABLE IF NOT EXISTS "ssl_snapshot" (
    "id" text PRIMARY KEY NOT NULL,
    "scan_id" text NOT NULL REFERENCES "scan"("id") ON DELETE cascade,
    "asset_id" text NOT NULL REFERENCES "asset"("id") ON DELETE cascade,
    "issuer" text,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "days_remaining" integer,
    "protocol" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "ssl_snapshot_asset_idx" ON "ssl_snapshot" ("asset_id")`,
  `CREATE INDEX IF NOT EXISTS "ssl_snapshot_scan_idx" ON "ssl_snapshot" ("scan_id")`,
  `CREATE INDEX IF NOT EXISTS "ssl_snapshot_created_idx" ON "ssl_snapshot" ("created_at")`,
];

console.log(`Applying Phase 3 migration (${statements.length} statements)...`);

try {
  await sql.begin(async (tx) => {
    for (const statement of statements) {
      await tx.unsafe(statement);
    }
  });

  const verification = await txVerify();
  console.log("Phase 3 migration applied successfully.");
  console.log(JSON.stringify(verification, null, 2));
} catch (error) {
  console.error("Phase 3 migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

async function txVerify() {
  const tables = await sql.unsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('asset','scan_profile','finding','scan_finding','ssl_snapshot')
     ORDER BY table_name`,
  );
  const columns = await sql.unsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'scan'
       AND column_name IN ('asset_id','profile_id','profile_name','profile_modules','progress','current_module','security_score','critical_count','started_at','cancelled_at')
     ORDER BY column_name`,
  );

  return {
    tables: tables.map((row) => row.table_name),
    scanColumns: columns.map((row) => row.column_name),
  };
}
