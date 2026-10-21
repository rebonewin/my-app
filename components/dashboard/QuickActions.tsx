import Link from "next/link";

import {
  ArrowRightIcon,
  CertificateIcon,
  FileIcon,
  GlobeIcon,
  RadarIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { SocIconTile } from "@/components/ui/soc";
import type { QuickAction, QuickActionIconName } from "@/types/dashboard";
import { cn } from "@/lib/utils";

const actionIcons: Record<QuickActionIconName, React.ReactNode> = {
  scan: <RadarIcon size={17} />,
  ssl: <CertificateIcon size={17} />,
  reports: <FileIcon size={17} />,
  threat: <GlobeIcon size={17} />,
  ai: <SparklesIcon size={17} />,
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-labelledby="quick-actions-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2
            id="quick-actions-title"
            className="text-sm font-semibold tracking-tight text-soc-fg"
          >
            Quick actions
          </h2>
          <p className="mt-0.5 text-[11px] text-soc-muted">
            Run the next move without leaving the command centre.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 text-[10px] text-soc-faint sm:flex">
          Keyboard-first
          <kbd className="rounded border border-soc-border bg-soc-elevated px-1.5 py-0.5 text-[9px]">
            ⌘K
          </kbd>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {actions.map((action, index) => (
          <Link
            key={action.id}
            href={action.href}
            className={cn(
              "group relative flex min-h-[92px] flex-col justify-between overflow-hidden rounded-2xl border border-soc-border bg-soc-panel p-3.5 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-soc-border-strong hover:bg-soc-elevated focus-visible:ring-2 focus-visible:ring-soc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-bg",
              index === actions.length - 1 && "col-span-2 sm:col-span-1",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <SocIconTile
                accent={action.accent}
                className="h-8 w-8 rounded-lg transition-transform duration-200 group-hover:scale-105"
              >
                {actionIcons[action.icon]}
              </SocIconTile>
              <ArrowRightIcon
                size={14}
                className="mt-1 text-soc-faint transition group-hover:translate-x-0.5 group-hover:text-soc-accent"
              />
            </div>
            <div className="mt-3 min-w-0">
              <p className="truncate text-[11.5px] font-semibold text-soc-fg">
                {action.label}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[9.5px] text-soc-faint">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
