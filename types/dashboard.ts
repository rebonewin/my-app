/**
 * Contracts for the Security Operations Center dashboard.
 *
 * These types are the boundary between the UI and the data service. The
 * current implementation is backed by demo data in `services/dashboard`, but
 * every value here is serialisable so the service can be swapped for live
 * APIs without touching the components.
 */

export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type TrendTone = "positive" | "negative" | "neutral";

export type WidgetAccent =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "blue";

export type WidgetIconName =
  | "shield"
  | "server"
  | "radar"
  | "alert"
  | "certificate"
  | "bug"
  | "scale"
  | "sparkles";

export type QuickActionIconName = "scan" | "ssl" | "reports" | "threat" | "ai";

export type ComplianceStatus = "on-track" | "at-risk" | "overdue";

export interface ScoreWidgetData {
  kind: "score";
  id: string;
  label: string;
  value: number | null;
  grade: string;
  delta: number;
  target: number;
  percentile: number;
  caption: string;
  href: string;
}

export interface MetricWidgetData {
  kind: "metric";
  id: string;
  label: string;
  value: number | null;
  prefix?: string;
  suffix?: string;
  precision?: number;
  delta?: number;
  deltaLabel?: string;
  deltaSuffix?: string;
  deltaTone?: TrendTone;
  hint?: string;
  href: string;
  icon: WidgetIconName;
  accent: WidgetAccent;
  /** Optional 0–100 progress rail rendered at the bottom of the card. */
  progress?: number | null;
}

export interface ComplianceWidgetFramework {
  name: string;
  percent: number;
}

export interface ComplianceWidgetData {
  kind: "compliance";
  id: string;
  label: string;
  value: number | null;
  hint: string;
  frameworks: ComplianceWidgetFramework[];
  href: string;
}

export interface AiWidgetAction {
  label: string;
  href: string;
}

export interface AiWidgetData {
  kind: "ai";
  id: string;
  label: string;
  headline: string | null;
  summary: string | null;
  confidence: number | null;
  updatedLabel: string;
  actions: AiWidgetAction[];
  href: string;
}

export type DashboardWidget =
  | ScoreWidgetData
  | MetricWidgetData
  | ComplianceWidgetData
  | AiWidgetData;

export interface TrendPoint {
  label: string;
  score: number;
  scans: number;
}

export interface ScanDay {
  label: string;
  completed: number;
  failed: number;
}

export interface SeveritySlice {
  severity: Severity;
  label: string;
  count: number;
  href: string;
}

export interface RiskBucket {
  label: string;
  count: number;
  accent: WidgetAccent;
}

export interface ComplianceFramework {
  name: string;
  percent: number;
  status: ComplianceStatus;
  controls: number;
}

export interface ComplianceChartData {
  overall: number;
  frameworks: ComplianceFramework[];
}

export interface DashboardChartsData {
  scoreTrend: TrendPoint[];
  scanHistory: ScanDay[];
  severityDistribution: SeveritySlice[];
  assetsByRisk: RiskBucket[];
  compliance: ComplianceChartData;
}

export type ActivityKind =
  | "scan_completed"
  | "scan_failed"
  | "vulnerability"
  | "ssl_expiring"
  | "login"
  | "admin_action"
  | "api_key"
  | "threat";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  actor: string;
  occurredAt: string;
  severity?: Severity;
  href?: string;
}

export interface ThreatLevel {
  level: "low" | "guarded" | "elevated" | "high" | "critical";
  score: number;
  summary: string;
  signals: string[];
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: QuickActionIconName;
  accent: WidgetAccent;
}

export interface Finding {
  id: string;
  title: string;
  target: string;
  severity: Severity;
  cvss: number;
  status: "open" | "triaged" | "in-progress" | "resolved";
  category: string;
  detectedAt: string;
  owner: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  widgets: DashboardWidget[];
  charts: DashboardChartsData;
  activity: ActivityEvent[];
  riskOverview: {
    total: number;
    counters: SeveritySlice[];
  };
  recentFindings: Finding[];
  quickActions: QuickAction[];
  threatLevel: ThreatLevel;
}

export interface FindingFilter {
  severity?: Severity;
  query?: string;
}
