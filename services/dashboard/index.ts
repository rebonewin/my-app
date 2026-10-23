import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { asset, finding, scan } from "@/lib/db/schema";
import {
  assetScopeFilter,
  findingScopeFilter,
  scanScopeFilter,
  type TenantScope,
} from "@/lib/tenancy";
import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/soc/severity";
import {
  getActiveFindingSeverityCounts,
  getFindingCounts as queryFindingCounts,
  listFindings,
} from "@/services/findings";
import { getAssetDashboard } from "@/services/assets";
import { listScans } from "@/services/scanner/scans";
import type {
  ActivityEvent,
  ComplianceFramework,
  DashboardChartsData,
  DashboardSnapshot,
  DashboardWidget,
  Finding,
  FindingFilter,
  RecentScan,
  RiskBucket,
  Severity,
  SeveritySlice,
  TrendPoint,
} from "@/types/dashboard";
import {
  complianceFrameworks,
  quickActions,
  threatLevel as baseThreatLevel,
} from "./mock-data";

function scoreForScan(row: {
  securityScore: number;
  riskScore: number;
}): number {
  return row.securityScore > 0
    ? row.securityScore
    : Math.max(0, 100 - row.riskScore);
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayLabel(value: Date, style: "date" | "weekday"): string {
  return new Intl.DateTimeFormat("en-US", {
    month: style === "date" ? "short" : undefined,
    day: style === "date" ? "2-digit" : undefined,
    weekday: style === "weekday" ? "short" : undefined,
    timeZone: "UTC",
  }).format(value);
}

function buildScoreTrend(
  scans: Array<{
    createdAt: Date;
    securityScore: number;
    riskScore: number;
    status: string;
  }>,
): TrendPoint[] {
  const cutoff = Date.now() - 14 * 86_400_000;
  const groups = new Map<string, { label: string; total: number; scans: number }>();

  for (const row of scans) {
    if (row.status !== "completed") continue;
    if (row.createdAt.getTime() < cutoff) continue;
    const key = dayKey(row.createdAt);
    const group = groups.get(key) ?? {
      label: dayLabel(row.createdAt, "date"),
      total: 0,
      scans: 0,
    };
    group.total += scoreForScan(row);
    group.scans += 1;
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => ({
      label: group.label,
      score: Math.round(group.total / Math.max(1, group.scans)),
      scans: group.scans,
    }));
}

function buildScanHistory(
  scans: Array<{ createdAt: Date; status: string }>,
): DashboardChartsData["scanHistory"] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000);
    return {
      key: dayKey(date),
      label: dayLabel(date, "weekday"),
      completed: 0,
      failed: 0,
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const row of scans) {
    const day = byKey.get(dayKey(row.createdAt));
    if (!day) continue;
    if (row.status === "completed") day.completed += 1;
    if (row.status === "failed") day.failed += 1;
  }

  return days.map(({ label, completed, failed }) => ({
    label,
    completed,
    failed,
  }));
}

function buildSeverityCounters(
  counts: Record<Severity, number>,
): SeveritySlice[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    label: SEVERITY_META[severity].label,
    count: counts[severity],
    href: SEVERITY_META[severity].href,
  }));
}

function buildRiskBuckets(
  rows: Array<{ riskLevel: string; count: number }>,
): RiskBucket[] {
  const byLevel = new Map(rows.map((row) => [row.riskLevel, row.count]));
  return [
    { label: "Critical", count: byLevel.get("critical") ?? 0, accent: "danger" },
    { label: "High", count: byLevel.get("high") ?? 0, accent: "warning" },
    { label: "Medium", count: byLevel.get("medium") ?? 0, accent: "blue" },
    { label: "Low", count: byLevel.get("low") ?? 0, accent: "success" },
    {
      label: "Unclassified",
      count:
        (byLevel.get("unknown") ?? 0) +
        (byLevel.get("none") ?? 0),
      accent: "violet",
    },
  ];
}

