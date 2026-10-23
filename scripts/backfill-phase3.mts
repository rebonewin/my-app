#!/usr/bin/env node
/**
 * Phase 3 legacy backfill.
 *
 * Historical scans predate the asset inventory. This script groups them by
 * (user, organization, hostname), creates one asset per group, attaches every
 * historical scan, derives normalized findings + SSL snapshots from stored
 * result payloads, and refreshes the asset risk/last-scan summary.
 *
 * Safe to re-run: findings use their asset+fingerprint unique index, scan
 * snapshots use scan+fingerprint, and SSL snapshots are guarded by scan id.
 *
 * Usage:
 *   npm run backfill:phase3
 *   npm run backfill:phase3 -- --dry-run
 */
import crypto from "node:crypto";
import postgres from "postgres";

import { generateFindings } from "../services/scanner/findings";
import type { ScanResult } from "../types/scan";
import type { ScanModule } from "../types/scanner";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) is required. Load .env.local first.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const sql = postgres(url, {
  prepare: false,
  max: 1,
  connect_timeout: 20,
  idle_timeout: 5,
});

interface ScanRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  asset_id: string | null;
  target: string;
  hostname: string | null;
  status: string;
  risk_level: string | null;
  risk_score: number;
  security_score: number;
  finding_count: number;
  results: ScanResult | null;
  created_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
}

interface AssetRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  domain: string;
}

function hostnameFor(row: ScanRow): string {
  if (row.hostname?.trim()) return row.hostname.trim().toLowerCase();
  try {
    return new URL(row.target).hostname.toLowerCase();
  } catch {
    return row.target.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }
}

function modulesFor(result: ScanResult): ScanModule[] {
  const modules: ScanModule[] = ["http", "headers", "technology", "compliance"];
  if (result.ssl) modules.push("tls");
  if (result.cookieAnalysis) modules.push("cookies");
  if (result.cors) modules.push("cors");
  if (result.robots) modules.push("robots");
  if (Array.isArray(result.ports) && result.ports.length > 0) {
    modules.push("ports");
  }
  return modules;
}

