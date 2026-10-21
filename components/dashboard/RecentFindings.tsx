import Link from "next/link";

import { ArrowRightIcon, BugIcon } from "@/components/ui/icons";
import {
  SocBadge,
  SocCard,
  SocCardHeader,
  SocEmptyState,
} from "@/components/ui/soc";
import type { Finding } from "@/types/dashboard";
import { relativeTime } from "@/lib/utils";
import { SEVERITY_META } from "@/lib/soc/severity";
import { FINDING_STATUS_META } from "@/lib/soc/findings";

export function RecentFindings({ findings }: { findings: Finding[] }) {
  return (
    <SocCard className="overflow-hidden">
      <SocCardHeader
        title="Recent findings"
        description="Highest-signal exposures from the latest assessments"
        action={
          <Link
            href="/findings"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-soc-accent outline-none transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            View all
            <ArrowRightIcon size={11} />
          </Link>
        }
      />

      {findings.length === 0 ? (
        <SocEmptyState
          icon={<BugIcon size={18} />}
          title="No recent findings"
          description="The last scan did not surface anything that needs attention."
        />
      ) : (
        <ul className="divide-y divide-soc-border">
          {findings.map((finding) => (
            <li key={finding.id}>
              <Link
                href={`/findings?severity=${finding.severity}`}
                className="group flex items-start gap-3 px-4 py-3.5 outline-none transition hover:bg-soc-hover focus-visible:bg-soc-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-soc-accent/50 sm:px-5"
              >
                <SocBadge
                  tone={finding.severity}
                  className="mt-0.5 hidden w-[5.4rem] justify-center sm:inline-flex"
                >
                  {SEVERITY_META[finding.severity].label}
                </SocBadge>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[11.5px] font-medium text-soc-fg transition group-hover:text-soc-accent">
                      {finding.title}
                    </p>
                    <span className="shrink-0 text-[9px] text-soc-faint">
                      {relativeTime(finding.detectedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-soc-muted">
                    {finding.target}
                    <span className="mx-1.5 text-soc-faint">·</span>
                    {finding.category}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <SocBadge
                      tone={finding.severity}
                      className="sm:hidden"
                    >
                      {SEVERITY_META[finding.severity].label}
                    </SocBadge>
                    <SocBadge tone={FINDING_STATUS_META[finding.status].tone}>
                      {FINDING_STATUS_META[finding.status].label}
                    </SocBadge>
                    <span className="text-[9px] text-soc-faint">
                      {finding.id}
                    </span>
                    <span className="hidden text-[9px] text-soc-faint lg:inline">
                      Owner · {finding.owner}
                    </span>
                  </div>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] font-semibold tabular-nums text-soc-fg">
                    {finding.cvss.toFixed(1)}
                  </p>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-soc-faint">
                    CVSS
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SocCard>
  );
}
