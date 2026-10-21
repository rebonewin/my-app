import Link from "next/link";

import { ArrowRightIcon, GlobeIcon } from "@/components/ui/icons";
import { SocBadge, SocCard, SocProgress, SocIconTile } from "@/components/ui/soc";
import type { ThreatLevel } from "@/types/dashboard";

const levelTone: Record<
  ThreatLevel["level"],
  "success" | "medium" | "critical"
> = {
  low: "success",
  guarded: "success",
  elevated: "medium",
  high: "critical",
  critical: "critical",
};

export function ThreatLevelCard({ threatLevel }: { threatLevel: ThreatLevel }) {
  const tone = levelTone[threatLevel.level];

  return (
    <SocCard className="relative overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-soc-medium/10 blur-2xl"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-soc-faint">
            <SocIconTile accent="warning" className="h-7 w-7 rounded-lg">
              <GlobeIcon size={14} />
            </SocIconTile>
            Threat level
          </span>
          <SocBadge tone={tone}>{threatLevel.level}</SocBadge>
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <p className="text-[1.8rem] font-semibold leading-none tracking-[-0.03em] text-soc-fg">
            {threatLevel.score}
            <span className="text-[10px] font-normal text-soc-faint">/100</span>
          </p>
          <span className="text-[9px] text-soc-faint">Elevated risk</span>
        </div>

        <SocProgress
          value={threatLevel.score}
          tone="warning"
          className="mt-3"
          label="Current threat level"
        />

        <p className="mt-3 text-[10px] leading-relaxed text-soc-muted">
          {threatLevel.summary}
        </p>

        <ul className="mt-3 space-y-1.5">
          {threatLevel.signals.map((signal) => (
            <li
              key={signal}
              className="flex items-start gap-2 text-[9.5px] leading-relaxed text-soc-faint"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-soc-medium" />
              {signal}
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-soc-border pt-3">
          <Link
            href="/threat-intelligence"
            className="group inline-flex items-center gap-1.5 text-[10px] font-medium text-soc-accent outline-none transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            Open threat feed
            <ArrowRightIcon
              size={11}
              className="transition group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </SocCard>
  );
}
