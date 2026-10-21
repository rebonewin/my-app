import "server-only";

import { SEVERITY_META, SEVERITY_ORDER } from "@/lib/soc/severity";
import type {
  ActivityEvent,
  DashboardChartsData,
  DashboardSnapshot,
  DashboardWidget,
  Finding,
  FindingFilter,
  Severity,
  SeveritySlice,
  TrendPoint,
} from "@/types/dashboard";
import {
  complianceFrameworks,
  mockFindings,
  quickActions,
  recentActivity,
  riskBuckets,
  scanHistoryValues,
  scoreTrendValues,
  threatLevel,
} from "./mock-data";

/**
 * Dashboard data service.
 *
 * The UI only calls these functions. Replacing the demo constants with
 * `fetch()` calls to the VAPT, SSL or threat-intelligence services (or direct
 * Drizzle queries) is a change contained to this file.
 */

function minutesAgoISO(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function dayLabel(daysAgo: number, style: "date" | "weekday"): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-US", {
    month: style === "date" ? "short" : undefined,
    day: style === "date" ? "2-digit" : undefined,
    weekday: style === "weekday" ? "short" : undefined,
    timeZone: "UTC",
  }).format(date);
}

function buildScoreTrend(): TrendPoint[] {
  const scans = [26, 31, 28, 34, 39, 36, 41, 44, 42, 47, 45, 49, 52, 49];
  return scoreTrendValues.map((score, index) => ({
    label: dayLabel(scoreTrendValues.length - 1 - index, "date"),
    score,
    scans: scans[index] ?? 0,
  }));
}

function buildScanHistory(): DashboardChartsData["scanHistory"] {
  return scanHistoryValues.map((day, index) => ({
    label: dayLabel(scanHistoryValues.length - 1 - index, "weekday"),
    ...day,
  }));
}

function buildSeverityCounters(findings: Finding[]): SeveritySlice[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    label: SEVERITY_META[severity].label,
    count: findings.filter((finding) => finding.severity === severity).length,
    href: SEVERITY_META[severity].href,
  }));
}

function toFinding(
  finding: (typeof mockFindings)[number],
): Finding {
  return {
    id: finding.id,
    title: finding.title,
    target: finding.target,
    severity: finding.severity,
    cvss: finding.cvss,
    status: finding.status,
    category: finding.category,
    detectedAt: minutesAgoISO(finding.detectedMinutesAgo),
    owner: finding.owner,
  };
}

function buildActivity(): ActivityEvent[] {
  return recentActivity.map((event) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    description: event.description,
    actor: event.actor,
    occurredAt: minutesAgoISO(event.minutesAgo),
    severity: event.severity,
    href: event.href,
  }));
}

