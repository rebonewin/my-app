import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { SecurityEventActions } from "@/components/security/SecurityEventActions";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatTile,
  severityTone,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { securityEvent } from "@/lib/db/schema";
import { formatDate, titleCase } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Security centre · 1Security",
};

export default async function SecurityPage() {
  const context = await requirePermission("security:read", { next: "/security" });

  const [events, [counts]] = await Promise.all([
    db
      .select()
      .from(securityEvent)
      .where(eq(securityEvent.userId, context.user.id))
      .orderBy(desc(securityEvent.createdAt))
      .limit(100),
    db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${securityEvent.status} = 'open')::int`,
        critical: sql<number>`count(*) filter (where ${securityEvent.severity} in ('critical','high'))::int`,
        resolved: sql<number>`count(*) filter (where ${securityEvent.status} <> 'open')::int`,
      })
      .from(securityEvent)
      .where(eq(securityEvent.userId, context.user.id)),
  ]);

  const canResolve = context.permissions.has("security:resolve");
  const canDismiss = context.permissions.has("security:dismiss");

  return (
    <div>
      <PageHeader
        eyebrow="Threat detection"
        title="Security centre"
        description="Every risk-scored sign-in, impossible-travel verdict, brute-force lockout and new-device signal lands here. Nothing is silently dropped."
        actions={
          <ButtonLink href="/settings/security" size="sm" variant="outline">
            Harden account
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open events"
          value={counts?.open ?? 0}
          tone={(counts?.open ?? 0) > 0 ? "red" : "green"}
          icon={<AlertIcon size={16} />}
        />
        <StatTile
          label="High / critical"
          value={counts?.critical ?? 0}
          tone={(counts?.critical ?? 0) > 0 ? "amber" : "green"}
          icon={<ShieldIcon size={16} />}
        />
        <StatTile
          label="Resolved"
          value={counts?.resolved ?? 0}
          tone="green"
          icon={<CheckIcon size={16} />}
        />
        <StatTile
          label="Total events"
          value={counts?.total ?? 0}
          tone="cyan"
          icon={<ClockIcon size={16} />}
        />
      </div>

      <Card>
        <CardHeader
          title="Security events"
          description="Newest first. Events are scoped to your account."
          action={
            <Badge tone={canResolve ? "green" : "neutral"}>
              {canResolve ? "You can resolve" : "Read only"}
            </Badge>
          }
        />
        <CardBody className="p-0">
          {events.length === 0 ? (
            <EmptyState
              icon={<ShieldIcon size={20} />}
              title="No security events"
              description="The threat engine has not flagged anything on this account. Sign-ins from new locations, brute force and impossible travel will appear here automatically."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {events.map((event) => (
                <li key={event.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={severityTone(event.severity)}>
                          {event.severity}
                        </Badge>
                        <Badge tone={event.status === "open" ? "amber" : "green"}>
                          {event.status}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">
                          {titleCase(event.type)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">
                        {event.title}
                      </p>
                      {event.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          {event.description}
                        </p>
                      ) : null}
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                        <span>{formatDate(event.createdAt)}</span>
                        <span>·</span>
                        <span>risk {event.riskScore}/100</span>
                        {event.ipAddress ? (
                          <>
                            <span>·</span>
                            <span className="font-mono">{event.ipAddress}</span>
                          </>
                        ) : null}
                        {event.city || event.country ? (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <GlobeIcon size={10} />
                              {[event.city, event.country]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </>
                        ) : null}
                        {event.actionTaken ? (
                          <>
                            <span>·</span>
                            <span>action: {event.actionTaken}</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <SecurityEventActions
                        eventId={event.id}
                        status={event.status}
                        canResolve={canResolve}
                        canDismiss={canDismiss}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Impossible travel",
            body: "Two sign-ins from locations that cannot be reached in the elapsed time are flagged and risk-scored.",
          },
          {
            title: "Brute force & spraying",
            body: "Failed attempts are counted per account and per IP. Repeated failures trigger a temporary lockout.",
          },
          {
            title: "Network reputation",
            body: "Tor exits, VPNs and hosting ranges raise the risk score before a session is trusted.",
          },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <p className="text-xs font-medium text-white">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {item.body}
            </p>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-600">
        Need the platform-wide view?{" "}
        <Link href="/audit" className="text-cyan-500/80 hover:text-cyan-300">
          Open the audit log
        </Link>
        .
      </p>
    </div>
  );
}
