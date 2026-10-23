import "server-only";

import { promises as dns } from "dns";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { asset, finding, scan, sslSnapshot } from "@/lib/db/schema";
import {
  assetScopeFilter,
  findingScopeFilter,
  scanScopeFilter,
  type TenantScope,
} from "@/lib/tenancy";
import type {
  AssetCriticality,
  AssetDashboardData,
  AssetDetailData,
  AssetEnvironment,
  AssetInput,
  AssetListFilters,
  AssetRecord,
  AssetRiskLevel,
  AssetSelectOption,
  AssetStatus,
  AssetType,
} from "@/types/assets";
import type { Severity } from "@/types/dashboard";

export class AssetConflictError extends Error {}

export function normalizeTargetUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function targetDomain(value: string): string {
  try {
    return new URL(normalizeTargetUrl(value)).hostname;
  } catch {
    return value;
  }
}

async function resolveAddress(hostname: string): Promise<string | null> {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records[0]?.address ?? null;
  } catch {
    return null;
  }
}

function toRecord(row: typeof asset.$inferSelect): AssetRecord {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.targetUrl,
    domain: row.domain,
    ipAddress: row.ipAddress,
    type: row.type as AssetType,
    environment: row.environment as AssetEnvironment,
    criticality: row.criticality as AssetCriticality,
    owner: row.owner,
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description,
    status: row.status as AssetStatus,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel as AssetRiskLevel,
    openFindings: row.openFindings,
    lastScanAt: row.lastScanAt?.toISOString() ?? null,
    lastScanId: row.lastScanId,
    sslExpiresAt: row.sslExpiresAt?.toISOString() ?? null,
    sslIssuer: row.sslIssuer,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssets(
  scope: TenantScope,
  filters: AssetListFilters = {},
): Promise<{ items: AssetRecord[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 12));
  const conditions: SQL[] = [assetScopeFilter(scope)];

  if (filters.query?.trim()) {
    const pattern = `%${filters.query.trim()}%`;
    const search = or(
      ilike(asset.name, pattern),
      ilike(asset.targetUrl, pattern),
      ilike(asset.domain, pattern),
      ilike(asset.owner, pattern),
    );
    if (search) conditions.push(search);
  }
  if (filters.type) conditions.push(eq(asset.type, filters.type));
  if (filters.environment) {
    conditions.push(eq(asset.environment, filters.environment));
  }
  if (filters.criticality) {
    conditions.push(eq(asset.criticality, filters.criticality));
  }
  if (filters.status) conditions.push(eq(asset.status, filters.status));
  if (filters.riskLevel) conditions.push(eq(asset.riskLevel, filters.riskLevel));

  const where = and(...conditions);

  const orderBy = (() => {
    switch (filters.sort) {
      case "name":
        return asc(asset.name);
      case "risk":
        return desc(asset.riskScore);
      case "criticality":
        return sql`case ${asset.criticality}
          when 'critical' then 4 when 'high' then 3
          when 'medium' then 2 else 1 end desc`;
      case "last-scan":
        return desc(asset.lastScanAt);
      default:
        return desc(asset.createdAt);
    }
  })();

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(asset)
      .where(where)
      .orderBy(orderBy, desc(asset.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(asset).where(where),
  ]);

  return {
    items: rows.map(toRecord),
    total: count?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getAsset(
  scope: TenantScope,
  id: string,
): Promise<AssetRecord | null> {
  const [row] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.id, id), assetScopeFilter(scope)))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function createAsset(
  scope: TenantScope,
  input: AssetInput,
): Promise<AssetRecord> {
  const targetUrl = normalizeTargetUrl(input.targetUrl);
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https targets are supported.");
  }
  parsed.hash = "";
  const normalizedUrl = parsed.toString();
  const domain = parsed.hostname;

  const [existing] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        assetScopeFilter(scope),
        eq(asset.targetUrl, normalizedUrl),
      ),
    )
    .limit(1);
  if (existing) {
    throw new AssetConflictError("An asset with this target already exists.");
  }

  const ipAddress = await resolveAddress(domain);

  const [row] = await db
    .insert(asset)
    .values({
      id: crypto.randomUUID(),
      userId: scope.userId,
      organizationId: scope.organizationId,
      name: input.name.trim(),
      targetUrl: normalizedUrl,
      domain,
      ipAddress,
      type: input.type,
      environment: input.environment,
      criticality: input.criticality,
      owner: input.owner?.trim() || null,
      tags: input.tags,
      description: input.description?.trim() || null,
      status: input.status,
    })
    .returning();

  return toRecord(row);
}

