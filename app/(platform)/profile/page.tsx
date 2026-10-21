import Link from "next/link";
import { and, count, eq, gt } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  CheckIcon,
  ClockIcon,
  FingerprintIcon,
  KeyIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  UsersIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  getActiveOrganization,
  getOrganizations,
  requireAuth,
} from "@/lib/auth/server";
import { db } from "@/lib/db";
import { passkey, session, user as userTable } from "@/lib/db/schema";
import { getRole } from "@/lib/rbac/permissions";
import { formatDate, initials, relativeTime } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Profile · 1Security",
  robots: { index: false },
};

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-200">{children}</dd>
    </div>
  );
}

function PostureRow({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "amber" | "neutral" | "cyan";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]"
    >
      <span className="flex items-center gap-2.5 text-xs text-slate-300">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <Badge tone={tone}>{value}</Badge>
    </Link>
  );
}

export default async function ProfilePage() {
  const context = await requireAuth("/profile");

  const [row, passkeyRows, sessionRows, organizations, activeOrganization] =
    await Promise.all([
      db
        .select()
        .from(userTable)
        .where(eq(userTable.id, context.user.id))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ value: count() })
        .from(passkey)
        .where(eq(passkey.userId, context.user.id)),
      db
        .select({ value: count() })
        .from(session)
        .where(
          and(
            eq(session.userId, context.user.id),
            gt(session.expiresAt, new Date()),
          ),
        ),
      getOrganizations(),
      getActiveOrganization(),
    ]);

  const name = row?.name ?? context.user.name ?? "Unnamed operator";
  const email = row?.email ?? context.user.email;
  const emailVerified = Boolean(
    row?.emailVerified ?? context.user.emailVerified,
  );
  const twoFactorEnabled = Boolean(
    row?.twoFactorEnabled ?? context.user.twoFactorEnabled,
  );
  const role = getRole(context.user.role ?? "customer");
  const passkeyCount = Number(passkeyRows[0]?.value ?? 0);
  const activeSessions = Number(sessionRows[0]?.value ?? 0);
  const organizationRole = activeOrganization?.role ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="The identity every audit entry, session and permission check is attributed to."
        actions={
          <>
            <ButtonLink href="/settings" size="sm" variant="secondary">
              Edit profile
            </ButtonLink>
            <ButtonLink href="/settings/security" size="sm" variant="outline">
              Security controls
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl font-bold text-slate-950">
                {initials(name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {name}
                  </h2>
                  <Badge tone={emailVerified ? "green" : "amber"}>
                    {emailVerified ? (
                      <>
                        <CheckIcon size={11} /> Verified
                      </>
                    ) : (
                      <>
                        <XIcon size={11} /> Unverified
                      </>
                    )}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-400">{email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="cyan">{role.name}</Badge>
                  {organizationRole ? (
                    <Badge tone="violet">{`${organizationRole} · ${activeOrganization?.name ?? ""}`}</Badge>
                  ) : (
                    <Badge tone="neutral">No active organization</Badge>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Account details"
              description="Immutable facts recorded when the account was provisioned."
            />
            <CardBody>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail label="Email address">
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon size={13} className="text-slate-500" />
                    {email}
                  </span>
                </Detail>
                <Detail label="Platform role">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheckIcon size={13} className="text-slate-500" />
                    {role.name} · rank {role.rank}
                  </span>
                </Detail>
                <Detail label="Organizations">
                  <span className="inline-flex items-center gap-1.5">
                    <UsersIcon size={13} className="text-slate-500" />
                    {organizations.length === 0
                      ? "Personal account only"
                      : `${organizations.length} membership${organizations.length === 1 ? "" : "s"}`}
                  </span>
                </Detail>
                <Detail label="Member since">
                  {formatDate(row?.createdAt ?? context.user.createdAt)}
                </Detail>
                <Detail label="Last sign-in">
                  <span className="inline-flex items-center gap-1.5">
                    <ClockIcon size={13} className="text-slate-500" />
                    {row?.lastLoginAt
                      ? `${relativeTime(row.lastLoginAt)} · ${formatDate(row.lastLoginAt)}`
                      : "No recorded sign-in"}
                  </span>
                </Detail>
                <Detail label="Last method">
                  {row?.lastLoginMethod
                    ? row.lastLoginMethod
                    : "Not recorded yet"}
                </Detail>
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Security posture"
              description="Live state of every factor protecting this account."
            />
            <CardBody className="space-y-2">
              <PostureRow
                icon={<MailIcon size={14} />}
                label="Email verification"
                value={emailVerified ? "Verified" : "Pending"}
                tone={emailVerified ? "green" : "amber"}
                href="/settings"
              />
              <PostureRow
                icon={<LockIcon size={14} />}
                label="Two-factor authentication"
                value={twoFactorEnabled ? "Enabled" : "Disabled"}
                tone={twoFactorEnabled ? "green" : "amber"}
                href="/settings/security"
              />
              <PostureRow
                icon={<FingerprintIcon size={14} />}
                label="Passkeys"
                value={
                  passkeyCount === 0
                    ? "None"
                    : `${passkeyCount} registered`
                }
                tone={passkeyCount > 0 ? "green" : "neutral"}
                href="/settings/security"
              />
              <PostureRow
                icon={<KeyIcon size={14} />}
                label="Active sessions"
                value={`${activeSessions}`}
                tone="cyan"
                href="/sessions"
              />
              <PostureRow
                icon={<ClockIcon size={14} />}
                label="Sign-in history"
                value="Review"
                tone="neutral"
                href="/activity"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Related controls" />
            <CardBody className="space-y-2 text-xs">
              <Link
                href="/devices"
                className="block rounded-lg px-2 py-1.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Trusted devices
              </Link>
              <Link
                href="/api-keys"
                className="block rounded-lg px-2 py-1.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Personal API keys
              </Link>
              <Link
                href="/organization"
                className="block rounded-lg px-2 py-1.5 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Organizations
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