function severityCounts(
  findings: ReturnType<typeof generateFindings>,
): Record<"critical" | "high" | "medium" | "low", number> {
  return findings.reduce(
    (acc, item) => {
      if (item.severity === "critical") acc.critical += 1;
      else if (item.severity === "high") acc.high += 1;
      else if (item.severity === "medium") acc.medium += 1;
      else if (item.severity === "low") acc.low += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

async function main() {
  const scans = await sql<ScanRow[]>`
    SELECT id, user_id, organization_id, asset_id, target, hostname, status,
           risk_level, risk_score, security_score, finding_count, results,
           created_at, completed_at, duration_ms
    FROM "scan"
    ORDER BY created_at ASC
  `;

  console.log(`Loaded ${scans.length} scans.${dryRun ? " (dry run)" : ""}`);

  const assets = await sql<AssetRow[]>`
    SELECT id, user_id, organization_id, domain FROM "asset"
  `;
  const assetKey = (userId: string, orgId: string | null, domain: string) =>
    `${userId}|${orgId ?? ""}|${domain.toLowerCase()}`;
  const existingAssets = new Map(
    assets.map((row) => [assetKey(row.user_id, row.organization_id, row.domain), row]),
  );

  const groups = new Map<string, ScanRow[]>();
  for (const row of scans) {
    const hostname = hostnameFor(row);
    if (!hostname) continue;
    const key = assetKey(row.user_id, row.organization_id, hostname);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  let createdAssets = 0;
  let attachedScans = 0;
  let createdFindings = 0;
  let createdSnapshots = 0;
  let createdSsl = 0;

  await sql.begin(async (tx) => {
    for (const [key, group] of groups) {
      const first = group[0];
      const hostname = hostnameFor(first);
      const latest = group[group.length - 1];
      let asset = existingAssets.get(key);

      if (!asset) {
        asset = {
          id: crypto.randomUUID(),
          user_id: first.user_id,
          organization_id: first.organization_id,
          domain: hostname,
        };
        existingAssets.set(key, asset);
        createdAssets += 1;

        if (!dryRun) {
          await tx`
            INSERT INTO "asset"
              (id, user_id, organization_id, name, target_url, domain, type,
               environment, criticality, tags, description, status, created_at, updated_at)
            VALUES
              (${asset.id}, ${first.user_id}, ${first.organization_id}, ${hostname},
               ${latest.target}, ${hostname}, 'website', 'production', 'medium',
               ${tx.json(["imported", "scan-history"])},
               'Imported from historical scan data.', 'active', ${latest.created_at}, now())
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }

      let latestRiskLevel = "unknown";
      let latestRiskScore = 0;
      let latestScanAt: Date | null = null;
      let latestScanId: string | null = null;
      let sslIssuer: string | null = null;
      let sslExpiresAt: Date | null = null;

      for (const row of group) {
        const result = row.results;
        const completed = row.status === "completed" && result;
        const modules = result ? modulesFor(result) : [];
        const generated = completed && result ? generateFindings(result, modules) : [];
        const counts = severityCounts(generated);
        const startedAt =
          row.created_at.getTime() - (row.duration_ms ?? 0) > 0
            ? new Date(row.created_at.getTime() - (row.duration_ms ?? 0))
            : row.created_at;

        if (!row.asset_id) attachedScans += 1;

        if (!dryRun) {
          await tx`
            UPDATE "scan"
            SET asset_id = ${asset.id},
                profile_name = COALESCE(profile_name, 'Legacy assessment'),
                profile_modules = ${tx.json(modules)},
                progress = CASE WHEN ${row.status} = 'completed' THEN 100
                                WHEN ${row.status} = 'failed' THEN 100
                                WHEN ${row.status} = 'cancelled' THEN 100
                                ELSE progress END,
                current_module = CASE WHEN ${row.status} = 'completed' THEN 'Completed'
                                      WHEN ${row.status} = 'failed' THEN 'Failed'
                                      WHEN ${row.status} = 'cancelled' THEN 'Cancelled'
                                      ELSE current_module END,
                security_score = CASE WHEN ${row.security_score} > 0 THEN ${row.security_score}
                                      WHEN ${completed ? (result?.securityScore ?? 0) : 0} > 0 THEN ${result?.securityScore ?? 0}
                                      ELSE GREATEST(0, 100 - ${row.risk_score}) END,
                critical_count = ${counts.critical},
                started_at = COALESCE(started_at, ${startedAt})
            WHERE id = ${row.id}
          `;
        }

        if (completed && result) {
          for (const item of generated) {
            const now = row.completed_at ?? row.created_at;
            if (!dryRun) {
              const [findingRow] = await tx<{ id: string }[]>`
                INSERT INTO "finding"
                  (id, user_id, organization_id, asset_id, last_scan_id, fingerprint,
                   title, description, severity, category, status, cvss, evidence,
                   remediation, first_seen_at, last_seen_at, created_at, updated_at)
                VALUES
                  (${crypto.randomUUID()}, ${row.user_id}, ${row.organization_id},
                   ${asset.id}, ${row.id}, ${item.fingerprint}, ${item.title},
                   ${item.description}, ${item.severity}, ${item.category}, 'open',
                   ${item.cvss}, ${tx.json(item.evidence as postgres.JSONValue)}, ${item.remediation},
                   ${row.created_at}, ${now}, ${row.created_at}, ${now})
                ON CONFLICT (asset_id, fingerprint) DO UPDATE SET
                  last_scan_id = excluded.last_scan_id,
                  title = excluded.title,
                  description = excluded.description,
                  severity = excluded.severity,
                  category = excluded.category,
                  cvss = excluded.cvss,
                  evidence = excluded.evidence,
                  remediation = excluded.remediation,
                  last_seen_at = excluded.last_seen_at,
                  updated_at = excluded.updated_at
                RETURNING id
              `;

              if (findingRow) {
                await tx`
                  INSERT INTO "scan_finding"
                    (id, scan_id, finding_id, asset_id, fingerprint, title,
                     severity, category, cvss, created_at)
                  VALUES
                    (${crypto.randomUUID()}, ${row.id}, ${findingRow.id},
                     ${asset.id}, ${item.fingerprint}, ${item.title},
                     ${item.severity}, ${item.category}, ${item.cvss}, ${now})
                  ON CONFLICT (scan_id, fingerprint) DO NOTHING
                `;
                createdFindings += 1;
                createdSnapshots += 1;
              }
            }
          }

          if (result.ssl?.enabled) {
            if (!dryRun) {
              const inserted = await tx`
                INSERT INTO "ssl_snapshot"
                  (id, scan_id, asset_id, issuer, valid_from, valid_to,
                   days_remaining, protocol, created_at)
                SELECT ${crypto.randomUUID()}, ${row.id}, ${asset.id},
                       ${result.ssl.issuer ?? null},
                       ${result.ssl.validFrom ? new Date(result.ssl.validFrom) : null},
                       ${result.ssl.validTo ? new Date(result.ssl.validTo) : null},
                       ${result.ssl.daysRemaining ?? null},
                       ${result.ssl.protocol ?? null}, ${row.completed_at ?? row.created_at}
                WHERE NOT EXISTS (
                  SELECT 1 FROM "ssl_snapshot"
                  WHERE scan_id = ${row.id} AND asset_id = ${asset.id}
                )
                RETURNING id
              `;
              if (inserted.length > 0) createdSsl += 1;
            }
          }
        }

        latestRiskLevel = row.risk_level ?? latestRiskLevel;
        latestRiskScore = row.risk_score;
        latestScanAt = row.completed_at ?? row.created_at;
        latestScanId = row.id;

        if (result?.ssl?.enabled) {
          sslIssuer = result.ssl.issuer ?? sslIssuer;
          sslExpiresAt = result.ssl.validTo
            ? new Date(result.ssl.validTo)
            : sslExpiresAt;
        }
      }

      if (!dryRun) {
        const [open] = await tx<{ count: number }[]>`
          SELECT count(*)::int AS count FROM "finding"
          WHERE asset_id = ${asset.id} AND status IN ('open', 'in-progress')
        `;

        await tx`
          UPDATE "asset"
          SET risk_score = ${latestRiskScore},
              risk_level = ${latestRiskLevel},
              open_findings = ${open?.count ?? 0},
              last_scan_at = ${latestScanAt},
              last_scan_id = ${latestScanId},
              ssl_issuer = COALESCE(${sslIssuer}, ssl_issuer),
              ssl_expires_at = COALESCE(${sslExpiresAt}, ssl_expires_at),
              updated_at = now()
          WHERE id = ${asset.id}
        `;
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        scans: scans.length,
        assetGroups: groups.size,
        createdAssets,
        attachedScans,
        findingsProcessed: createdFindings,
        scanSnapshots: createdSnapshots,
        sslSnapshots: createdSsl,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Phase 3 backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
