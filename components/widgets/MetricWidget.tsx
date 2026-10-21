import { SocProgress } from "@/components/ui/soc";
import type { MetricWidgetData } from "@/types/dashboard";
import { WidgetDelta, WidgetShell } from "./WidgetShell";

function formatValue(widget: MetricWidgetData): string {
  if (widget.value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: widget.precision ?? 0,
    minimumFractionDigits: widget.precision ?? 0,
  }).format(widget.value);
}

export function MetricWidget({
  widget,
  loading = false,
}: {
  widget: MetricWidgetData;
  loading?: boolean;
}) {
  const empty = widget.value === null;

  return (
    <WidgetShell
      label={widget.label}
      icon={widget.icon}
      accent={widget.accent}
      href={widget.href}
      loading={loading}
      empty={empty}
      emptyTitle={`${widget.label} unavailable`}
      emptyDescription="Connect this data source or wait for the next telemetry cycle."
      footer={
        widget.hint ? (
          <p className="truncate text-[10px] text-soc-faint">{widget.hint}</p>
        ) : undefined
      }
    >
      <div className="flex items-end justify-between gap-3">
        <p className="text-[2.15rem] font-semibold leading-none tracking-[-0.03em] text-soc-fg">
          {widget.prefix}
          {formatValue(widget)}
          {widget.suffix ? (
            <span className="ml-0.5 text-base font-medium text-soc-muted">
              {widget.suffix}
            </span>
          ) : null}
        </p>
        {widget.delta !== undefined ? (
          <WidgetDelta
            value={widget.delta}
            tone={widget.deltaTone}
            suffix={widget.deltaSuffix ?? "%"}
          />
        ) : null}
      </div>

      {widget.deltaLabel ? (
        <p className="mt-2 text-[10px] text-soc-faint">{widget.deltaLabel}</p>
      ) : null}

      {typeof widget.progress === "number" ? (
        <div className="mt-auto pt-4">
          <SocProgress
            value={widget.progress}
            tone={widget.accent}
            label={`${widget.label} progress`}
          />
        </div>
      ) : null}
    </WidgetShell>
  );
}
