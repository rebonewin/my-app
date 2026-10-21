"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  ActivityIcon,
  BanIcon,
  FingerprintIcon,
  LogOutIcon,
  MonitorIcon,
  RefreshIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { formatDate, initials, relativeTime, titleCase } from "@/lib/utils";

interface TargetUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  roleName: string;
  roleRank: number;
  emailVerified: boolean;
  twoFactorEnabled: boolean | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  mustChangePassword: boolean | null;
  passwordChangedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginMethod: string | null;
}

interface ProfileResponse {
  user: TargetUser;
  counts: {
    sessions: number;
    devices: number;
    passkeys: number;
    loginHistory: number;
  };
  canForceLogout: boolean;
  canViewSessions: boolean;
  canViewAudit: boolean;
}

interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  deviceId: string | null;
  revokedAt: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  category: string;
  severity: string;
  description: string | null;
  ipAddress: string | null;
  success: boolean;
  createdAt: string;
}

type Tab = "overview" | "sessions" | "audit";

const severityTone = (severity: string) => {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "warning" || severity === "medium") return "amber" as const;
  return "neutral" as const;
};

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[11px] text-slate-300">{value}</span>
    </div>
  );
}

export function AdminUserDetail({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/admin/users/${userId}?scope=profile`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | ProfileResponse
      | { error: string }
      | null;

    if (!response.ok || !data || "error" in data) {
      setError(
        data && "error" in data && data.error
          ? data.error
          : "Could not load this account.",
      );
      return;
    }

    setProfile(data);
  }, [userId]);

  const loadScope = useCallback(
    async (scope: "sessions" | "audit") => {
      setScopeLoading(true);
      setError(null);
      const response = await fetch(
        `/api/admin/users/${userId}?scope=${scope}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | { sessions?: SessionRow[]; audit?: AuditRow[]; error: string }
        | null;

      setScopeLoading(false);

      if (!response.ok || !data) {
        setError(data?.error ?? "Could not load this data.");
        return;
      }

      if (scope === "sessions") setSessions(data.sessions ?? []);
      else setAudit(data.audit ?? []);
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      await loadProfile();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  function openTab(next: Tab) {
    setTab(next);
    setNotice(null);
    if (next === "sessions" && sessions === null) void loadScope("sessions");
    if (next === "audit" && audit === null) void loadScope("audit");
  }

  async function forceLogout() {
    if (!profile) return;
    if (
      !window.confirm(
        `Force logout ${profile.user.email}? Every session and remembered device will be revoked.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => null)) as
      | { sessionsRevoked?: number; error?: string }
      | null;

    setBusy(false);

    if (!response.ok) {
      setError(data?.error ?? "Could not force logout this account.");
      return;
    }

    const revoked = data?.sessionsRevoked ?? 0;
    setNotice(
      `${revoked} session${revoked === 1 ? "" : "s"} revoked. Remembered devices were cleared too.`,
    );
    setSessions(null);
    setAudit(null);
    await loadProfile();
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-xs text-slate-500">Loading account…</p>
        </CardBody>
      </Card>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <Alert tone="error" title="Account unavailable">
          {error ?? "Could not load this account."}
        </Alert>
        <Link
          href="/admin/users"
          className="text-xs text-cyan-300 hover:text-cyan-200"
        >
          ← Back to users
        </Link>
      </div>
    );
  }

  const { user, counts } = profile;

  const tabs: Array<{ id: Tab; label: string; hidden: boolean }> = [
    { id: "overview", label: "Overview", hidden: false },
    { id: "sessions", label: "Sessions", hidden: !profile.canViewSessions },
    { id: "audit", label: "Audit history", hidden: !profile.canViewAudit },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/users"
          className="text-xs text-slate-400 transition hover:text-white"
        >
          ← Back to users
        </Link>
        <Button
          size="sm"
          variant="secondary"
          loading={refreshing}
          onClick={() => {
            void (async () => {
              setRefreshing(true);
              await loadProfile();
              if (tab === "sessions") await loadScope("sessions");
              if (tab === "audit") await loadScope("audit");
              setRefreshing(false);
            })();
          }}
        >
          <RefreshIcon size={13} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert tone="error" title="Something went wrong">
          {error}
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
              {initials(user.name ?? user.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {user.name ?? "Unnamed user"}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="cyan">{user.roleName}</Badge>
                <Badge tone={user.emailVerified ? "green" : "amber"}>
                  {user.emailVerified ? "email verified" : "email unverified"}
                </Badge>
                <Badge tone={user.twoFactorEnabled ? "green" : "neutral"}>
                  {user.twoFactorEnabled ? "2FA on" : "2FA off"}
                </Badge>
                {user.banned ? (
                  <Badge tone="red">
                    <BanIcon size={11} />
                    banned
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          {profile.canForceLogout ? (
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={() => void forceLogout()}
            >
              <LogOutIcon size={14} />
              Force logout
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs
          .filter((entry) => !entry.hidden)
          .map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openTab(entry.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                tab === entry.id
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Sessions"
              value={counts.sessions}
              icon={<MonitorIcon size={13} />}
            />
            <Stat
              label="Devices"
              value={counts.devices}
              icon={<UsersIcon size={13} />}
            />
            <Stat
              label="Passkeys"
              value={counts.passkeys}
              icon={<FingerprintIcon size={13} />}
            />
            <Stat
              label="Sign-ins"
              value={counts.loginHistory}
              icon={<ActivityIcon size={13} />}
            />
          </div>

          <Card>
            <CardHeader
              title="Account posture"
              description="Authentication state and the last known activity."
            />
            <CardBody className="py-2">
              <Detail label="User ID" value={<code>{user.id}</code>} />
              <Detail label="Role" value={`${user.roleName} (rank ${user.roleRank})`} />
              <Detail label="Created" value={formatDate(user.createdAt)} />
              <Detail
                label="Last login"
                value={
                  user.lastLoginAt
                    ? `${formatDate(user.lastLoginAt)} · ${relativeTime(user.lastLoginAt)}`
                    : "never"
                }
              />
              <Detail label="Last method" value={user.lastLoginMethod ?? "—"} />
              <Detail
                label="Password changed"
                value={
                  user.passwordChangedAt
                    ? formatDate(user.passwordChangedAt)
                    : "never"
                }
              />
              <Detail
                label="Must change password"
                value={user.mustChangePassword ? "yes" : "no"}
              />
              {user.banned ? (
                <>
                  <Detail label="Ban reason" value={user.banReason ?? "—"} />
                  <Detail
                    label="Ban expires"
                    value={user.banExpires ? formatDate(user.banExpires) : "never"}
                  />
                </>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "sessions" ? (
        <Card>
          <CardHeader
            title="Sessions"
            description="Every credential currently bound to this account."
            action={
              <Button
                size="sm"
                variant="secondary"
                loading={scopeLoading}
                onClick={() => void loadScope("sessions")}
              >
                <RefreshIcon size={13} />
                Refresh
              </Button>
            }
          />
          <CardBody className="p-0">
            {scopeLoading && sessions === null ? (
              <p className="px-5 py-6 text-xs text-slate-500">Loading sessions…</p>
            ) : sessions && sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">IP</th>
                      <th className="px-5 py-2.5 font-medium">Client</th>
                      <th className="px-5 py-2.5 font-medium">Started</th>
                      <th className="px-5 py-2.5 font-medium">Last active</th>
                      <th className="px-5 py-2.5 font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sessions.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-3 text-slate-300">
                          {row.ipAddress ?? "—"}
                        </td>
                        <td className="max-w-[280px] truncate px-5 py-3 text-slate-400">
                          {row.userAgent ?? "Unknown client"}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {relativeTime(row.lastActiveAt)}
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {formatDate(row.expiresAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-xs text-slate-500">
                No live sessions. The account is signed out everywhere.
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "audit" ? (
        <Card>
          <CardHeader
            title="Audit history"
            description="Most recent 100 events attributed to this account."
            action={
              <Button
                size="sm"
                variant="secondary"
                loading={scopeLoading}
                onClick={() => void loadScope("audit")}
              >
                <RefreshIcon size={13} />
                Refresh
              </Button>
            }
          />
          <CardBody className="p-0">
            {scopeLoading && audit === null ? (
              <p className="px-5 py-6 text-xs text-slate-500">Loading audit…</p>
            ) : audit && audit.length > 0 ? (
              <ul className="divide-y divide-white/[0.04]">
                {audit.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 text-slate-600">
                        <ShieldIcon size={13} />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200">
                          {titleCase(row.action)}
                          <Badge tone={severityTone(row.severity)}>
                            {row.severity}
                          </Badge>
                          {!row.success ? <Badge tone="red">failed</Badge> : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {row.description ?? row.category}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-slate-600">
                      <p>{formatDate(row.createdAt)}</p>
                      <p>{row.ipAddress ?? "—"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-xs text-slate-500">
                No audit events recorded for this account yet.
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
