import Link from "next/link";
import { and, desc, eq, gt, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  StatTile,
  severityTone,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  ActivityIcon,
  AlertIcon,
  BuildingIcon,
  CheckIcon,
  FileIcon,
  KeyIcon,
  MailIcon,
  RadarIcon,
  ShieldIcon,
  UsersIcon,
  XIcon,
} from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { configuredProviders } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  auditLog,
  loginHistory,
  member,
  organization,
  scan,
  securityEvent,
  session,
  user,
} from "@/lib/db/schema";
import { daysAgo, formatDate } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Administration · 1Security",
};

export default async function AdminPage() {
  const context = await requirePermission("dashboard:admin", { next: "/admin" });

  let databaseOnline = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    databaseOnline = false;
  }

  const [
    [userStats],
    [sessionStats],
    [scanStats],
    [orgStats],
    [memberStats],
    [eventStats],
    [failedStats],
    recentAudit,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${user.createdAt} > now() - interval '7 days')::int`,
        verified: sql<number>`count(*) filter (where ${user.emailVerified})::int`,
        twoFactor: sql<number>`count(*) filter (where ${user.twoFactorEnabled})::int`,
        banned: sql<number>`count(*) filter (where ${user.banned})::int`,
      })
      .from(user),
    db
      .select({ active: sql<number>`count(*)::int` })
      .from(session)
      .where(gt(session.expiresAt, new Date())),
    db
      .select({
        total: sql<number>`count(*)::int`,
        last24: sql<number>`count(*) filter (where ${scan.createdAt} > now() - interval '24 hours')::int`,
        highRisk: sql<number>`count(*) filter (where ${scan.riskLevel} in ('critical','high'))::int`,
      })
      .from(scan),
    db.select({ total: sql<number>`count(*)::int` }).from(organization),
    db.select({ total: sql<number>`count(*)::int` }).from(member),
    db
      .select({
        open: sql<number>`count(*) filter (where ${securityEvent.status} = 'open')::int`,
        critical: sql<number>`count(*) filter (where ${securityEvent.severity} in ('critical','high'))::int`,
      })
      .from(securityEvent),
    db
      .select({ failed: sql<number>`count(*)::int` })
      .from(loginHistory)
      .where(
        and(
          eq(loginHistory.status, "failed"),
          gt(loginHistory.createdAt, daysAgo(1)),
        ),
      ),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        category: auditLog.category,
        severity: auditLog.severity,
        actorEmail: auditLog.actorEmail,
        description: auditLog.description,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(8),
  ]);

  const providers = [
    { name: "Google", enabled: configuredProviders.google },
    { name: "GitHub", enabled: configuredProviders.github },
    { name: "Microsoft", enabled: configuredProviders.microsoft },
    { name: "LinkedIn", enabled: configuredProviders.linkedin },
    { name: "Apple", enabled: configuredProviders.apple },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Administration"
        description={`Signed in as ${context.user.email}. Platform-wide telemetry, identity health and configuration gaps.`}
        actions={
          <>
            <ButtonLink href="/admin/users" size="sm" variant="secondary">
              <UsersIcon size={14} />
              Users
            </ButtonLink>
            <ButtonLink href="/audit" size="sm" variant="outline">
              Audit log
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total users"
          value={userStats?.total ?? 0}
          hint={`${userStats?.recent ?? 0} new in 7 days`}
          tone="cyan"
          icon={<UsersIcon size={16} />}
        />
        <StatTile
          label="Active sessions"
          value={sessionStats?.active ?? 0}
          hint={`${userStats?.twoFactor ?? 0} accounts with 2FA`}
          tone="green"
          icon={<ActivityIcon size={16} />}
        />
        <StatTile
          label="Scans (24h)"
          value={scanStats?.last24 ?? 0}
          hint={`${scanStats?.total ?? 0} total · ${scanStats?.highRisk ?? 0} high risk`}
          tone="violet"
          icon={<RadarIcon size={16} />}
        />
        <StatTile
          label="Open events"
          value={eventStats?.open ?? 0}
          hint={`${eventStats?.critical ?? 0} high or critical`}
          tone={(eventStats?.open ?? 0) > 0 ? "red" : "green"}
          icon={<AlertIcon size={16} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Recent platform activity"
            description="Most recent audit entries across every actor."
            action={
              <Link
                href="/audit"
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                Full log
              </Link>
            }
          />
          <CardBody className="p-0">
            {recentAudit.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-slate-500">
                No audit entries yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5">
                      <Badge tone={severityTone(entry.severity)}>
                        {entry.category}
                      </Badge>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-slate-200">
                        <span className="font-mono text-[11px] text-cyan-300/80">
                          {entry.action}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {entry.description ?? "No description"}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {entry.actorEmail ?? "system"} ·{" "}
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="System health"
              description="Live configuration state. Gaps are explicit, never faked."
            />
            <CardBody className="space-y-2">
              <HealthRow
                ok={databaseOnline}
                label="Postgres"
                detail={
                  databaseOnline
                    ? "Connected via transaction pooler"
                    : "Connection failed"
                }
              />
              <HealthRow
                ok={configuredProviders.email}
                label="Transactional email"
                detail={
                  configuredProviders.email
                    ? "SMTP or Resend configured"
                    : "Set SMTP_* or RESEND_API_KEY"
                }
              />
              <HealthRow
                ok={configuredProviders.sms}
                label="SMS OTP"
                detail={
                  configuredProviders.sms
                    ? "Twilio configured"
                    : "Set TWILIO_* to enable"
                }
              />
              <HealthRow
                ok={Boolean(process.env.BETTER_AUTH_URL)}
                label="Canonical auth URL"
                detail={
                  process.env.BETTER_AUTH_URL ??
                  "Set BETTER_AUTH_URL for passkeys"
                }
              />
              <HealthRow
                ok={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
                label="Supabase storage"
                detail={
                  process.env.SUPABASE_SERVICE_ROLE_KEY
                    ? "Service role present"
                    : "Optional for auth-only deployments"
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Identity providers"
              description="OAuth clients are enabled by their credentials."
            />
            <CardBody className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-300">{provider.name}</span>
                  {provider.enabled ? (
                    <Badge tone="green">
                      <CheckIcon size={10} /> connected
                    </Badge>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <XIcon size={10} /> not configured
                    </span>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickLink
          href="/admin/users"
          icon={<UsersIcon size={16} />}
          title="User management"
          detail={`${userStats?.total ?? 0} accounts · ${userStats?.banned ?? 0} banned`}
        />
        <QuickLink
          href="/organization"
          icon={<BuildingIcon size={16} />}
          title="Organizations"
          detail={`${orgStats?.total ?? 0} tenants · ${memberStats?.total ?? 0} memberships`}
        />
        <QuickLink
          href="/api-keys"
          icon={<KeyIcon size={16} />}
          title="API keys"
          detail="Machine credentials for CI and SOAR"
        />
        <QuickLink
          href="/reports"
          icon={<FileIcon size={16} />}
          title="Reports"
          detail={`${scanStats?.total ?? 0} persisted assessments`}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <MailIcon size={13} className="text-cyan-400" />
          {failedStats?.failed ?? 0} failed sign-in
          {(failedStats?.failed ?? 0) === 1 ? "" : "s"} in the last 24 hours
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldIcon size={13} className="text-emerald-400" />
          {userStats?.verified ?? 0} verified · {userStats?.twoFactor ?? 0}{" "}
          with 2FA
        </span>
        <span className="ml-auto text-slate-600">
          Role: {context.user.role}
        </span>
      </div>
    </div>
  );
}

function HealthRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
      <span
        className={
          ok
            ? "h-1.5 w-1.5 rounded-full bg-emerald-400"
            : "h-1.5 w-1.5 rounded-full bg-amber-400"
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-300">{label}</p>
        <p className="truncate text-[10px] text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.03]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300">
        {icon}
      </span>
      <p className="mt-2.5 text-xs font-medium text-white group-hover:text-cyan-200">
        {title}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
    </Link>
  );
}