export async function updateAsset(
  scope: TenantScope,
  id: string,
  input: AssetInput,
): Promise<AssetRecord | null> {
  const current = await getAsset(scope, id);
  if (!current) return null;

  const targetUrl = normalizeTargetUrl(input.targetUrl);
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https targets are supported.");
  }
  parsed.hash = "";
  const normalizedUrl = parsed.toString();
  const domain = parsed.hostname;

  const [conflict] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        assetScopeFilter(scope),
        eq(asset.targetUrl, normalizedUrl),
      ),
    )
    .limit(1);
  if (conflict && conflict.id !== id) {
    throw new AssetConflictError("An asset with this target already exists.");
  }

  const ipAddress =
    domain !== current.domain ? await resolveAddress(domain) : current.ipAddress;

  const [row] = await db
    .update(asset)
    .set({
      name: input.name.trim(),
      targetUrl: normalizedUrl,
      domain,
      ipAddress,
      type: input.type,
      environment: input.environment,
      criticality: input.criticality,
      owner: input.owner?.trim() || null,
      tags: input.tags,
      description: input.description?.trim() || null,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(and(eq(asset.id, id), assetScopeFilter(scope)))
    .returning();

  return row ? toRecord(row) : null;
}

export async function deleteAsset(
  scope: TenantScope,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(asset)
    .where(and(eq(asset.id, id), assetScopeFilter(scope)))
    .returning({ id: asset.id });
  return deleted.length > 0;
}

export async function getAssetDashboard(
  scope: TenantScope,
): Promise<AssetDashboardData> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
  const thirtyDaysAhead = new Date(now + 30 * 86_400_000);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${asset.status} = 'active')::int`,
      atRisk: sql<number>`count(*) filter (where ${asset.riskLevel} in ('critical', 'high'))::int`,
      recentlyAdded: sql<number>`count(*) filter (where ${asset.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz)::int`,
      expiringSsl: sql<number>`count(*) filter (where ${asset.sslExpiresAt} is not null and ${asset.sslExpiresAt} <= ${thirtyDaysAhead.toISOString()}::timestamptz)::int`,
    })
    .from(asset)
    .where(assetScopeFilter(scope));

  const [scanCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(scan)
    .where(
      and(
        scanScopeFilter(scope),
        gte(scan.createdAt, thirtyDaysAgo),
      ),
    );

  const [recentRows, riskyRows, expiringRows] = await Promise.all([
    db
      .select()
      .from(asset)
      .where(assetScopeFilter(scope))
      .orderBy(desc(asset.createdAt))
      .limit(5),
    db
      .select()
      .from(asset)
      .where(and(assetScopeFilter(scope), eq(asset.status, "active")))
      .orderBy(desc(asset.riskScore), desc(asset.lastScanAt))
      .limit(5),
    db
      .select()
      .from(asset)
      .where(
        and(
          assetScopeFilter(scope),
          lte(asset.sslExpiresAt, thirtyDaysAhead),
        ),
      )
      .orderBy(asc(asset.sslExpiresAt))
      .limit(5),
  ]);

  return {
    stats: {
      total: counts?.total ?? 0,
      active: counts?.active ?? 0,
      atRisk: counts?.atRisk ?? 0,
      recentlyAdded: counts?.recentlyAdded ?? 0,
      expiringSsl: counts?.expiringSsl ?? 0,
      scansLast30Days: scanCount?.total ?? 0,
    },
    recentAssets: recentRows.map(toRecord),
    highestRiskAssets: riskyRows.map(toRecord),
    expiringSslAssets: expiringRows.map(toRecord),
  };
}

export async function getAssetDetail(
  scope: TenantScope,
  id: string,
): Promise<AssetDetailData | null> {
  const record = await getAsset(scope, id);
  if (!record) return null;

  const [scanRows, findingRows, sslRows] = await Promise.all([
    db
      .select({
        id: scan.id,
        status: scan.status,
        profileName: scan.profileName,
        riskLevel: scan.riskLevel,
        riskScore: scan.riskScore,
        securityScore: scan.securityScore,
        findingCount: scan.findingCount,
        criticalCount: scan.criticalCount,
        highCount: scan.highCount,
        mediumCount: scan.mediumCount,
        lowCount: scan.lowCount,
        durationMs: scan.durationMs,
        createdAt: scan.createdAt,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
      })
      .from(scan)
      .where(and(eq(scan.assetId, id), scanScopeFilter(scope)))
      .orderBy(desc(scan.createdAt))
      .limit(24),
    db
      .select({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        category: finding.category,
        cvss: finding.cvss,
        firstSeenAt: finding.firstSeenAt,
        lastSeenAt: finding.lastSeenAt,
      })
      .from(finding)
      .where(and(eq(finding.assetId, id), findingScopeFilter(scope)))
      .orderBy(desc(finding.lastSeenAt))
      .limit(50),
    db
      .select({
        id: sslSnapshot.id,
        issuer: sslSnapshot.issuer,
        validFrom: sslSnapshot.validFrom,
        validTo: sslSnapshot.validTo,
        daysRemaining: sslSnapshot.daysRemaining,
        protocol: sslSnapshot.protocol,
        createdAt: sslSnapshot.createdAt,
      })
      .from(sslSnapshot)
      .where(eq(sslSnapshot.assetId, id))
      .orderBy(desc(sslSnapshot.createdAt))
      .limit(12),
  ]);

  return {
    asset: record,
    scans: scanRows.map((row) => ({
      ...row,
      riskLevel: row.riskLevel ?? "unknown",
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    })),
    findings: findingRows.map((row) => ({
      ...row,
      severity: row.severity as Severity,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    })),
    sslHistory: sslRows.map((row) => ({
      ...row,
      validFrom: row.validFrom?.toISOString() ?? null,
      validTo: row.validTo?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function listAssetOptions(
  scope: TenantScope,
): Promise<AssetSelectOption[]> {
  const rows = await db
    .select({
      id: asset.id,
      name: asset.name,
      targetUrl: asset.targetUrl,
      criticality: asset.criticality,
    })
    .from(asset)
    .where(and(assetScopeFilter(scope), eq(asset.status, "active")))
    .orderBy(asc(asset.name))
    .limit(500);

  return rows.map((row) => ({
    ...row,
    criticality: row.criticality as AssetCriticality,
  }));
}

/** Recomputes denormalized counters after a finding status change. */
export async function refreshAssetFindingCount(assetId: string): Promise<void> {
  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        eq(finding.assetId, assetId),
        inArray(finding.status, ["open", "in-progress"]),
      ),
    );

  await db
    .update(asset)
    .set({ openFindings: count?.total ?? 0, updatedAt: new Date() })
    .where(eq(asset.id, assetId));
}

export async function findAssetByTarget(
  scope: TenantScope,
  targetUrl: string,
): Promise<AssetRecord | null> {
  const normalized = normalizeTargetUrl(targetUrl);
  const [row] = await db
    .select()
    .from(asset)
    .where(
      and(
        assetScopeFilter(scope),
        eq(asset.targetUrl, normalized),
      ),
    )
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function countAssets(scope: TenantScope): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(asset)
    .where(assetScopeFilter(scope));
  return row?.total ?? 0;
}
