import type { Severity } from "@/types/dashboard";

export const FINDING_STATUSES = [
  "open",
  "in-progress",
  "resolved",
  "accepted-risk",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const ACTIVE_FINDING_STATUSES: FindingStatus[] = [
  "open",
  "in-progress",
];

export interface FindingRecord {
  id: string;
  assetId: string;
  assetName: string;
  assetTarget: string;
  lastScanId: string | null;
  title: string;
  description: string | null;
  severity: Severity;
  category: string;
  status: FindingStatus;
  cvss: number;
  remediation: string | null;
  assignedTo: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindingFilterInput {
  severity?: Severity;
  status?: FindingStatus;
  category?: string;
  assetId?: string;
  query?: string;
  sort?: "recent" | "severity" | "cvss" | "asset" | "status";
}

export interface FindingCounts {
  status: Record<FindingStatus, number>;
  severity: Record<Severity, number>;
  total: number;
}

export interface FindingsPageData {
  findings: FindingRecord[];
  counts: FindingCounts;
  categories: string[];
}
