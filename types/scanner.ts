/** Shared scan-profile, queue and history contracts. */

export const SCAN_MODULES = [
  "http",
  "headers",
  "technology",
  "tls",
  "cookies",
  "cors",
  "robots",
  "ports",
  "compliance",
] as const;
export type ScanModule = (typeof SCAN_MODULES)[number];

export const SCAN_MODULE_LABELS: Record<ScanModule, string> = {
  http: "HTTP response",
  headers: "Security headers",
  technology: "Technology discovery",
  tls: "TLS certificate",
  cookies: "Cookie controls",
  cors: "CORS policy",
  robots: "Robots discovery",
  ports: "Service exposure",
  compliance: "Compliance evidence",
};

export const SCAN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const ACTIVE_SCAN_STATUSES: ScanStatus[] = ["pending", "running"];

export interface ScanProfileSummary {
  id: string;
  name: string;
  description: string;
  modules: ScanModule[];
  isSystem: boolean;
  createdAt: string | null;
}

export interface ScanQueueItem {
  id: string;
  assetId: string | null;
  assetName: string | null;
  target: string;
  profileId: string | null;
  profileName: string | null;
  profileModules: string[];
  status: ScanStatus;
  progress: number;
  currentModule: string | null;
  riskLevel: string;
  riskScore: number;
  securityScore: number;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ScanQueueData {
  items: ScanQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ScanStatus, number>;
}

export interface ScanFilters {
  status?: ScanStatus | "active";
  assetId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ScanFindingSummary {
  id: string;
  title: string;
  severity: string;
  category: string;
  cvss: number;
  status: string;
  fingerprint: string;
}

export interface ScanComparison {
  baselineId: string;
  candidateId: string;
  scoreDelta: number;
  riskScoreDelta: number;
  severityDelta: Record<string, number>;
  introduced: ScanFindingSummary[];
  resolved: ScanFindingSummary[];
}

export interface ScanDetailData {
  scan: ScanQueueItem;
  findings: ScanFindingSummary[];
  ssl: {
    issuer: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysRemaining: number | null;
    protocol: string | null;
  } | null;
  comparison: ScanComparison | null;
}

export interface CreateScanProfileInput {
  name: string;
  description?: string;
  modules: ScanModule[];
}

export interface QueueScanInput {
  assetId: string;
  profileId?: string;
}