function buildActivity(
  scans: Array<{
    id: string;
    target: string;
    status: string;
    riskLevel: string;
    riskScore: number;
    profileName: string | null;
    createdAt: Date;
    completedAt: Date | null;
    assetName: string | null;
  }>,
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    assetName: string;
    assignedTo: string | null;
    lastSeenAt: Date;
  }>,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const row of scans) {
    events.push({
      id: `scan-${row.id}`,
      kind: row.status === "failed" ? "scan_failed" : "scan_completed",
      title: `${row.profileName ?? "Assessment"} ${row.status}`,
      description: `${row.assetName ?? row.target} · risk ${row.riskScore}/100 (${row.riskLevel})`,
      actor: "Scanner",
      occurredAt: (row.completedAt ?? row.createdAt).toISOString(),
      severity:
        row.riskLevel === "critical"
          ? "critical"
          : row.riskLevel === "high"
            ? "high"
            : row.riskLevel === "medium"
              ? "medium"
              : "low",
      href: `/scans/${row.id}`,
    });
  }

  for (const row of findings) {
    events.push({
      id: `finding-${row.id}`,
      kind: "vulnerability",
      title: row.title,
      description: `${row.assetName} · ${row.severity} severity`,
      actor: row.assignedTo ?? "Unassigned",
      occurredAt: row.lastSeenAt.toISOString(),
      severity: row.severity as Severity,
      href: `/findings?severity=${row.severity}`,
    });
  }

  return events
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8);
}

