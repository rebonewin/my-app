import Link from "next/link";

import { BugIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocEmptyState,
} from "@/components/ui/soc";
import { FindingStatusSelect } from "@/components/findings/FindingStatusSelect";
import { SEVERITY_META } from "@/lib/soc/severity";
import { relativeTime } from "@/lib/utils";
import type { FindingRecord } from "@/types/findings";

export function FindingsRegister({
  findings,
  canUpdate,
}: {
  findings: FindingRecord[];
  canUpdate: boolean;
}) {
  return (
    <SocCard className="overflow-hidden">
      <div className="hidden grid-cols-[7rem_minmax(0,1.6fr)_minmax(0,1fr)_4.5rem_9rem_7rem] gap-3 border-b border-soc-border bg-soc-elevated/40 px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint lg:grid">
        <span>Severity</span>
        <span>Finding</span>
        <span>Asset</span>
        <span>CVSS</span>
        <span>Status</span>
        <span className="text-right">Last seen</span>
      </div>

      {findings.length === 0 ? (
        <SocEmptyState
          icon={<BugIcon size={18} />}
          title="No findings match this view"
          description="Run a scan or clear the filters. New passive findings are normalized automatically after each queued scan."
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="grid gap-2.5 px-4 py-4 transition hover:bg-soc-hover/50 sm:px-5 lg:grid-cols-[7rem_minmax(0,1.6fr)_minmax(0,1fr)_4.5rem_9rem_7rem] lg:items-start lg:gap-3"
            >
              <div>
                <SocBadge tone={finding.severity}>
                  {SEVERITY_META[finding.severity].label}
                </SocBadge>
              </div>

              <div className="min-w-0">
                <p className="text-[12px] font-medium text-soc-fg">
                  {finding.title}
                </p>
                <p className="mt-0.5 text-[10px] text-soc-muted">
                  {finding.category}
                  <span className="mx-1.5 text-soc-faint">·</span>
                  <span className="font-mono text-[9px]">
                    {finding.id.slice(0, 8)}
                  </span>
                </p>
                <p className="mt-1 text-[9px] text-soc-faint lg:hidden">
                  {finding.assetName} · CVSS {finding.cvss.toFixed(1)}
                </p>
              </div>

              <div className="min-w-0">
                <Link
                  href={`/assets/${finding.assetId}`}
                  className="block truncate text-[10px] text-soc-muted outline-none hover:text-soc-accent focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                >
                  {finding.assetName}
                </Link>
                <p className="truncate font-mono text-[9px] text-soc-faint">
                  {finding.assetTarget}
                </p>
              </div>

              <div className="flex items-center gap-2 lg:block">
                <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint lg:hidden">
                  CVSS
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-soc-fg">
                  {finding.cvss.toFixed(1)}
                </span>
              </div>

              <div>
                <FindingStatusSelect
                  findingId={finding.id}
                  initialStatus={finding.status}
                  disabled={!canUpdate}
                />
              </div>

              <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
                <span className="text-[10px] text-soc-muted">
                  {relativeTime(finding.lastSeenAt)}
                </span>
                <span className="text-[9px] text-soc-faint lg:mt-0.5 lg:block">
                  {finding.firstSeenAt === finding.lastSeenAt
                    ? "first seen"
                    : "recurring"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SocCard>
  );
}
