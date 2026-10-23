import Link from "next/link";

import { ArrowRightIcon, RadarIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocCardHeader,
  SocEmptyState,
} from "@/components/ui/soc";
import { scanStatusMeta } from "@/lib/soc/scans";
import { relativeTime } from "@/lib/utils";
import type { RecentScan } from "@/types/dashboard";

export function RecentScans({ scans }: { scans: RecentScan[] }) {
  return (
    <SocCard className="overflow-hidden">
      <SocCardHeader
        title="Recent scans"
        description="Queue activity across the asset inventory"
        action={
          <Link
            href="/scans"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-soc-accent outline-none transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            Queue
            <ArrowRightIcon size={11} />
          </Link>
        }
      />
      {scans.length === 0 ? (
        <SocEmptyState
          icon={<RadarIcon size={18} />}
          title="No scans recorded"
          description="Queue a profile against an asset to establish the first baseline."
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {scans.map((scan) => {
            const meta = scanStatusMeta(scan.status);
            return (
              <li key={scan.id}>
                <Link
                  href={`/scans/${scan.id}`}
                  className="group flex items-center gap-3 px-4 py-3.5 outline-none transition hover:bg-soc-hover focus-visible:bg-soc-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-soc-accent/50 sm:px-5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soc-hover text-soc-muted">
                    <RadarIcon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-medium text-soc-fg group-hover:text-soc-accent">
                        {scan.assetName}
                      </span>
                      <span className="shrink-0 text-[9px] text-soc-faint">
                        {relativeTime(scan.completedAt ?? scan.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] text-soc-muted">
                      {scan.profileName} · risk {scan.riskLevel} · score{" "}
                      {scan.securityScore}
                    </span>
                  </span>
                  <SocBadge tone={meta.tone}>{meta.label}</SocBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SocCard>
  );
}
