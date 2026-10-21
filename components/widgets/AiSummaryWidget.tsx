import Link from "next/link";

import { SparklesIcon } from "@/components/ui/icons";
import { SocBadge } from "@/components/ui/soc";
import type { AiWidgetData } from "@/types/dashboard";
import { WidgetShell } from "./WidgetShell";

export function AiSummaryWidget({
  widget,
  loading = false,
}: {
  widget: AiWidgetData;
  loading?: boolean;
}) {
  const empty = !widget.headline || !widget.summary;

  return (
    <WidgetShell
      label={widget.label}
      icon="sparkles"
      accent="violet"
      loading={loading}
      empty={empty}
      emptyTitle="AI summary unavailable"
      emptyDescription="A summary appears once the assistant has enough grounded telemetry."
      className="border-soc-violet/25 bg-gradient-to-br from-soc-violet-soft via-soc-panel to-soc-accent-soft"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-soc-violet">
              <SparklesIcon size={10} />
              {Math.round((widget.confidence ?? 0) * 100)}% confidence
            </span>
            <span className="text-[9px] text-soc-faint">
              · {widget.updatedLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {widget.actions.slice(0, 2).map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group/action inline-flex items-center gap-1 text-[10px] font-medium text-soc-accent outline-none transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
              >
                {action.label}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold leading-snug text-soc-fg">
            {widget.headline}
          </p>
          <SocBadge tone="violet" className="shrink-0">
            Grounded
          </SocBadge>
        </div>
        <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-soc-muted">
          {widget.summary}
        </p>
      </div>
    </WidgetShell>
  );
}
