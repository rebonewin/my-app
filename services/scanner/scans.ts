import "server-only";

import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  asset,
  finding,
  scan,
  scanFinding,
  sslSnapshot,
  user,
} from "@/lib/db/schema";
import {
  assetScopeFilter,
  scanScopeFilter,
  type TenantScope,
} from "@/lib/tenancy";
import {
  executeTargetScan,
  type ScanProgressEvent,
} from "@/services/scanner/engine";
import { refreshAssetFindingCount } from "@/services/assets";
import { resolveScanProfile } from "@/services/scanner/profiles";
import type { ScanResult } from "@/types/scan";
import {
  ACTIVE_SCAN_STATUSES,
  type ScanComparison,
  type ScanDetailData,
  type ScanFilters,
  type ScanFindingSummary,
  type ScanModule,
  type ScanQueueData,
  type ScanQueueItem,
  type ScanStatus,
} from "@/types/scanner";

const SCAN_COOLDOWN_MINUTES = 5;
const SCAN_COOLDOWN_LIMIT = 10;

export class ScanLimitError extends Error {}
export class ScanCancelledError extends Error {}

function asStatus(value: string): ScanStatus {
  return (
    ["pending", "running", "completed", "failed", "cancelled"].includes(value)
      ? value
      : "pending"
  ) as ScanStatus;
}

