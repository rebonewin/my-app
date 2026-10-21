import Link from "next/link";

import {
  AlertIcon,
  BugIcon,
  CertificateIcon,
  FingerprintIcon,
  GlobeIcon,
  KeyIcon,
  RadarIcon,
  UserCogIcon,
} from "@/components/ui/icons";
import { SocBadge, SocCard, SocCardHeader, SocIconTile } from "@/components/ui/soc";
import type {
  ActivityEvent,
  ActivityKind,
  WidgetAccent,
} from "@/types/dashboard";
import { relativeTime } from "@/lib/utils";

const activityConfig: Record<
  ActivityKind,
  { icon: React.ReactNode; accent: WidgetAccent }
> = {
  scan_completed: { icon: <RadarIcon size={15} />, accent: "accent" },
  scan_failed: { icon: <AlertIcon size={15} />, accent: "danger" },
  vulnerability: { icon: <BugIcon size={15} />, accent: "danger" },
  ssl_expiring: { icon: <CertificateIcon size={15} />, accent: "warning" },
  login: { icon: <FingerprintIcon size={15} />, accent: "blue" },
  admin_action: { icon: <UserCogIcon size={15} />, accent: "violet" },
  api_key: { icon: <KeyIcon size={15} />, accent: "accent" },
  threat: { icon: <GlobeIcon size={15} />, accent: "danger" },
};

export function ActivityFeed({
  events,
  className,
}: {
  events: ActivityEvent[];
  className?: string;
}) {
  return (
    <SocCard className={className}>
      <SocCardHeader
        title={
          <span className="flex items-center gap-2">
            Activity stream
            <SocBadge tone="success" className="normal-case tracking-normal">
              <span className="soc-live-dot h-1.5 w-1.5 rounded-full bg-soc-success" />
              Live
            </SocBadge>
          </span>
        }
        description={`${events.length} events from connected telemetry`}
        action={
          <Link
            href="/activity"
            className="text-[10px] font-medium text-soc-accent outline-none transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            View all
          </Link>
        }
        className="px-4 py-3.5"
      />

      <ol className="divide-y divide-soc-border">
        {events.map((event) => {
          const config = activityConfig[event.kind];
          const content = (
            <div className="flex gap-3 px-4 py-3.5">
              <SocIconTile
                accent={config.accent}
                className="h-8 w-8 rounded-lg"
              >
                {config.icon}
              </SocIconTile>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium leading-snug text-soc-fg">
                    {event.title}
                  </p>
                  <time className="shrink-0 text-[9px] text-soc-faint">
                    {relativeTime(event.occurredAt)}
                  </time>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-soc-muted">
                  {event.description}
                </p>
                <p className="mt-1 text-[9px] text-soc-faint">{event.actor}</p>
              </div>
            </div>
          );

          return (
            <li key={event.id}>
              {event.href ? (
                <Link
                  href={event.href}
                  className="group block outline-none transition hover:bg-soc-hover focus-visible:bg-soc-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-soc-accent/50"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </SocCard>
  );
}
