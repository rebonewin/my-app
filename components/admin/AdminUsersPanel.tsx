"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, severityTone } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  BanIcon,
  CheckIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { formatDate, initials, relativeTime } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  roleName: string;
  roleRank: number;
  emailVerified: boolean | null;
  twoFactorEnabled: boolean | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginMethod: string | null;
}

export interface AdminRoleOption {
  slug: string;
  name: string;
  rank: number;
}

export function AdminUsersPanel({
  selfId,
  roleOptions,
  canSetRole,
  canBan,
}: {
  selfId: string;
  roleOptions: AdminRoleOption[];
  canSetRole: boolean;
  canBan: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: String(targetPage) });
      if (query) params.set("q", query);
      if (role) params.set("role", role);

      try {
        const response = await fetch(`/api/admin/users?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          setError(payload?.error ?? "Could not load users.");
          return;
        }

        setRows(payload.users as AdminUserRow[]);
        setPage(payload.pagination.page);
        setPages(payload.pagination.pages);
        setTotal(payload.pagination.total);
      } catch {
        setError("Network error while loading users.");
      } finally {
        setLoading(false);
      }
    },
    [query, role],
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/users?page=1")
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(payload?.error ?? "Could not load users.");
          setLoading(false);
          return;
        }

        setRows(payload.users as AdminUserRow[]);
        setPage(payload.pagination.page);
        setPages(payload.pagination.pages);
        setTotal(payload.pagination.total);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error while loading users.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function mutate(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setBusyId(userId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "The action could not be completed.");
        return false;
      }

      setMessage(payload?.message ?? "User updated.");
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(row: AdminUserRow, nextRole: string) {
    if (nextRole === row.role) return;
    const ok = await mutate(row.id, { action: "set-role", role: nextRole });
    if (ok) await load(page);
  }

  async function ban(row: AdminUserRow) {
    const reason = window.prompt(
      `Reason for banning ${row.email}:`,
      "Policy violation",
    );
    if (!reason || reason.trim().length < 3) return;

    const ok = await mutate(row.id, {
      action: "ban",
      reason: reason.trim(),
    });
    if (ok) await load(page);
  }

  async function unban(row: AdminUserRow) {
    if (!confirm(`Lift the ban on ${row.email}?`)) return;
    const ok = await mutate(row.id, { action: "unban" });
    if (ok) await load(page);
  }

  return (
    <div className="space-y-4">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <CardBody className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form
            className="flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(q.trim());
            }}
          >
            <label
              htmlFor="user-search"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500"
            >
              Search
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <SearchIcon size={15} />
              </span>
              <Input
                id="user-search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Name or email"
                className="pl-10"
              />
            </div>
          </form>

          <div className="w-full lg:w-52">
            <label
              htmlFor="user-role"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500"
            >
              Role
            </label>
            <Select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">All roles</option>
              {roleOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </Select>
          </div>

          <Button type="button" variant="secondary" onClick={() => void load(1)}>
            <RefreshIcon size={14} />
            Refresh
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <p className="flex items-center gap-2 text-[11px] text-slate-400">
              <UsersIcon size={13} className="text-cyan-400" />
              {total} account{total === 1 ? "" : "s"}
            </p>
            <span className="text-[10px] text-slate-600">
              Page {page} of {pages}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-lg bg-white/[0.03]"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-slate-500">
              No accounts match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Account</th>
                    <th className="px-3 py-3 font-medium">Role</th>
                    <th className="px-3 py-3 font-medium">Security</th>
                    <th className="px-3 py-3 font-medium">Last sign-in</th>
                    <th className="px-3 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map((row) => {
                    const self = row.id === selfId;

                    return (
                      <tr
                        key={row.id}
                        className={
                          row.banned
                            ? "bg-red-500/[0.03] transition hover:bg-red-500/[0.05]"
                            : "transition hover:bg-white/[0.02]"
                        }
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-cyan-200">
                              {initials(row.name || row.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate text-slate-200">
                                {row.name || "Unnamed"}
                                {self ? (
                                  <span className="text-[9px] uppercase tracking-wider text-cyan-400">
                                    you
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {row.email}
                              </p>
                              {row.banned ? (
                                <p className="truncate text-[10px] text-red-400">
                                  Banned: {row.banReason ?? "no reason given"}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {canSetRole && !self ? (
                            <Select
                              value={row.role ?? "customer"}
                              disabled={busyId !== null}
                              onChange={(event) =>
                                changeRole(row, event.target.value)
                              }
                              className="h-8 w-40 text-[11px]"
                              aria-label={`Role for ${row.email}`}
                            >
                              {roleOptions.map((option) => (
                                <option key={option.slug} value={option.slug}>
                                  {option.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Badge tone={severityTone(roleTone(row.roleRank))}>
                              {row.roleName}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              tone={row.emailVerified ? "green" : "amber"}
                            >
                              {row.emailVerified ? "verified" : "unverified"}
                            </Badge>
                            <Badge
                              tone={row.twoFactorEnabled ? "green" : "neutral"}
                            >
                              {row.twoFactorEnabled ? "2FA" : "no 2FA"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {row.lastLoginAt
                            ? relativeTime(row.lastLoginAt)
                            : "Never"}
                          {row.lastLoginMethod ? (
                            <p className="text-[10px] text-slate-600">
                              {row.lastLoginMethod}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {self ? (
                            <span className="text-[10px] text-slate-600">—</span>
                          ) : canBan ? (
                            row.banned ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busyId === row.id}
                                disabled={busyId !== null}
                                onClick={() => unban(row)}
                              >
                                <CheckIcon size={13} />
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="danger"
                                loading={busyId === row.id}
                                disabled={busyId !== null}
                                onClick={() => ban(row)}
                              >
                                <BanIcon size={13} />
                                Ban
                              </Button>
                            )
                          ) : (
                            <span className="text-[10px] text-slate-600">
                              <ShieldIcon size={11} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {pages > 1 ? (
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pages || loading}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function roleTone(rank: number): string {
  if (rank >= 90) return "critical";
  if (rank >= 70) return "high";
  if (rank >= 40) return "medium";
  return "low";
}
