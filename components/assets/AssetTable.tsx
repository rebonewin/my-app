import Link from "next/link";

import { ArrowRightIcon, ServerIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocEmptyState,
  SocProgress,
} from "@/components/ui/soc";
import { assetTypeLabel, criticalityMeta, riskMeta } from "@/lib/soc/assets";
import { formatDate, relativeTime } from "@/lib/utils";
import type { AssetRecord } from "@/types/assets";

export function AssetTable({
  assets,
  canManage,
}: {
  assets: AssetRecord[];
  canManage: boolean;
}) {
  return (
    <SocCard className="overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1.7fr)_7rem_6.5rem_8rem_8rem_3rem] gap-3 border-b border-soc-border bg-soc-elevated/40 px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint lg:grid">
        <span>Asset</span>
        <span>Type</span>
        <span>Criticality</span>
        <span>Risk</span>
        <span>Last scan</span>
        <span aria-hidden="true" />
      </div>

      {assets.length === 0 ? (
        <SocEmptyState
          icon={<ServerIcon size={18} />}
          title="No assets match this view"
          description="Register a target URL or clear the filters to see the full inventory."
          action={
            canManage ? (
              <Link
                href="/assets/new"
                className="text-[10px] font-semibold text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
              >
                Register an asset
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {assets.map((asset) => {
            const criticality = criticalityMeta(asset.criticality);
            const risk = riskMeta(asset.riskLevel);
            return (
              <li key={asset.id}>
                <Link
                  href={`/assets/${asset.id}`}
                  className="group grid gap-3 px-4 py-4 outline-none transition hover:bg-soc-hover/60 focus-visible:bg-soc-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-soc-accent/50 sm:px-5 lg:grid-cols-[minmax(0,1.7fr)_7rem_6.5rem_8rem_8rem_3rem] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12px] font-semibold text-soc-fg group-hover:text-soc-accent">
                        {asset.name}
                      </p>
                      {asset.status === "disabled" ? (
                        <SocBadge tone="neutral">Disabled</SocBadge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-soc-muted">
                      {asset.targetUrl}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-soc-faint">
                      <span>{asset.domain}</span>
                      {asset.ipAddress ? <span>· {asset.ipAddress}</span> : null}
                      <span>· {asset.environment}</span>
                      {asset.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-soc-accent/80">
                          · {tag}
                        </span>
                      ))}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint lg:hidden">
                      Type
                    </span>
                    <span className="text-[10px] text-soc-muted">
                      {assetTypeLabel(asset.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint lg:hidden">
                      Criticality
                    </span>
                    <SocBadge tone={criticality.tone}>{criticality.label}</SocBadge>
                  </div>

                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint lg:hidden">
                      Risk
                    </span>
                    <div className="flex items-center gap-2">
                      <SocBadge tone={risk.tone}>{risk.label}</SocBadge>
                      <span className="text-[10px] tabular-nums text-soc-muted">
                        {asset.riskScore}/100
                      </span>
                    </div>
                    <SocProgress
                      value={asset.riskScore}
                      tone={
                        asset.riskLevel === "critical"
                          ? "danger"
                          : asset.riskLevel === "high"
                            ? "warning"
                            : "success"
                      }
                      className="mt-1.5 max-w-24"
                      label={`${asset.name} risk score`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 lg:block">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint lg:hidden">
                      Last scan
                    </span>
                    <div>
                      <p className="text-[10px] text-soc-muted">
                        {asset.lastScanAt
                          ? relativeTime(asset.lastScanAt)
                          : "Never scanned"}
                      </p>
                      {asset.lastScanAt ? (
                        <p className="hidden text-[9px] text-soc-faint lg:block">
                          {formatDate(asset.lastScanAt)}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[9px] text-soc-faint">
                        {asset.openFindings} open finding
                        {asset.openFindings === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-soc-border text-soc-faint transition group-hover:border-soc-accent/40 group-hover:text-soc-accent">
                      <ArrowRightIcon size={13} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SocCard>
  );
}
