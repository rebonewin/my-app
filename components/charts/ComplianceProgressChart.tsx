import { SocBadge, SocProgress } from "@/components/ui/soc";
import type {
  ComplianceChartData,
  ComplianceStatus,
} from "@/types/dashboard";

const statusTone: Record<
  ComplianceStatus,
  { tone: "success" | "medium" | "critical"; label: string }
> = {
  "on-track": { tone: "success", label: "On track" },
  "at-risk": { tone: "medium", label: "At risk" },
  overdue: { tone: "critical", label: "Overdue" },
};

export function ComplianceProgressChart({
  data,
}: {
  data: ComplianceChartData;
}) {
  const controls = data.frameworks.reduce(
    (sum, framework) => sum + framework.controls,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-soc-fg">
            {data.overall}%
          </p>
          <p className="mt-0.5 text-[10px] text-soc-faint">
            Weighted control coverage · {controls} controls
          </p>
        </div>
        <SocBadge tone="success">+6.4% QoQ</SocBadge>
      </div>

      <div className="mt-auto space-y-3.5">
        {data.frameworks.map((framework) => {
          const status = statusTone[framework.status];
          return (
            <div key={framework.name}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[11px] text-soc-muted">
                    {framework.name}
                  </span>
                  <SocBadge tone={status.tone} className="hidden sm:inline-flex">
                    {status.label}
                  </SocBadge>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-soc-faint">
                  <span className="font-semibold text-soc-fg">
                    {framework.percent}%
                  </span>{" "}
                  · {framework.controls}
                </span>
              </div>
              <SocProgress
                value={framework.percent}
                tone={framework.percent >= 80 ? "success" : "warning"}
                label={`${framework.name} compliance coverage`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
