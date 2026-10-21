export type SocIconName =
  | "gauge"
  | "radar"
  | "lock"
  | "fingerprint"
  | "server"
  | "shieldcheck"
  | "globe"
  | "scale"
  | "file"
  | "sparkles"
  | "settings";

export interface SocNavItem {
  href: string;
  label: string;
  description: string;
  icon: SocIconName;
  match?: string[];
}

export interface SocNavSection {
  id: string;
  label: string;
  items: SocNavItem[];
}

/**
 * Module registry for the SOC shell.
 *
 * Adding a module (VAPT, SSL, threat intel, …) is intentionally a data change:
 * add a page under `app/(soc)`, append its entry here, and ship. The shell,
 * command palette, breadcrumbs and active-state logic all consume this list.
 */
export const SOC_NAV_SECTIONS: SocNavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        description: "Security posture, risk and live activity",
        icon: "gauge",
      },
    ],
  },
  {
    id: "offensive",
    label: "Offensive security",
    items: [
      {
        href: "/scanner",
        label: "VAPT Scanner",
        description: "Run authorised vulnerability assessments",
        icon: "radar",
        match: ["/scanner", "/vapt"],
      },
      {
        href: "/ssl-analyzer",
        label: "SSL Analyzer",
        description: "Certificate chains, expiry and protocol health",
        icon: "lock",
      },
      {
        href: "/technology",
        label: "Technology Fingerprinting",
        description: "Identify exposed stacks and versions",
        icon: "fingerprint",
      },
      {
        href: "/assets",
        label: "Assets",
        description: "Inventory and risk classification",
        icon: "server",
      },
    ],
  },
  {
    id: "posture",
    label: "Posture & intelligence",
    items: [
      {
        href: "/security-score",
        label: "Security Score",
        description: "Control coverage and score history",
        icon: "shieldcheck",
        match: ["/security-score", "/findings"],
      },
      {
        href: "/threat-intelligence",
        label: "Threat Intelligence",
        description: "Live adversary and exposure signals",
        icon: "globe",
      },
      {
        href: "/compliance",
        label: "Audit & Compliance",
        description: "Framework evidence and control coverage",
        icon: "scale",
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        href: "/reports",
        label: "Reports",
        description: "Signed assessment reports",
        icon: "file",
      },
      {
        href: "/ai-assistant",
        label: "AI Security Assistant",
        description: "Context-aware security guidance",
        icon: "sparkles",
      },
      {
        href: "/settings",
        label: "Settings",
        description: "Workspace and account configuration",
        icon: "settings",
      },
    ],
  },
];

export const SOC_NAV_ITEMS = SOC_NAV_SECTIONS.flatMap(
  (section) => section.items,
);

export const SOC_PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/findings", title: "Findings" },
  ...SOC_NAV_ITEMS.map((item) => ({ prefix: item.href, title: item.label })),
];

export function isSocNavActive(item: SocNavItem, pathname: string): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function socPageTitle(pathname: string): string {
  const match = SOC_PAGE_TITLES.find(
    (entry) =>
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  return match?.title ?? "Security Operations";
}
