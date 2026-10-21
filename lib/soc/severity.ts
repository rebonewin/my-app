import type { Severity } from "@/types/dashboard";

export const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
];

export const SEVERITY_META: Record<
  Severity,
  {
    label: string;
    description: string;
    cvss: string;
    href: string;
    tone: "critical" | "high" | "medium" | "low" | "informational";
  }
> = {
  critical: {
    label: "Critical",
    description: "Exploitable now, with direct business impact.",
    cvss: "9.0 – 10.0",
    href: "/findings?severity=critical",
    tone: "critical",
  },
  high: {
    label: "High",
    description: "Serious exposure that needs a remediation owner.",
    cvss: "7.0 – 8.9",
    href: "/findings?severity=high",
    tone: "high",
  },
  medium: {
    label: "Medium",
    description: "Meaningful weakness with compensating factors.",
    cvss: "4.0 – 6.9",
    href: "/findings?severity=medium",
    tone: "medium",
  },
  low: {
    label: "Low",
    description: "Hardening gap with limited exploitability.",
    cvss: "0.1 – 3.9",
    href: "/findings?severity=low",
    tone: "low",
  },
  informational: {
    label: "Informational",
    description: "Observation or best-practice recommendation.",
    cvss: "0.0",
    href: "/findings?severity=informational",
    tone: "informational",
  },
};
