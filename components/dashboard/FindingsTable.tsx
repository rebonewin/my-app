import { BugIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocEmptyState,
} from "@/components/ui/soc";
import { FINDING_STATUS_META } from "@/lib/soc/findings";
import { SEVERITY_META } from "@/lib/soc/severity";
import type { Finding } from "@/types/dashboard";
import { relativeTime } from "@/lib/utils";

export function FindingsTable({ findings }: { findings: Finding[] }) {
  return (
    <SocCard className="overflow-hidden">
      <div className="hidden grid-cols-[7rem_minmax(0,1fr)_4.5rem_7rem_8rem] gap-3 border-b border-soc-border bg-soc-elevated/40 px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint md:grid">
        <span>Severity</span>
        <span>Finding</span>
        <span>CVSS</span>
        <span>Status</span>
        <span className="text-right">Detected</span>
      </div>

      {findings.length === 0 ? (
        <SocEmptyState
          icon={<BugIcon size={18} />}
          title="No findings in this band"
          description="Try another severity filter or run a fresh assessment."
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="grid gap-2.5 px-4 py-3.5 transition hover:bg-soc-hover/60 md:grid-cols-[7rem_minmax(0,1fr)_4.5rem_7rem_8rem] md:items-start md:gap-3 md:px-5"
            >
              <div>
                <SocBadge tone={finding.severity}>
                  {SEVERITY_META[finding.severity].label}
                </SocBadge>
              </div>

              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-soc-fg">
                  {finding.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-soc-muted">
                  {finding.target}
                  <span className="mx-1.5 text-soc-faint">·</span>
                  {finding.category}
                  <span className="mx-1.5 text-soc-faint">·</span>
                  {finding.id}
                </p>
                <p className="mt-1 text-[9px] text-soc-faint md:hidden">
                  Owner · {finding.owner}
                </p>
              </div>

              <div className="flex items-center gap-2 md:block">
                <span className="text-[9px] uppercase tracking-[0.12em] text-soc-faint md:hidden">
                  CVSS
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-soc-fg">
                  {finding.cvss.toFixed(1)}
                </span>
              </div>

              <div>
                <SocBadge tone={FINDING_STATUS_META[finding.status].tone}>
                  {FINDING_STATUS_META[finding.status].label}
                </SocBadge>
              </div>

              <div className="flex items-center justify-between gap-2 md:block md:text-right">
                <span className="text-[10px] text-soc-muted">
                  {relativeTime(finding.detectedAt)}
                </span>
                <span className="hidden text-[9px] text-soc-faint md:mt-0.5 md:block">
                  {finding.owner}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SocCard>
  );
}
