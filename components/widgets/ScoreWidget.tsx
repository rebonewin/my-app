import { SocBadge } from "@/components/ui/soc";
import type { ScoreWidgetData } from "@/types/dashboard";
import { ScoreRing } from "./ScoreRing";
import { WidgetDelta, WidgetShell } from "./WidgetShell";

export function ScoreWidget({
  widget,
  loading = false,
}: {
  widget: ScoreWidgetData;
  loading?: boolean;
}) {
  const empty = widget.value === null;

  return (
    <WidgetShell
      label={widget.label}
      icon="shield"
      accent="success"
      href={widget.href}
      loading={loading}
      empty={empty}
      emptyTitle="Score unavailable"
      emptyDescription="Complete a scan to establish a measured baseline."
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className="text-[2.55rem] font-semibold leading-none tracking-[-0.04em] text-soc-fg">
              {widget.value}
            </span>
            <span className="text-[11px] font-medium text-soc-faint">/100</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <WidgetDelta value={widget.delta} tone="positive" />
            <span className="text-[10px] text-soc-faint">vs last week</span>
          </p>
        </div>
        <ScoreRing
          value={widget.value ?? 0}
          grade={widget.grade}
          size={78}
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="truncate text-[10px] text-soc-faint">
          {widget.caption}
        </span>
        <SocBadge tone="success" className="shrink-0">
          Top {100 - widget.percentile}%
        </SocBadge>
      </div>
    </WidgetShell>
  );
}
