import { SocProgress } from "@/components/ui/soc";
import type { ComplianceWidgetData } from "@/types/dashboard";
import { WidgetShell } from "./WidgetShell";

export function ComplianceWidget({
  widget,
  loading = false,
}: {
  widget: ComplianceWidgetData;
  loading?: boolean;
}) {
  const empty = widget.value === null;

  return (
    <WidgetShell
      label={widget.label}
      icon="scale"
      accent="blue"
      href={widget.href}
      loading={loading}
      empty={empty}
      emptyTitle="No framework evidence"
      emptyDescription="Connect an audit framework to start tracking control coverage."
      footer={
        <p className="truncate text-[10px] text-soc-faint">{widget.hint}</p>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <p className="text-[2.15rem] font-semibold leading-none tracking-[-0.03em] text-soc-fg">
          {widget.value}
          <span className="ml-0.5 text-base font-medium text-soc-muted">%</span>
        </p>
        <span className="mb-0.5 text-[10px] text-soc-faint">
          {widget.frameworks.length} frameworks
        </span>
      </div>

      <div className="mt-auto space-y-2 pt-3">
        {widget.frameworks.map((framework) => (
          <div key={framework.name}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] text-soc-muted">
                {framework.name}
              </span>
              <span className="text-[10px] font-medium text-soc-fg">
                {framework.percent}%
              </span>
            </div>
            <SocProgress
              value={framework.percent}
              tone={framework.percent >= 80 ? "success" : "warning"}
              label={`${framework.name} coverage`}
            />
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
