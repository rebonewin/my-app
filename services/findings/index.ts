import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { asset, finding } from "@/lib/db/schema";
import { findingScopeFilter, type TenantScope } from "@/lib/tenancy";
import { refreshAssetFindingCount } from "@/services/assets";
import { SEVERITY_ORDER } from "@/lib/soc/severity";
import type { Severity } from "@/types/dashboard";
import type {
  FindingCounts,
  FindingFilterInput,
  FindingRecord,
  FindingStatus,
  FindingsPageData,
} from "@/types/findings";
import { FINDING_STATUSES } from "@/types/findings";

function emptyCounts(): FindingCounts {
  return {
    total: 0,
    status: {
      open: 0,
      "in-progress": 0,
      resolved: 0,
      "accepted-risk": 0,
    },
    severity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    },
  };
}

export async function listFindings(
  scope: TenantScope,
  filters: FindingFilterInput = {},
): Promise<FindingRecord[]> {
  const conditions: SQL[] = [findingScopeFilter(scope)];

  if (filters.severity) conditions.push(eq(finding.severity, filters.severity));
  if (filters.status) conditions.push(eq(finding.status, filters.status));
  if (filters.category) conditions.push(eq(finding.category, filters.category));
  if (filters.assetId) conditions.push(eq(finding.assetId, filters.assetId));

  if (filters.query?.trim()) {
    const pattern = `%${filters.query.trim()}%`;
    const search = or(
      ilike(finding.title, pattern),
      ilike(finding.category, pattern),
      ilike(finding.id, pattern),
      ilike(asset.name, pattern),
      ilike(asset.targetUrl, pattern),
    );
    if (search) conditions.push(search);
  }

  const orderBy = (() => {
    switch (filters.sort) {
      case "severity":
        return sql`case ${finding.severity}
          when 'critical' then 5 when 'high' then 4 when 'medium' then 3
          when 'low' then 2 else 1 end desc`;
      case "cvss":
        return desc(finding.cvss);
      case "asset":
        return asc(asset.name);
      case "status":
        return sql`case ${finding.status}
          when 'open' then 1 when 'in-progress' then 2
          when 'accepted-risk' then 3 else 4 end asc`;
      default:
        return desc(finding.lastSeenAt);
    }
  })();

  const rows = await db
    .select({
      id: finding.id,
      assetId: finding.assetId,
      assetName: asset.name,
      assetTarget: asset.targetUrl,
      lastScanId: finding.lastScanId,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      category: finding.category,
      status: finding.status,
      cvss: finding.cvss,
      remediation: finding.remediation,
      assignedTo: finding.assignedTo,
      firstSeenAt: finding.firstSeenAt,
      lastSeenAt: finding.lastSeenAt,
      resolvedAt: finding.resolvedAt,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })
    .from(finding)
    .innerJoin(asset, eq(finding.assetId, asset.id))
    .where(and(...conditions))
    .orderBy(orderBy, desc(finding.cvss))
    .limit(500);

  return rows.map((row) => ({
    ...row,
    severity: row.severity as Severity,
    status: row.status as FindingStatus,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getFindingCounts(
  scope: TenantScope,
): Promise<FindingCounts> {
  const [severityRows, statusRows] = await Promise.all([
    db
      .select({
        severity: finding.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(finding)
      .where(findingScopeFilter(scope))
      .groupBy(finding.severity),
    db
      .select({
        status: finding.status,
        count: sql<number>`count(*)::int`,
      })
      .from(finding)
      .where(findingScopeFilter(scope))
      .groupBy(finding.status),
  ]);

  const counts = emptyCounts();
  for (const row of severityRows) {
    const severity = row.severity as Severity;
    if (SEVERITY_ORDER.includes(severity)) {
      counts.severity[severity] = row.count;
      counts.total += row.count;
    }
  }
  for (const row of statusRows) {
    const status = row.status as FindingStatus;
    if (FINDING_STATUSES.includes(status)) counts.status[status] = row.count;
  }
  return counts;
}

export async function listFindingCategories(
  scope: TenantScope,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: finding.category })
    .from(finding)
    .where(findingScopeFilter(scope))
    .orderBy(asc(finding.category));
  return rows.map((row) => row.category);
}

export async function getFindingsPageData(
  scope: TenantScope,
  filters: FindingFilterInput = {},
): Promise<FindingsPageData> {
  const [findings, counts, categories] = await Promise.all([
    listFindings(scope, filters),
    getFindingCounts(scope),
    listFindingCategories(scope),
  ]);
  return { findings, counts, categories };
}

export async function updateFindingStatus(
  scope: TenantScope,
  id: string,
  status: FindingStatus,
): Promise<FindingRecord | null> {
  const [current] = await db
    .select({ id: finding.id, assetId: finding.assetId })
    .from(finding)
    .innerJoin(asset, eq(finding.assetId, asset.id))
    .where(and(eq(finding.id, id), findingScopeFilter(scope)))
    .limit(1);

  if (!current) return null;

  const [row] = await db
    .update(finding)
    .set({
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(finding.id, id), findingScopeFilter(scope)))
    .returning();

  if (!row) return null;

  await refreshAssetFindingCount(row.assetId);

  const [assetRow] = await db
    .select({ name: asset.name, targetUrl: asset.targetUrl })
    .from(asset)
    .where(eq(asset.id, row.assetId))
    .limit(1);

  return {
    id: row.id,
    assetId: row.assetId,
    assetName: assetRow?.name ?? "Unknown asset",
    assetTarget: assetRow?.targetUrl ?? "",
    lastScanId: row.lastScanId,
    title: row.title,
    description: row.description,
    severity: row.severity as Severity,
    category: row.category,
    status: row.status as FindingStatus,
    cvss: row.cvss,
    remediation: row.remediation,
    assignedTo: row.assignedTo,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getFinding(
  scope: TenantScope,
  id: string,
): Promise<FindingRecord | null> {
  const rows = await listFindings(scope, { query: id });
  return rows.find((row) => row.id === id) ?? null;
}

export async function activeFindingCount(scope: TenantScope): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        findingScopeFilter(scope),
        inArray(finding.status, ["open", "in-progress"]),
      ),
    );
  return row?.total ?? 0;
}

/** Severity distribution for findings that still need remediation. */
export async function getActiveFindingSeverityCounts(
  scope: TenantScope,
): Promise<Record<Severity, number>> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };

  const rows = await db
    .select({ severity: finding.severity, count: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        findingScopeFilter(scope),
        inArray(finding.status, ["open", "in-progress"]),
      ),
    )
    .groupBy(finding.severity);

  for (const row of rows) {
    const severity = row.severity as Severity;
    if (severity in counts) counts[severity] = row.count;
  }
  return counts;
}
