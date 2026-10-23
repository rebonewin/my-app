import Link from "next/link";

import {
  AlertIcon,
  CertificateIcon,
  RadarIcon,
  ServerIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from "@/components/ui/icons";
import { SocIconTile } from "@/components/ui/soc";
import type { AssetDashboardStats } from "@/types/assets";

const cards = [
  {
    key: "total",
    label: "Total assets",
    icon: ServerIcon,
    accent: "accent" as const,
    href: "/assets",
    caption: "registered in scope",
  },
  {
    key: "active",
    label: "Active assets",
    icon: ShieldCheckIcon,
    accent: "success" as const,
    href: "/assets?status=active",
    caption: "monitored and scannable",
  },
  {
    key: "atRisk",
    label: "Assets at risk",
    icon: AlertIcon,
    accent: "danger" as const,
    href: "/assets?riskLevel=high",
    caption: "critical or high risk",
  },
  {
    key: "expiringSsl",
    label: "SSL expiring",
    icon: CertificateIcon,
    accent: "warning" as const,
    href: "/assets?sort=risk",
    caption: "within the next 30 days",
  },
  {
    key: "recentlyAdded",
    label: "Recently added",
    icon: TrendingUpIcon,
    accent: "violet" as const,
    href: "/assets?sort=recent",
    caption: "in the last 30 days",
  },
  {
    key: "scansLast30Days",
    label: "Scans (30d)",
    icon: RadarIcon,
    accent: "blue" as const,
    href: "/scans",
    caption: "queued or completed",
  },
];

export function AssetSummaryCards({ stats }: { stats: AssetDashboardStats }) {
  return (
    <section aria-label="Asset inventory summary">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              href={card.href}
              className="group rounded-2xl border border-soc-border bg-soc-panel p-3.5 outline-none transition hover:-translate-y-0.5 hover:border-soc-border-strong hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <div className="flex items-start justify-between gap-2">
                <SocIconTile
                  accent={card.accent}
                  className="h-8 w-8 rounded-lg"
                >
                  <Icon size={15} />
                </SocIconTile>
              </div>
              <p className="mt-3 text-xl font-semibold tabular-nums tracking-tight text-soc-fg">
                {stats[card.key as keyof AssetDashboardStats]}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-soc-muted">
                {card.label}
              </p>
              <p className="mt-0.5 hidden text-[8.5px] text-soc-faint sm:block">
                {card.caption}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
