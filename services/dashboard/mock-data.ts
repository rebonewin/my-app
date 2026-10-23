import type {
  ActivityKind,
  ComplianceFramework,
  Finding,
  QuickAction,
  RiskBucket,
  Severity,
  ThreatLevel,
  TrendPoint,
} from "@/types/dashboard";

/**
 * Demo telemetry for the SOC dashboard.
 *
 * Everything in this file is shaped like a real API response. Replace the
 * accessors in `services/dashboard/index.ts` with live queries and the UI keeps
 * working — no component knows where the data came from.
 */

export interface MockFinding extends Omit<Finding, "detectedAt"> {
  detectedMinutesAgo: number;
}

export interface MockActivity {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  actor: string;
  minutesAgo: number;
  severity?: Severity;
  href?: string;
}

export const scoreTrendValues = [
  71, 73, 72, 75, 77, 76, 79, 81, 80, 83, 84, 83, 86, 87,
];

export const scanHistoryValues = [
  { completed: 34, failed: 2 },
  { completed: 41, failed: 1 },
  { completed: 38, failed: 3 },
  { completed: 47, failed: 2 },
  { completed: 52, failed: 1 },
  { completed: 44, failed: 4 },
  { completed: 58, failed: 2 },
];

export const riskBuckets: RiskBucket[] = [
  { label: "Critical", count: 12, accent: "danger" },
  { label: "High", count: 39, accent: "warning" },
  { label: "Medium", count: 81, accent: "blue" },
  { label: "Low", count: 94, accent: "success" },
  { label: "Unclassified", count: 22, accent: "violet" },
];

export const complianceFrameworks: ComplianceFramework[] = [
  { name: "SOC 2 Type II", percent: 92, status: "on-track", controls: 64 },
  { name: "ISO 27001", percent: 84, status: "on-track", controls: 114 },
  { name: "GDPR", percent: 78, status: "at-risk", controls: 48 },
  { name: "PCI DSS", percent: 71, status: "at-risk", controls: 82 },
];

export const threatLevel: ThreatLevel = {
  level: "elevated",
  score: 68,
  summary:
    "Credential-stuffing traffic is targeting the customer portal from two hosting ranges.",
  signals: [
    "2 credential-stuffing bursts blocked",
    "1 expiring certificate within 9 days",
    "3 critical findings awaiting triage",
  ],
};

export const quickActions: QuickAction[] = [
  {
    id: "new-scan",
    label: "Start New Scan",
    description: "Launch a guided VAPT assessment",
    href: "/scanner",
    icon: "scan",
    accent: "accent",
  },
  {
    id: "ssl",
    label: "Analyze SSL",
    description: "Inspect certificate chains and expiry",
    href: "/ssl-analyzer",
    icon: "ssl",
    accent: "success",
  },
  {
    id: "reports",
    label: "View Reports",
    description: "Open signed assessment reports",
    href: "/reports",
    icon: "reports",
    accent: "violet",
  },
  {
    id: "threats",
    label: "View Threat Feed",
    description: "Review live intelligence signals",
    href: "/threat-intelligence",
    icon: "threat",
    accent: "danger",
  },
  {
    id: "ai",
    label: "Open AI Assistant",
    description: "Ask the SOC copilot for context",
    href: "/ai-assistant",
    icon: "ai",
    accent: "blue",
  },
];

export const recentActivity: MockActivity[] = [
  {
    id: "evt-scan-1",
    kind: "scan_completed",
    title: "Perimeter scan completed",
    description: "app.acme.io · 42 checks · 2 new findings",
    actor: "Scanner",
    minutesAgo: 4,
    severity: "medium",
    href: "/reports",
  },
  {
    id: "evt-threat-1",
    kind: "threat",
    title: "Credential stuffing burst blocked",
    description: "184 attempts from 185.220.101.0/24 were denied.",
    actor: "Threat engine",
    minutesAgo: 11,
    severity: "high",
    href: "/threat-intelligence",
  },
  {
    id: "evt-vuln-1",
    kind: "vulnerability",
    title: "Critical exposure confirmed",
    description: "Unauthenticated admin console on edge-gateway-01.",
    actor: "Nuclei",
    minutesAgo: 26,
    severity: "critical",
    href: "/findings?severity=critical",
  },
  {
    id: "evt-ssl-1",
    kind: "ssl_expiring",
    title: "Certificate expires in 9 days",
    description: "api.acme.io · Let's Encrypt R11 · auto-renew off.",
    actor: "SSL monitor",
    minutesAgo: 48,
    severity: "high",
    href: "/ssl-analyzer",
  },
  {
    id: "evt-key-1",
    kind: "api_key",
    title: "API key created",
    description: "ci-pipeline · read:scans · expires in 30 days.",
    actor: "Priya Nair",
    minutesAgo: 76,
    severity: "informational",
    href: "/api-keys",
  },
  {
    id: "evt-admin-1",
    kind: "admin_action",
    title: "Role policy updated",
    description: "Analyst role gained scanner:configure.",
    actor: "Alex Morgan",
    minutesAgo: 132,
    severity: "medium",
    href: "/audit",
  },
  {
    id: "evt-login-1",
    kind: "login",
    title: "New device signed in",
    description: "Chrome on macOS · Singapore · trusted after MFA.",
    actor: "Alex Morgan",
    minutesAgo: 187,
    severity: "low",
    href: "/activity",
  },
  {
    id: "evt-scan-fail-1",
    kind: "scan_failed",
    title: "Scheduled scan failed",
    description: "staging.acme.io timed out after 3 connection retries.",
    actor: "Scheduler",
    minutesAgo: 311,
    severity: "medium",
    href: "/scanner",
  },
];

