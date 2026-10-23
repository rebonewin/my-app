/** Shared asset-inventory contracts. */

export const ASSET_TYPES = [
  "website",
  "api",
  "web-application",
  "internal-service",
  "external-service",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_ENVIRONMENTS = [
  "production",
  "staging",
  "development",
] as const;
export type AssetEnvironment = (typeof ASSET_ENVIRONMENTS)[number];

export const ASSET_CRITICALITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type AssetCriticality = (typeof ASSET_CRITICALITIES)[number];

export const ASSET_STATUSES = ["active", "disabled"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_RISK_LEVELS = [
  "critical",
  "high",
  "medium",
  "low",
  "none",
  "unknown",
] as const;
export type AssetRiskLevel = (typeof ASSET_RISK_LEVELS)[number];

export interface AssetRecord {
  id: string;
  name: string;
  targetUrl: string;
  domain: string;
  ipAddress: string | null;
  type: AssetType;
  environment: AssetEnvironment;
  criticality: AssetCriticality;
  owner: string | null;
  tags: string[];
  description: string | null;
  status: AssetStatus;
  riskScore: number;
  riskLevel: AssetRiskLevel;
  openFindings: number;
  lastScanAt: string | null;
  lastScanId: string | null;
  sslExpiresAt: string | null;
  sslIssuer: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetInput {
  name: string;
  targetUrl: string;
  type: AssetType;
  environment: AssetEnvironment;
  criticality: AssetCriticality;
  owner?: string | null;
  tags: string[];
  description?: string | null;
  status: AssetStatus;
}

export interface AssetListFilters {
  query?: string;
  type?: AssetType;
  environment?: AssetEnvironment;
  criticality?: AssetCriticality;
  status?: AssetStatus;
  riskLevel?: AssetRiskLevel;
  sort?: "recent" | "name" | "risk" | "criticality" | "last-scan";
  page?: number;
  pageSize?: number;
}

export interface AssetDashboardStats {
  total: number;
  active: number;
  atRisk: number;
  recentlyAdded: number;
  expiringSsl: number;
  scansLast30Days: number;
}

export interface AssetDashboardData {
  stats: AssetDashboardStats;
  recentAssets: AssetRecord[];
  highestRiskAssets: AssetRecord[];
  expiringSslAssets: AssetRecord[];
}

export interface AssetScanSummary {
  id: string;
  status: string;
  profileName: string | null;
  riskLevel: string;
  riskScore: number;
  securityScore: number;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AssetSslSummary {
  id: string;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  protocol: string | null;
  createdAt: string;
}

export interface AssetFindingSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string;
  cvss: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AssetDetailData {
  asset: AssetRecord;
  scans: AssetScanSummary[];
  findings: AssetFindingSummary[];
  sslHistory: AssetSslSummary[];
}

export interface AssetSelectOption {
  id: string;
  name: string;
  targetUrl: string;
  criticality: AssetCriticality;
}