function gradeFromScore(score: number | null): string {
  if (score === null) return "—";
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function buildWidgets(input: {
  assets: Awaited<ReturnType<typeof getAssetDashboard>>;
  score: number | null;
  previousScore: number | null;
  completedScans: number;
  activeSeverity: Record<Severity, number>;
  openFindings: number;
  sslHealth: number | null;
  sslTracked: number;
  sslExpiring: number;
  totalScans: number;
  scansLast30Days: number;
  compliance: ComplianceFramework[];
}): DashboardWidget[] {
  const critical = input.activeSeverity.critical;
  const high = input.activeSeverity.high;
  const delta = input.score !== null && input.previousScore !== null
    ? Math.round((input.score - input.previousScore) * 10) / 10
    : 0;
  const complianceOverall = Math.round(
    input.compliance.reduce((sum, framework) => sum + framework.percent, 0) /
      Math.max(1, input.compliance.length),
  );
  const atRiskHint =
    input.assets.stats.atRisk > 0
      ? `${input.assets.stats.atRisk} need remediation attention`
      : "No critical or high-risk assets";

  return [
    {
      kind: "score",
      id: "security-score",
      label: "Security Score",
      value: input.score,
      grade: gradeFromScore(input.score),
      delta,
      target: 90,
      percentile: input.score === null ? 0 : Math.min(99, Math.max(1, Math.round(input.score))),
      caption:
        input.completedScans > 0
          ? `Average across ${input.completedScans} completed scans`
          : "Run a scan to establish a baseline",
      href: "/security-score",
    },
    {
      kind: "metric",
      id: "total-assets",
      label: "Total Assets",
      value: input.assets.stats.total,
      delta: input.assets.stats.recentlyAdded,
      deltaSuffix: "",
      deltaLabel: "added in 30 days",
      deltaTone: input.assets.stats.recentlyAdded > 0 ? "positive" : "neutral",
      hint: `${input.assets.stats.active} active · ${input.assets.stats.total - input.assets.stats.active} disabled`,
      href: "/assets",
      icon: "server",
      accent: "accent",
      progress:
        input.assets.stats.total > 0
          ? Math.round((input.assets.stats.active / input.assets.stats.total) * 100)
          : 0,
    },
    {
      kind: "metric",
      id: "assets-at-risk",
      label: "Assets at Risk",
      value: input.assets.stats.atRisk,
      deltaTone: input.assets.stats.atRisk > 0 ? "negative" : "positive",
      hint: atRiskHint,
      href: "/assets?riskLevel=high",
      icon: "alert",
      accent: "warning",
      progress:
        input.assets.stats.total > 0
          ? Math.round((input.assets.stats.atRisk / input.assets.stats.total) * 100)
          : 0,
    },
    {
      kind: "metric",
      id: "critical-findings",
      label: "Critical Vulnerabilities",
      value: critical,
      deltaLabel: "active now",
      deltaTone: critical > 0 ? "negative" : "positive",
      hint: critical ? `${high} high-severity findings are also open` : "No active critical findings",
      href: "/findings?severity=critical",
      icon: "bug",
      accent: "danger",
      progress: 100 - Math.min(critical * 12, 100),
    },
    {
      kind: "metric",
      id: "open-findings",
      label: "Open Findings",
      value: input.openFindings,
      deltaLabel: "needs remediation",
      deltaTone: input.openFindings > 0 ? "negative" : "positive",
      hint: `${critical} critical · ${high} high`,
      href: "/findings?status=open",
      icon: "alert",
      accent: "warning",
      progress: 100 - Math.min(input.openFindings, 100),
    },
    {
      kind: "metric",
      id: "ssl-health",
      label: "SSL Health",
      value: input.sslHealth,
      suffix: "%",
      precision: 1,
      deltaLabel: `${input.sslExpiring} expiring soon`,
      deltaTone: input.sslExpiring > 0 ? "negative" : "positive",
      hint:
        input.sslTracked > 0
          ? `${input.sslTracked} certificates observed`
          : "Queue a TLS audit to populate certificate health",
      href: "/assets?sort=risk",
      icon: "certificate",
      accent: "success",
      progress: input.sslHealth,
    },
    {
      kind: "metric",
      id: "total-scans",
      label: "Total Scans",
      value: input.totalScans,
      delta: input.scansLast30Days,
      deltaSuffix: "",
      deltaLabel: "last 30 days",
      deltaTone: "positive",
      hint: "Queued and synchronous assessments",
      href: "/scans",
      icon: "radar",
      accent: "violet",
      progress:
        input.totalScans > 0
          ? Math.min(100, Math.round((input.scansLast30Days / input.totalScans) * 100))
          : 0,
    },
    {
      kind: "compliance",
      id: "compliance-status",
      label: "Compliance Status",
      value: complianceOverall,
      hint: "Framework evidence is managed in the compliance module",
      frameworks: input.compliance.slice(0, 3).map((framework) => ({
        name: framework.name,
        percent: framework.percent,
      })),
      href: "/compliance",
    },
    {
      kind: "ai",
      id: "ai-security-summary",
      label: "AI Security Summary",
      headline:
        critical > 0
          ? `${critical} critical finding${critical === 1 ? "" : "s"} need a decision`
          : input.assets.stats.atRisk > 0
            ? "Risk is concentrated in a small asset group"
            : "No critical exposure detected",
      summary:
        critical > 0
          ? `${input.openFindings} active findings span ${input.assets.stats.atRisk} at-risk assets. Resolve the critical cluster first, then re-scan the affected assets to verify the score trend.`
          : `${input.assets.stats.active} active assets and ${input.totalScans} recorded scans are currently in scope. Keep the queue moving and review expiring certificates before they lapse.`,
      confidence: critical > 0 ? 0.91 : 0.78,
      updatedLabel: "Just now",
      actions: [
        { label: "Review findings", href: "/findings" },
        { label: "Open asset inventory", href: "/assets" },
      ],
      href: "/ai-assistant",
    },
  ];
}

export async function getDashboardSnapshot(
  scope: TenantScope,
): Promise<DashboardSnapshot> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000);
  const sixtyDaysAgo = new Date(now - 60 * 86_400_000);

  const [
    assets,
    activeSeverity,
    openFindings,
    statusCounts,
    scans,
    recentFindingRows,
    riskRows,
    sslRows,
    recentScansData,
  ] = await Promise.all([
    getAssetDashboard(scope),
    getActiveFindingSeverityCounts(scope),
    queryFindingTotal(scope),
    queryScanStatusCounts(scope),
    db
      .select({
        id: scan.id,
        target: scan.target,
        status: scan.status,
        riskLevel: scan.riskLevel,
        riskScore: scan.riskScore,
        securityScore: scan.securityScore,
        profileName: scan.profileName,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        assetName: asset.name,
      })
      .from(scan)
      .leftJoin(asset, eq(scan.assetId, asset.id))
      .where(
        and(
          scanScopeFilter(scope),
          gte(scan.createdAt, sixtyDaysAgo),
        ),
      )
      .orderBy(desc(scan.createdAt))
      .limit(500),
    db
      .select({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        category: finding.category,
        cvss: finding.cvss,
        assignedTo: finding.assignedTo,
        lastSeenAt: finding.lastSeenAt,
        assetName: asset.name,
        assetTarget: asset.targetUrl,
        lastScanId: finding.lastScanId,
      })
      .from(finding)
      .innerJoin(asset, eq(finding.assetId, asset.id))
      .where(
        and(
          findingScopeFilter(scope),
          inArray(finding.status, ["open", "in-progress"]),
        ),
      )
      .orderBy(desc(finding.cvss), desc(finding.lastSeenAt))
      .limit(5),
    db
      .select({
        riskLevel: asset.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(asset)
      .where(assetScopeFilter(scope))
      .groupBy(asset.riskLevel),
    db
      .select({
        total: sql<number>`count(*) filter (where ${asset.sslExpiresAt} is not null)::int`,
        valid: sql<number>`count(*) filter (where ${asset.sslExpiresAt} > now())::int`,
      })
      .from(asset)
      .where(assetScopeFilter(scope)),
    listScans(scope, { page: 1, pageSize: 6 }),
  ]);

  const completedScans = scans.filter((row) => row.status === "completed");
  const recentCompleted = completedScans.filter(
    (row) => row.createdAt.getTime() >= thirtyDaysAgo.getTime(),
  );
  const previousCompleted = completedScans.filter(
    (row) =>
      row.createdAt.getTime() >= sixtyDaysAgo.getTime() &&
      row.createdAt.getTime() < thirtyDaysAgo.getTime(),
  );
  const average = (rows: typeof completedScans): number | null =>
    rows.length
      ? Math.round(
          rows.reduce((sum, row) => sum + scoreForScan(row), 0) / rows.length,
        )
      : null;

  const score = average(recentCompleted);
  const previousScore = average(previousCompleted);
  const sslTracked = sslRows[0]?.total ?? 0;
  const sslValid = sslRows[0]?.valid ?? 0;
  const sslHealth =
    sslTracked > 0 ? Math.round((sslValid / sslTracked) * 1000) / 10 : null;

  const counters = buildSeverityCounters(activeSeverity);
  const charts: DashboardChartsData = {
    scoreTrend: buildScoreTrend(scans),
    scanHistory: buildScanHistory(scans),
    severityDistribution: counters,
    assetsByRisk: buildRiskBuckets(riskRows),
    compliance: {
      overall: Math.round(
        complianceFrameworks.reduce(
          (sum, framework) => sum + framework.percent,
          0,
        ) / Math.max(1, complianceFrameworks.length),
      ),
      frameworks: complianceFrameworks,
    },
  };

  const recentScans: RecentScan[] = recentScansData.items.slice(0, 5).map((row) => ({
    id: row.id,
    assetName: row.assetName ?? row.target,
    target: row.target,
    profileName: row.profileName ?? "Standalone scan",
    status: row.status,
    riskLevel: row.riskLevel,
    securityScore: row.securityScore,
    findingCount: row.findingCount,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));

  const recentFindings: Finding[] = recentFindingRows.map((row) => ({
    id: row.id,
    title: row.title,
    target: row.assetTarget,
    severity: row.severity as Severity,
    cvss: row.cvss,
    status: row.status as Finding["status"],
    category: row.category,
    detectedAt: row.lastSeenAt.toISOString(),
    owner: row.assignedTo ?? "Unassigned",
  }));

  const activity = buildActivity(
    recentScansData.items.map((row) => ({
      id: row.id,
      target: row.target,
      status: row.status,
      riskLevel: row.riskLevel,
      riskScore: row.riskScore,
      profileName: row.profileName,
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      assetName: row.assetName,
    })),
    recentFindingRows.map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity,
      assetName: row.assetName,
      assignedTo: row.assignedTo,
      lastSeenAt: row.lastSeenAt,
    })),
  );

  const totalScans =
    statusCounts.pending +
    statusCounts.running +
    statusCounts.completed +
    statusCounts.failed +
    statusCounts.cancelled;

  return {
    generatedAt: new Date().toISOString(),
    widgets: buildWidgets({
      assets,
      score,
      previousScore,
      completedScans: recentCompleted.length,
      activeSeverity,
      openFindings,
      sslHealth,
      sslTracked,
      sslExpiring: assets.stats.expiringSsl,
      totalScans,
      scansLast30Days: statusCounts.last30Days,
      compliance: complianceFrameworks,
    }),
    charts,
    activity,
    riskOverview: {
      total: openFindings,
      counters,
    },
    recentFindings,
    recentScans,
    quickActions,
    threatLevel: {
      ...baseThreatLevel,
      level:
        activeSeverity.critical > 0
          ? "critical"
          : activeSeverity.high > 0
            ? "elevated"
            : "guarded",
      score: Math.min(100, 30 + activeSeverity.critical * 12 + activeSeverity.high * 4),
      summary:
        activeSeverity.critical > 0
          ? `${activeSeverity.critical} critical finding${activeSeverity.critical === 1 ? "" : "s"} and ${activeSeverity.high} high-severity exposures need an owner.`
          : "No active critical findings. Keep validating the asset inventory and certificate expiry.",
      signals: [
        `${assets.stats.total} assets in scope`,
        `${openFindings} active findings`,
        `${assets.stats.expiringSsl} certificates expire within 30 days`,
      ],
    },
  };
}

