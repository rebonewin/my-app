import type { SocIconName } from "@/lib/soc/navigation";
import type { WidgetAccent } from "@/types/dashboard";

export interface ModuleMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ModuleCapability {
  title: string;
  description: string;
}

export interface SocModulePreview {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: SocIconName;
  accent: WidgetAccent;
  phase: string;
  metrics: ModuleMetric[];
  capabilities: ModuleCapability[];
}

export const SOC_MODULE_PREVIEWS: Record<string, SocModulePreview> = {
  "ssl-analyzer": {
    slug: "ssl-analyzer",
    title: "SSL Analyzer",
    eyebrow: "Transport security",
    description:
      "Continuously inspect certificate chains, protocol versions, cipher suites and renewal windows across every exposed endpoint.",
    icon: "lock",
    accent: "success",
    phase: "Phase 2 module",
    metrics: [
      { label: "Endpoints monitored", value: "186", detail: "Across 42 domains" },
      { label: "Healthy certificates", value: "96.8%", detail: "+1.4% this week" },
      { label: "Expiring in 30 days", value: "4", detail: "1 auto-renew disabled" },
    ],
    capabilities: [
      {
        title: "Chain validation",
        description:
          "Detect incomplete chains, untrusted roots and hostname mismatches at TLS handshake time.",
      },
      {
        title: "Protocol hygiene",
        description:
          "Flag TLS 1.0/1.1, weak ciphers and legacy renegotiation before they reach production.",
      },
      {
        title: "Renewal runway",
        description:
          "Track expiry, issuer and automation state with escalation windows you can tune.",
      },
    ],
  },
  technology: {
    slug: "technology",
    title: "Technology Fingerprinting",
    eyebrow: "Attack surface",
    description:
      "Map the frameworks, servers, CDNs and JavaScript libraries behind each asset — with version-level exposure context.",
    icon: "fingerprint",
    accent: "violet",
    phase: "Phase 2 module",
    metrics: [
      { label: "Technologies found", value: "1,492", detail: "Across 248 assets" },
      { label: "Outdated components", value: "37", detail: "12 high risk" },
      { label: "Shadow services", value: "9", detail: "Unregistered stacks" },
    ],
    capabilities: [
      {
        title: "Version intelligence",
        description:
          "Correlate detected versions with known CVEs and end-of-life timelines.",
      },
      {
        title: "Ownership hints",
        description:
          "Group shared infrastructure by certificate, ASN and response fingerprints.",
      },
      {
        title: "Change detection",
        description:
          "Alert when a stack, framework or server header changes between scans.",
      },
    ],
  },
  "security-score": {
    slug: "security-score",
    title: "Security Score",
    eyebrow: "Measured posture",
    description:
      "A transparent, evidence-backed score built from control coverage, exposure, remediation velocity and identity hygiene.",
    icon: "shieldcheck",
    accent: "accent",
    phase: "Phase 2 module",
    metrics: [
      { label: "Current score", value: "87", detail: "Grade A- · top 8%" },
      { label: "30-day change", value: "+6.2", detail: "12 controls improved" },
      { label: "Target", value: "90", detail: "3 points to target" },
    ],
    capabilities: [
      {
        title: "Explainable scoring",
        description:
          "Every point maps to a control or evidence record — no opaque vendor formulas.",
      },
      {
        title: "Peer benchmarks",
        description:
          "Compare posture against anonymised cohorts of similar size and sector.",
      },
      {
        title: "Board-ready history",
        description:
          "Track score movement and the remediation work that produced it.",
      },
    ],
  },
  "threat-intelligence": {
    slug: "threat-intelligence",
    title: "Threat Intelligence",
    eyebrow: "Adversary signals",
    description:
      "Correlate authentication anomalies, credential-stuffing infrastructure and exposed-service chatter into one live feed.",
    icon: "globe",
    accent: "danger",
    phase: "Phase 2 module",
    metrics: [
      { label: "Active signals", value: "18", detail: "3 elevated" },
      { label: "Blocked attempts", value: "1,847", detail: "Last 24 hours" },
      { label: "Watchlist matches", value: "6", detail: "2 new today" },
    ],
    capabilities: [
      {
        title: "Attacker infrastructure",
        description:
          "Cluster hostile IPs by ASN, hosting range and shared TLS fingerprints.",
      },
      {
        title: "Exposure correlation",
        description:
          "Connect scanner findings to real-world exploitation signals and CISA KEV entries.",
      },
      {
        title: "Analyst workflow",
        description:
          "Assign, suppress and escalate signals with an immutable decision trail.",
      },
    ],
  },
  compliance: {
    slug: "compliance",
    title: "Audit & Compliance",
    eyebrow: "Evidence & controls",
    description:
      "Turn technical telemetry into audit-ready evidence for SOC 2, ISO 27001, GDPR and PCI DSS — without spreadsheet drift.",
    icon: "scale",
    accent: "blue",
    phase: "Phase 2 module",
    metrics: [
      { label: "Overall coverage", value: "81%", detail: "4 frameworks tracked" },
      { label: "Controls evidenced", value: "236", detail: "92% automated" },
      { label: "Evidence gaps", value: "17", detail: "6 need an owner" },
    ],
    capabilities: [
      {
        title: "Control mapping",
        description:
          "Map one piece of evidence to many frameworks and eliminate duplicate collection.",
      },
      {
        title: "Evidence freshness",
        description:
          "Track collection dates, expiry and reviewer sign-off for every artifact.",
      },
      {
        title: "Audit timeline",
        description:
          "Export a scoped, timestamped evidence pack for external auditors.",
      },
    ],
  },
  "ai-assistant": {
    slug: "ai-assistant",
    title: "AI Security Assistant",
    eyebrow: "SOC copilot",
    description:
      "Ask questions about your posture, findings and evidence. Answers stay grounded in your workspace data, with citations and confidence.",
    icon: "sparkles",
    accent: "violet",
    phase: "Phase 2 module",
    metrics: [
      { label: "Grounded sources", value: "248", detail: "Assets + findings" },
      { label: "Avg. response", value: "1.8s", detail: "Streaming" },
      { label: "Confidence", value: "94%", detail: "Latest summary" },
    ],
    capabilities: [
      {
        title: "Evidence-grounded answers",
        description:
          "Every recommendation links back to the finding, control or asset that supports it.",
      },
      {
        title: "Triage acceleration",
        description:
          "Summarise clusters, draft remediation notes and identify likely owners.",
      },
      {
        title: "Safe by design",
        description:
          "Read-only tools by default; mutations require explicit human approval.",
      },
    ],
  },
  assets: {
    slug: "assets",
    title: "Assets",
    eyebrow: "Attack surface inventory",
    description:
      "A living inventory of domains, hosts, cloud resources and certificates — each classified by exposure and business risk.",
    icon: "server",
    accent: "accent",
    phase: "Phase 2 module",
    metrics: [
      { label: "Active assets", value: "248", detail: "+12 this month" },
      { label: "High-risk assets", value: "51", detail: "12 critical" },
      { label: "Unclassified", value: "22", detail: "Needs ownership" },
    ],
    capabilities: [
      {
        title: "Automatic discovery",
        description:
          "Expand seed domains into a deduplicated inventory across cloud and on-prem.",
      },
      {
        title: "Risk classification",
        description:
          "Score assets by exposure, findings, certificate health and business context.",
      },
      {
        title: "Ownership",
        description:
          "Assign owners and escalation paths so every asset has an accountable team.",
      },
    ],
  },
};

export function getModulePreview(slug: string): SocModulePreview {
  const preview = SOC_MODULE_PREVIEWS[slug];
  if (!preview) {
    throw new Error(`Unknown SOC module preview: ${slug}`);
  }
  return preview;
}
