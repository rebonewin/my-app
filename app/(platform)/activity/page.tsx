import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  StatTile,
} from "@/components/ui/card";
import { ActivityIcon, CheckIcon, GlobeIcon, XIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { loginHistory } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Login activity · 1Security",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const context = await requirePermission("audit:read", { next: "/activity" });
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status === "success" || params.status === "failed"
      ? params.status
      : undefined;
  const pageSize = 30;

  const where = status
    ? sql`${loginHistory.userId} = ${context.user.id} and ${loginHistory.status} = ${status}`
    : eq(loginHistory.userId, context.user.id);

  const [rows, [counts]] = await Promise.all([
    db
      .select()
      .from(loginHistory)
      .where(where)
      .orderBy(desc(loginHistory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        total: sql<number>`count(*)::int`,
        success: sql<number>`count(*) filter (where ${loginHistory.status} = 'success')::int`,
        failed: sql<number>`count(*) filter (where ${loginHistory.status} = 'failed')::int`,
        countries: sql<number>`count(distinct ${loginHistory.country})::int`,
      })
      .from(loginHistory)
      .where(eq(loginHistory.userId, context.user.id)),
  ]);

  const total = counts?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function href(nextStatus?: string, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextStatus) query.set("status", nextStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    return query.size ? `/activity?${query.toString()}` : "/activity";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Identity"
        title="Login activity"
        description="A complete, append-only record of authentication attempts: method, result, device, network address and resolved location."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total attempts"
          value={counts?.total ?? 0}
          tone="cyan"
          icon={<ActivityIcon size={16} />}
        />
        <StatTile
          label="Successful"
          value={counts?.success ?? 0}
          tone="green"
          icon={<CheckIcon size={16} />}
        />
        <StatTile
          label="Failed"
          value={counts?.failed ?? 0}
          tone={(counts?.failed ?? 0) > 0 ? "red" : "green"}
          icon={<XIcon size={16} />}
        />
        <StatTile
          label="Countries seen"
          value={counts?.countries ?? 0}
          tone="violet"
          icon={<GlobeIcon size={16} />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[
          { id: undefined, label: "All" },
          { id: "success", label: "Successful" },
          { id: "failed", label: "Failed" },
        ].map((option) => (
          <Link
            key={option.label}
            href={href(option.id)}
            className={
              status === option.id
                ? "rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200"
                : "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-white/10 hover:text-white"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon size={20} />}
              title="No authentication activity"
              description="Sign-ins from this account will appear here with device and network context."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Result</th>
                    <th className="px-3 py-3 font-medium">Method</th>
                    <th className="px-3 py-3 font-medium">Device</th>
                    <th className="px-3 py-3 font-medium">Network</th>
                    <th className="px-3 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Badge tone={row.status === "success" ? "green" : "red"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 uppercase tracking-wide text-slate-400">
                        {row.method}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-300">
                          {row.browser ?? "Unknown"}
                          {row.os ? ` · ${row.os}` : ""}
                        </p>
                        <p className="text-[10px] text-slate-600">
                          {row.deviceType ?? "unknown"}
                          {row.isBot ? " · bot" : ""}
                          {row.isTor ? " · tor" : ""}
                          {row.isVpn ? " · vpn" : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-400">
                        {row.ipAddress ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {[row.city, row.region, row.country]
                          .filter(Boolean)
                          .join(", ") || "Unknown"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={href(status, page - 1)}
                className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={href(status, page + 1)}
                className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