async function queryFindingTotal(scope: TenantScope): Promise<number> {
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

async function queryScanStatusCounts(
  scope: TenantScope,
): Promise<
  Record<"pending" | "running" | "completed" | "failed" | "cancelled", number> & {
    last30Days: number;
  }
> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({ status: scan.status, count: sql<number>`count(*)::int` })
    .from(scan)
    .where(scanScopeFilter(scope))
    .groupBy(scan.status);

  const counts = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    last30Days: 0,
  };
  for (const row of rows) {
    const status = row.status as keyof typeof counts;
    if (status in counts) counts[status] = row.count;
  }

  const [recent] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(scan)
    .where(
      and(
        scanScopeFilter(scope),
        gte(scan.createdAt, thirtyDaysAgo),
      ),
    );
  counts.last30Days = recent?.total ?? 0;
  return counts;
}

/** Compatibility helpers used by the findings page and future exports. */
export async function getFindings(
  scope: TenantScope,
  filter: FindingFilter = {},
): Promise<Finding[]> {
  const rows = await listFindings(scope, {
    severity: filter.severity,
    query: filter.query,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    target: row.assetTarget,
    severity: row.severity,
    cvss: row.cvss,
    status: row.status,
    category: row.category,
    detectedAt: row.lastSeenAt,
    owner: row.assignedTo ?? "Unassigned",
  }));
}

export async function getFindingCounts(
  scope: TenantScope,
): Promise<Record<Severity, number>> {
  return queryFindingCounts(scope).then((counts) => counts.severity);
}