export const mockFindings: MockFinding[] = [
  {
    id: "SEC-1042",
    title: "Unauthenticated admin console exposed",
    target: "edge-gateway-01.acme.io",
    severity: "critical",
    cvss: 9.8,
    status: "open",
    category: "Exposure",
    detectedMinutesAgo: 26,
    owner: "Unassigned",
  },
  {
    id: "SEC-1039",
    title: "Public object storage allows bucket listing",
    target: "s3://acme-prod-assets",
    severity: "critical",
    cvss: 9.1,
    status: "accepted-risk",
    category: "Cloud storage",
    detectedMinutesAgo: 190,
    owner: "Priya Nair",
  },
  {
    id: "SEC-1036",
    title: "Remote code execution in outdated image parser",
    target: "media-api.acme.io",
    severity: "critical",
    cvss: 9.6,
    status: "in-progress",
    category: "Application",
    detectedMinutesAgo: 410,
    owner: "Marcus Lee",
  },
  {
    id: "SEC-1028",
    title: "TLS 1.0 still enabled on payment gateway",
    target: "pay.acme.io",
    severity: "high",
    cvss: 8.2,
    status: "open",
    category: "TLS configuration",
    detectedMinutesAgo: 730,
    owner: "Unassigned",
  },
  {
    id: "SEC-1024",
    title: "Over-permissive IAM role on build runner",
    target: "arn:aws:iam::4821:role/build-runner",
    severity: "high",
    cvss: 8.1,
    status: "accepted-risk",
    category: "Cloud IAM",
    detectedMinutesAgo: 1120,
    owner: "Priya Nair",
  },
  {
    id: "SEC-1019",
    title: "Outdated OpenSSL with known CVEs",
    target: "legacy-gateway.acme.io",
    severity: "high",
    cvss: 7.8,
    status: "open",
    category: "Patching",
    detectedMinutesAgo: 1480,
    owner: "Marcus Lee",
  },
  {
    id: "SEC-1014",
    title: "Missing HSTS on customer portal",
    target: "portal.acme.io",
    severity: "high",
    cvss: 7.4,
    status: "in-progress",
    category: "Security headers",
    detectedMinutesAgo: 2100,
    owner: "Dana Okafor",
  },
  {
    id: "SEC-1008",
    title: "Content-Security-Policy header absent",
    target: "app.acme.io",
    severity: "medium",
    cvss: 6.1,
    status: "open",
    category: "Security headers",
    detectedMinutesAgo: 2870,
    owner: "Dana Okafor",
  },
  {
    id: "SEC-1002",
    title: "DMARC policy set to none",
    target: "acme.io",
    severity: "medium",
    cvss: 5.8,
    status: "accepted-risk",
    category: "Email security",
    detectedMinutesAgo: 3610,
    owner: "Unassigned",
  },
  {
    id: "SEC-0997",
    title: "Directory listing enabled on static host",
    target: "static.acme.io",
    severity: "medium",
    cvss: 5.3,
    status: "open",
    category: "Misconfiguration",
    detectedMinutesAgo: 4400,
    owner: "Marcus Lee",
  },
  {
    id: "SEC-0991",
    title: "Session cookie missing SameSite attribute",
    target: "auth.acme.io",
    severity: "medium",
    cvss: 4.8,
    status: "in-progress",
    category: "Session security",
    detectedMinutesAgo: 5200,
    owner: "Dana Okafor",
  },
  {
    id: "SEC-0986",
    title: "Server banner discloses nginx version",
    target: "status.acme.io",
    severity: "low",
    cvss: 3.1,
    status: "open",
    category: "Information disclosure",
    detectedMinutesAgo: 6100,
    owner: "Unassigned",
  },
  {
    id: "SEC-0981",
    title: "Autocomplete enabled on sensitive form",
    target: "billing.acme.io",
    severity: "low",
    cvss: 2.6,
    status: "accepted-risk",
    category: "Application",
    detectedMinutesAgo: 7300,
    owner: "Dana Okafor",
  },
  {
    id: "SEC-0977",
    title: "Robots.txt exposes internal staging path",
    target: "www.acme.io",
    severity: "informational",
    cvss: 0,
    status: "open",
    category: "Information disclosure",
    detectedMinutesAgo: 8800,
    owner: "Unassigned",
  },
];

export const trendSparkline: TrendPoint[] = [
  { label: "Mon", score: 79, scans: 38 },
  { label: "Tue", score: 81, scans: 41 },
  { label: "Wed", score: 80, scans: 44 },
  { label: "Thu", score: 84, scans: 47 },
  { label: "Fri", score: 83, scans: 52 },
  { label: "Sat", score: 86, scans: 46 },
  { label: "Sun", score: 87, scans: 49 },
];
