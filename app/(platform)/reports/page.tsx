import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  severityTone,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { DownloadIcon, FileIcon, RadarIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scan } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Reports · 1Security",
};

const RISK_FILTERS = ["all", "critical", "high", "medium", "low", "none"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string; page?: string }>;
}) {
  const context = await requirePermission("report:read", { next: "/reports" });
  const params = await searchParams;

  const risk = RISK_FILTERS.includes(
    (params.risk ?? "all") as (typeof RISK_FILTERS)[number],
  )
    ? (params.risk ?? "all")
    : "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 20;

  const isAdmin = context.permissions.has("dashboard:admin");
  const filters = [
    isAdmin ? undefined : eq(scan.userId, context.user.id),
    risk === "all" ? undefined : eq(scan.riskLevel, risk),
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const where = filters.length ? and(...filters) : undefined;

  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: scan.id,
        target: scan.target,
        hostname: scan.hostname,
        status: scan.status,
        riskLevel: scan.riskLevel,
        riskScore: scan.riskScore,
        findingCount: scan.findingCount,
        createdAt: scan.createdAt,
        durationMs: scan.durationMs,
      })
      .from(scan)
      .where(where)
      .orderBy(desc(scan.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(scan).where(where),
  ]);

  const total = count?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function filterHref(nextRisk: string) {
    const query = new URLSearchParams();
    if (nextRisk !== "all") query.set("risk", nextRisk);
    return query.size ? `/reports?${query.toString()}` : "/reports";
  }

  if (page > pages && total > 0) {
    redirect(`/reports?page=${pages}${risk !== "all" ? `&risk=${risk}` : ""}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Evidence"
        title="Security reports"
        description="Persisted assessments with the full evidence bundle. Reports are immutable records of what the scanner observed at scan time."
        actions={
          <ButtonLink href="/scanner" size="sm">
            <RadarIcon size={14} />
            New scan
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {RISK_FILTERS.map((option) => (
          <Link
            key={option}
            href={filterHref(option)}
            className={
              risk === option
                ? "rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200"
                : "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-white/10 hover:text-white"
            }
          >
            {option === "all" ? "All risk" : option}
          </Link>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          {total} report{total === 1 ? "" : "s"}
        </span>
      </div>

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={<FileIcon size={20} />}
              title="No reports match this filter"
              description="Run an assessment from the scanner to create the first immutable report."
              action={
                <ButtonLink href="/scanner" size="sm" variant="secondary">
                  Open scanner
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-3 py-3 font-medium">Risk</th>
                    <th className="px-3 py-3 font-medium">Score</th>
                    <th className="px-3 py-3 font-medium">Findings</th>
                    <th className="px-3 py-3 font-medium">Duration</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.02]">
                      <td className="max-w-[18rem] px-5 py-3">
                        <Link
                          href={`/reports/${row.id}`}
                          className="block truncate font-mono text-[11px] text-slate-200 hover:text-cyan-300"
                        >
                          {row.target}
                        </Link>
                        <span className="text-[10px] text-slate-600">
                          {row.status} · {row.hostname ?? "unknown host"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={severityTone(row.riskLevel ?? "unknown")}>
                          {row.riskLevel ?? "unknown"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-300">
                        {row.riskScore}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {row.findingCount}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/reports/${row.id}`}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/reports/${row.id}?download=1`}
                            className="rounded-lg border border-white/10 px-2 py-1 text-slate-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
                            aria-label="Download report"
                          >
                            <DownloadIcon size={12} />
                          </a>
                        </div>
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
                href={`/reports?page=${page - 1}${risk !== "all" ? `&risk=${risk}` : ""}`}
                className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={`/reports?page=${page + 1}${risk !== "all" ? `&risk=${risk}` : ""}`}
                className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isAdmin ? (
        <Alert tone="info" className="mt-4">
          Reports are scoped to your account. Platform administrators can review
          the full tenant history.
        </Alert>
      ) : null}
    </div>
  );
}