function toQueueItem(
  row: typeof scan.$inferSelect & { assetName?: string | null },
): ScanQueueItem {
  const status = asStatus(row.status);
  return {
    id: row.id,
    assetId: row.assetId,
    assetName: row.assetName ?? null,
    target: row.target,
    profileId: row.profileId,
    profileName: row.profileName,
    profileModules: row.profileModules ?? [],
    status,
    progress:
      status === "completed" && row.progress === 0 ? 100 : row.progress,
    currentModule:
      row.currentModule ??
      (status === "completed"
        ? "Completed"
        : status === "pending"
          ? "Queued"
          : null),
    riskLevel: row.riskLevel ?? "unknown",
    riskScore: row.riskScore,
    securityScore: row.securityScore,
    findingCount: row.findingCount,
    criticalCount: row.criticalCount,
    highCount: row.highCount,
    mediumCount: row.mediumCount,
    lowCount: row.lowCount,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

function emptyStatusCounts(): Record<ScanStatus, number> {
  return {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
}

export async function listScans(
  scope: TenantScope,
  filters: ScanFilters = {},
): Promise<ScanQueueData> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const conditions: SQL[] = [scanScopeFilter(scope)];

  if (filters.status === "active") {
    conditions.push(inArray(scan.status, ACTIVE_SCAN_STATUSES));
  } else if (filters.status) {
    conditions.push(eq(scan.status, filters.status));
  }
  if (filters.assetId) conditions.push(eq(scan.assetId, filters.assetId));
  if (filters.query?.trim()) {
    const pattern = `%${filters.query.trim()}%`;
    const search = or(
      ilike(scan.target, pattern),
      ilike(scan.profileName, pattern),
      ilike(asset.name, pattern),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const [rows, [count], statusRows] = await Promise.all([
    db
      .select({
        scan: scan,
        assetName: asset.name,
      })
      .from(scan)
      .leftJoin(asset, eq(scan.assetId, asset.id))
      .where(where)
      .orderBy(desc(scan.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(scan).where(where),
    db
      .select({ status: scan.status, count: sql<number>`count(*)::int` })
      .from(scan)
      .where(scanScopeFilter(scope))
      .groupBy(scan.status),
  ]);

  const counts = emptyStatusCounts();
  for (const row of statusRows) {
    const status = asStatus(row.status);
    counts[status] = row.count;
  }

  return {
    items: rows.map((row) => toQueueItem({ ...row.scan, assetName: row.assetName })),
    total: count?.total ?? 0,
    page,
    pageSize,
    counts,
  };
}

export async function getScan(
  scope: TenantScope,
  id: string,
): Promise<ScanQueueItem | null> {
  const [row] = await db
    .select({ scan: scan, assetName: asset.name })
    .from(scan)
    .leftJoin(asset, eq(scan.assetId, asset.id))
    .where(and(eq(scan.id, id), scanScopeFilter(scope)))
    .limit(1);
  return row ? toQueueItem({ ...row.scan, assetName: row.assetName }) : null;
}

async function snapshotFindings(
  scanId: string,
): Promise<ScanFindingSummary[]> {
  const rows = await db
    .select({
      id: scanFinding.findingId,
      title: scanFinding.title,
      severity: scanFinding.severity,
      category: scanFinding.category,
      cvss: scanFinding.cvss,
      fingerprint: scanFinding.fingerprint,
      status: finding.status,
    })
    .from(scanFinding)
    .leftJoin(finding, eq(scanFinding.findingId, finding.id))
    .where(eq(scanFinding.scanId, scanId));

  return rows.map((row) => ({
    id: row.id ?? row.fingerprint,
    title: row.title,
    severity: row.severity,
    category: row.category,
    cvss: row.cvss,
    fingerprint: row.fingerprint,
    status: row.status ?? "open",
  }));
}

async function buildComparison(
  scope: TenantScope,
  current: ScanQueueItem,
): Promise<ScanComparison | null> {
  if (!current.assetId || current.status !== "completed") return null;

  const [baseline] = await db
    .select({
      id: scan.id,
      securityScore: scan.securityScore,
      riskScore: scan.riskScore,
      createdAt: scan.createdAt,
    })
    .from(scan)
    .where(
      and(
        eq(scan.assetId, current.assetId),
        eq(scan.status, "completed"),
        scanScopeFilter(scope),
        sql`${scan.createdAt} < ${current.createdAt}::timestamptz`,
      ),
    )
    .orderBy(desc(scan.createdAt))
    .limit(1);

  if (!baseline) return null;

  const [currentFindings, baselineFindings] = await Promise.all([
    snapshotFindings(current.id),
    snapshotFindings(baseline.id),
  ]);

  const currentByFingerprint = new Map(
    currentFindings.map((finding) => [finding.fingerprint, finding]),
  );
  const baselineByFingerprint = new Map(
    baselineFindings.map((finding) => [finding.fingerprint, finding]),
  );

  const introduced = currentFindings.filter(
    (finding) => !baselineByFingerprint.has(finding.fingerprint),
  );
  const resolved = baselineFindings.filter(
    (finding) => !currentByFingerprint.has(finding.fingerprint),
  );

  const severityDelta: Record<string, number> = {};
  for (const item of [...currentFindings, ...baselineFindings]) {
    severityDelta[item.severity] = severityDelta[item.severity] ?? 0;
  }
  for (const item of currentFindings) {
    severityDelta[item.severity] = (severityDelta[item.severity] ?? 0) + 1;
  }
  for (const item of baselineFindings) {
    severityDelta[item.severity] = (severityDelta[item.severity] ?? 0) - 1;
  }

  return {
    baselineId: baseline.id,
    candidateId: current.id,
    scoreDelta: current.securityScore - baseline.securityScore,
    riskScoreDelta: current.riskScore - baseline.riskScore,
    severityDelta,
    introduced,
    resolved,
  };
}

export async function getScanDetail(
  scope: TenantScope,
  id: string,
): Promise<ScanDetailData | null> {
  const current = await getScan(scope, id);
  if (!current) return null;

  const [findings, sslRows, comparison] = await Promise.all([
    snapshotFindings(id),
    db
      .select({
        issuer: sslSnapshot.issuer,
        validFrom: sslSnapshot.validFrom,
        validTo: sslSnapshot.validTo,
        daysRemaining: sslSnapshot.daysRemaining,
        protocol: sslSnapshot.protocol,
      })
      .from(sslSnapshot)
      .where(eq(sslSnapshot.scanId, id))
      .limit(1),
    buildComparison(scope, current),
  ]);

  const ssl = sslRows[0]
    ? {
        issuer: sslRows[0].issuer,
        validFrom: sslRows[0].validFrom?.toISOString() ?? null,
        validTo: sslRows[0].validTo?.toISOString() ?? null,
        daysRemaining: sslRows[0].daysRemaining,
        protocol: sslRows[0].protocol,
      }
    : null;

  return { scan: current, findings, ssl, comparison };
}

/** Raw evidence bundle for the scan detail report. */
export async function getScanResult(
  scope: TenantScope,
  id: string,
): Promise<ScanResult | null> {
  const [row] = await db
    .select({ results: scan.results })
    .from(scan)
    .where(and(eq(scan.id, id), scanScopeFilter(scope)))
    .limit(1);

  return (row?.results as ScanResult | null) ?? null;
}

export async function enqueueScan(
  scope: TenantScope,
  assetId: string,
  profileId?: string | null,
): Promise<ScanQueueItem> {
  const [assetRow] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.id, assetId), assetScopeFilter(scope)))
    .limit(1);

  if (!assetRow) throw new Error("Asset not found.");
  if (assetRow.status !== "active") {
    throw new Error("Enable the asset before queueing a scan.");
  }

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(scan)
    .where(
      and(
        eq(scan.userId, scope.userId),
        gte(
          scan.createdAt,
          new Date(Date.now() - SCAN_COOLDOWN_MINUTES * 60 * 1000),
        ),
      ),
    );

  if ((recent ?? 0) >= SCAN_COOLDOWN_LIMIT) {
    throw new ScanLimitError(
      `Scan limit reached: ${SCAN_COOLDOWN_LIMIT} scans per ${SCAN_COOLDOWN_MINUTES} minutes.`,
    );
  }

  const profile = await resolveScanProfile(scope, profileId);
  const id = crypto.randomUUID();

  const [row] = await db
    .insert(scan)
    .values({
      id,
      userId: scope.userId,
      organizationId: scope.organizationId,
      assetId: assetRow.id,
      profileId: profile.id,
      profileName: profile.name,
      profileModules: profile.modules,
      target: assetRow.targetUrl,
      hostname: assetRow.domain,
      status: "pending",
      progress: 0,
      currentModule: "Queued",
    })
    .returning();

  return toQueueItem({ ...row, assetName: assetRow.name });
}

export async function cancelScan(
  scope: TenantScope,
  id: string,
): Promise<ScanQueueItem | null> {
  const [row] = await db
    .update(scan)
    .set({
      status: "cancelled",
      currentModule: "Cancelled",
      cancelledAt: new Date(),
      completedAt: new Date(),
    })
    .where(
      and(
        eq(scan.id, id),
        scanScopeFilter(scope),
        inArray(scan.status, ["pending", "running"]),
      ),
    )
    .returning();

  return row ? toQueueItem(row) : getScan(scope, id);
}

async function persistProgress(
  id: string,
  event: ScanProgressEvent,
): Promise<void> {
  const [current] = await db
    .select({ status: scan.status })
    .from(scan)
    .where(eq(scan.id, id))
    .limit(1);

  if (current?.status === "cancelled") {
    throw new ScanCancelledError("Scan cancelled.");
  }

  await db
    .update(scan)
    .set({
      progress: event.progress,
      currentModule: event.label,
    })
    .where(and(eq(scan.id, id), eq(scan.status, "running")));
}

/**
 * Claims and executes one queued scan.
 *
 * The atomic status transition makes the worker safe under concurrent
 * invocations: only one caller can move the job from pending to running.
 * Progress and the current module are persisted after every stage so the queue
 * UI can poll a real state machine.
 */
export async function processScanJob(id: string): Promise<void> {
  const [claimed] = await db
    .update(scan)
    .set({
      status: "running",
      startedAt: new Date(),
      progress: 2,
      currentModule: "Resolving target",
    })
    .where(and(eq(scan.id, id), eq(scan.status, "pending")))
    .returning();

  if (!claimed) return;

  const startedAt = Date.now();

  try {
    if (!claimed.assetId) {
      throw new Error("Scan is not linked to an asset.");
    }

    const [assetRow] = await db
      .select()
      .from(asset)
      .where(eq(asset.id, claimed.assetId))
      .limit(1);

    if (!assetRow) throw new Error("Asset not found.");

    const modules = (claimed.profileModules ?? []) as ScanModule[];
    const engine = await executeTargetScan(claimed.target, {
      modules,
      onProgress: (event) => persistProgress(id, event),
    });

    const counts = engine.findings.reduce(
      (acc, item) => {
        if (item.severity === "critical") acc.critical += 1;
        else if (item.severity === "high") acc.high += 1;
        else if (item.severity === "medium") acc.medium += 1;
        else if (item.severity === "low") acc.low += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 },
    );

    const completedAt = new Date();
    const durationMs = Date.now() - startedAt;

    await db.transaction(async (tx) => {
      for (const generated of engine.findings) {
        const [findingRow] = await tx
          .insert(finding)
          .values({
            id: crypto.randomUUID(),
            userId: claimed.userId,
            organizationId: claimed.organizationId,
            assetId: claimed.assetId as string,
            lastScanId: claimed.id,
            fingerprint: generated.fingerprint,
            title: generated.title,
            description: generated.description,
            severity: generated.severity,
            category: generated.category,
            status: "open",
            cvss: generated.cvss,
            evidence: generated.evidence,
            remediation: generated.remediation,
            lastSeenAt: completedAt,
          })
          .onConflictDoUpdate({
            target: [finding.assetId, finding.fingerprint],
            set: {
              lastScanId: claimed.id,
              title: generated.title,
              description: generated.description,
              severity: generated.severity,
              category: generated.category,
              cvss: generated.cvss,
              evidence: generated.evidence,
              remediation: generated.remediation,
              lastSeenAt: completedAt,
              updatedAt: completedAt,
            },
          })
          .returning({ id: finding.id });

        if (findingRow) {
          await tx
            .insert(scanFinding)
            .values({
              id: crypto.randomUUID(),
              scanId: claimed.id,
              findingId: findingRow.id,
              assetId: claimed.assetId,
              fingerprint: generated.fingerprint,
              title: generated.title,
              severity: generated.severity,
              category: generated.category,
              cvss: generated.cvss,
            })
            .onConflictDoNothing();
        }
      }

      if (engine.result.ssl.enabled) {
        await tx.insert(sslSnapshot).values({
          id: crypto.randomUUID(),
          scanId: claimed.id,
          assetId: claimed.assetId as string,
          issuer: engine.result.ssl.issuer,
          validFrom: engine.result.ssl.validFrom
            ? new Date(engine.result.ssl.validFrom)
            : null,
          validTo: engine.result.ssl.validTo
            ? new Date(engine.result.ssl.validTo)
            : null,
          daysRemaining: engine.result.ssl.daysRemaining,
          protocol: engine.result.ssl.protocol,
        });
      }

      const [openCount] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(finding)
        .where(
          and(
            eq(finding.assetId, claimed.assetId as string),
            inArray(finding.status, ["open", "in-progress"]),
          ),
        );

      await tx
        .update(asset)
        .set({
          riskScore: engine.result.riskScore,
          riskLevel: engine.result.riskLevel,
          lastScanAt: completedAt,
          lastScanId: claimed.id,
          openFindings: openCount?.total ?? 0,
          sslExpiresAt: engine.result.ssl.validTo
            ? new Date(engine.result.ssl.validTo)
            : assetRow.sslExpiresAt,
          sslIssuer: engine.result.ssl.issuer || assetRow.sslIssuer,
          ipAddress: engine.ipAddress ?? assetRow.ipAddress,
          updatedAt: completedAt,
        })
        .where(eq(asset.id, claimed.assetId as string));

      await tx
        .update(scan)
        .set({
          status: "completed",
          progress: 100,
          currentModule: "Completed",
          riskLevel: engine.result.riskLevel,
          riskScore: engine.result.riskScore,
          securityScore: engine.result.securityScore,
          findingCount: engine.findings.length,
          criticalCount: counts.critical,
          highCount: counts.high,
          mediumCount: counts.medium,
          lowCount: counts.low,
          results: engine.result,
          durationMs,
          completedAt,
        })
        .where(eq(scan.id, claimed.id));
    });

    const [owner] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, claimed.userId))
      .limit(1);

    await recordAudit({
      action: "scanner.scan_completed",
      category: "scanner",
      severity:
        engine.result.riskLevel === "critical" ||
        engine.result.riskLevel === "high"
          ? "high"
          : "info",
      actorId: claimed.userId,
      actorEmail: owner?.email ?? null,
      actorRole: null,
      organizationId: claimed.organizationId,
      resourceType: "scan",
      resourceId: claimed.id,
      description: `Queued scan of ${claimed.target} completed: ${engine.result.riskLevel} risk (${engine.result.riskScore}/100).`,
      metadata: {
        assetId: claimed.assetId,
        profileId: claimed.profileId,
        riskLevel: engine.result.riskLevel,
        riskScore: engine.result.riskScore,
        findingCount: engine.findings.length,
        openPorts: engine.result.ports.map((port) => port.port),
      },
    });
  } catch (error) {
    const cancelled = error instanceof ScanCancelledError;
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The target did not respond within 20 seconds."
        : error instanceof Error
          ? error.message.slice(0, 500)
          : "unknown";

    const [current] = await db
      .select({ status: scan.status })
      .from(scan)
      .where(eq(scan.id, claimed.id))
      .limit(1);

    if (!cancelled && current?.status !== "cancelled") {
      await db
        .update(scan)
        .set({
          status: "failed",
          currentModule: "Failed",
          error: message,
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        })
        .where(eq(scan.id, claimed.id));
    }

    await recordAudit({
      action: cancelled ? "scanner.scan_cancelled" : "scanner.scan_failed",
      category: "scanner",
      severity: cancelled ? "info" : "medium",
      actorId: claimed.userId,
      organizationId: claimed.organizationId,
      resourceType: "scan",
      resourceId: claimed.id,
      description: cancelled
        ? `Queued scan of ${claimed.target} was cancelled.`
        : `Queued scan of ${claimed.target} failed.`,
      metadata: { error: message },
      success: !cancelled,
    });
  }
}

/** Recomputes open-finding counters for assets after bulk operations. */
export async function refreshScanAssetCounters(assetId: string): Promise<void> {
  await refreshAssetFindingCount(assetId);
}

/** Lightweight helper used by API routes after an enqueue request. */
export function requestIp(request: Request): string | null {
  return clientIpFromHeaders(request.headers);
}