function buildWidgets(
  findings: Finding[],
  counters: SeveritySlice[],
  complianceOverall: number,
): DashboardWidget[] {
  const criticalCount =
    counters.find((counter) => counter.severity === "critical")?.count ?? 0;

  return [
    {
      kind: "score",
      id: "security-score",
      label: "Security Score",
      value: 87,
      grade: "A-",
      delta: 4.2,
      target: 90,
      percentile: 92,
      caption: "Top 8% of peer organisations",
      href: "/security-score",
    },
    {
      kind: "metric",
      id: "active-assets",
      label: "Active Assets",
      value: 248,
      delta: 12,
      deltaLabel: "vs last month",
      deltaSuffix: "",
      deltaTone: "positive",
      hint: "236 authenticated · 12 awaiting discovery review",
      href: "/assets",
      icon: "server",
      accent: "accent",
      progress: 72,
    },
    {
      kind: "metric",
      id: "total-scans",
      label: "Total Scans",
      value: 1284,
      delta: 18.6,
      deltaLabel: "vs last month",
      deltaTone: "positive",
      hint: "314 scans this month · 2 failed",
      href: "/reports",
      icon: "radar",
      accent: "violet",
      progress: 64,
    },
    {
      kind: "metric",
      id: "critical-findings",
      label: "Critical Findings",
      value: criticalCount,
      delta: -3,
      deltaLabel: "vs last week",
      deltaSuffix: "",
      deltaTone: "positive",
      hint: criticalCount
        ? "All critical items need an owner"
        : "No critical findings open",
      href: "/findings?severity=critical",
      icon: "alert",
      accent: "danger",
      progress: 100 - Math.min(criticalCount * 12, 100),
    },
    {
      kind: "metric",
      id: "ssl-health",
      label: "SSL Health",
      value: 96.8,
      precision: 1,
      suffix: "%",
      delta: 1.4,
      deltaLabel: "vs last week",
      deltaTone: "positive",
      hint: "4 certificates expire within 30 days",
      href: "/ssl-analyzer",
      icon: "certificate",
      accent: "success",
      progress: 96.8,
    },
    {
      kind: "metric",
      id: "open-vulnerabilities",
      label: "Open Findings",
      value: findings.length,
      delta: -8,
      deltaLabel: "vs last week",
      deltaSuffix: "",
      deltaTone: "positive",
      hint: `${criticalCount} critical · ${findings.filter((finding) => finding.severity === "high").length} high`,
      href: "/findings",
      icon: "bug",
      accent: "warning",
      progress: 38,
    },
    {
      kind: "compliance",
      id: "compliance-status",
      label: "Compliance Status",
      value: complianceOverall,
      hint: "2 frameworks need evidence this quarter",
      frameworks: complianceFrameworks.slice(0, 3).map((framework) => ({
        name: framework.name,
        percent: framework.percent,
      })),
      href: "/compliance",
    },
    {
      kind: "ai",
      id: "ai-security-summary",
      label: "AI Security Summary",
      headline: "Credential stuffing is the active risk",
      summary:
        "Attempts against the customer portal rose 38% this week. Three critical findings share one edge asset — fixing the admin console exposure should collapse the largest risk cluster.",
      confidence: 0.94,
      updatedLabel: "2 min ago",
      actions: [
        { label: "Open assistant", href: "/ai-assistant" },
        { label: "Review cluster", href: "/findings?severity=critical" },
      ],
      href: "/ai-assistant",
    },
  ];
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const findings = mockFindings.map(toFinding);
  const counters = buildSeverityCounters(findings);
  const complianceOverall = Math.round(
    complianceFrameworks.reduce((sum, framework) => sum + framework.percent, 0) /
      complianceFrameworks.length,
  );

  const charts: DashboardChartsData = {
    scoreTrend: buildScoreTrend(),
    scanHistory: buildScanHistory(),
    severityDistribution: counters,
    assetsByRisk: riskBuckets,
    compliance: {
      overall: complianceOverall,
      frameworks: complianceFrameworks,
    },
  };

  return {
    generatedAt: new Date().toISOString(),
    widgets: buildWidgets(findings, counters, complianceOverall),
    charts,
    activity: buildActivity(),
    riskOverview: {
      total: findings.length,
      counters,
    },
    recentFindings: findings.slice(0, 5),
    quickActions,
    threatLevel,
  };
}

export async function getFindings(
  filter: FindingFilter = {},
): Promise<Finding[]> {
  const query = filter.query?.trim().toLowerCase();
  return mockFindings
    .map(toFinding)
    .filter((finding) => {
      if (filter.severity && finding.severity !== filter.severity) return false;
      if (!query) return true;
      return [finding.id, finding.title, finding.target, finding.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
}

export async function getFindingCounts(): Promise<Record<Severity, number>> {
  const findings = await getFindings();
  return SEVERITY_ORDER.reduce(
    (counts, severity) => {
      counts[severity] = findings.filter(
        (finding) => finding.severity === severity,
      ).length;
      return counts;
    },
    {} as Record<Severity, number>,
  );
}
