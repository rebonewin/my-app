"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, CardBody, severityTone } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DownloadIcon, RefreshIcon, SearchIcon, ShieldIcon } from "@/components/ui/icons";
import { formatDate, titleCase } from "@/lib/utils";

interface AuditRow {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  category: string;
  severity: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  createdAt: string;
}

const CATEGORIES = [
  "general",
  "auth",
  "session",
  "security",
  "role",
  "user",
  "scanner",
  "api_key",
  "organization",
  "admin",
];

const SEVERITIES = ["info", "low", "medium", "high", "critical"];

export function AuditLogViewer({
  canExport,
  isPlatformAdmin,
}: {
  canExport: boolean;
  isPlatformAdmin: boolean;
}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, pageSize = 25) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      if (severity) params.set("severity", severity);

      try {
        const response = await fetch(`/api/audit?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "Could not load audit logs.");
          return;
        }
        setRows(payload.logs as AuditRow[]);
        setPage(payload.pagination.page);
        setPages(payload.pagination.pages);
        setTotal(payload.pagination.total);
      } catch {
        setError("Network error while loading the audit log.");
      } finally {
        setLoading(false);
      }
    },
    [query, category, severity],
  );

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: "1", pageSize: "25" });

    fetch(`/api/audit?${params.toString()}`)
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(payload?.error ?? "Could not load audit logs.");
          setLoading(false);
          return;
        }

        setRows(payload.logs as AuditRow[]);
        setPage(payload.pagination.page);
        setPages(payload.pagination.pages);
        setTotal(payload.pagination.total);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Network error while loading the audit log.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      if (severity) params.set("severity", severity);

      const response = await fetch(`/api/audit?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Export failed.");
        return;
      }

      const header = [
        "timestamp",
        "actor",
        "role",
        "action",
        "category",
        "severity",
        "resource",
        "description",
        "ip",
        "success",
      ];

      const escape = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

      const lines = (payload.logs as AuditRow[]).map((row) =>
        [
          row.createdAt,
          row.actorEmail,
          row.actorRole,
          row.action,
          row.category,
          row.severity,
          `${row.resourceType ?? ""}${row.resourceId ? `:${row.resourceId}` : ""}`,
          row.description,
          row.ipAddress,
          row.success,
        ]
          .map(escape)
          .join(","),
      );

      const blob = new Blob([[header.join(","), ...lines].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `1security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
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
              htmlFor="audit-search"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500"
            >
              Search
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <SearchIcon size={15} />
              </span>
              <Input
                id="audit-search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Action, description or actor email"
                className="pl-10"
              />
            </div>
          </form>

          <div className="w-full lg:w-44">
            <label
              htmlFor="audit-category"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500"
            >
              Category
            </label>
            <Select
              id="audit-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full lg:w-40">
            <label
              htmlFor="audit-severity"
              className="mb-1.5 block text-[10px] uppercase tracking-wider text-slate-500"
            >
              Severity
            </label>
            <Select
              id="audit-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="">Any severity</option>
              {SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void load(1)}>
              <RefreshIcon size={14} />
              Apply
            </Button>
            {canExport ? (
              <Button
                type="button"
                variant="outline"
                loading={exporting}
                onClick={exportCsv}
              >
                <DownloadIcon size={14} />
                CSV
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <p className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldIcon size={13} className="text-cyan-400" />
              {total} event{total === 1 ? "" : "s"}
              {isPlatformAdmin ? " across the platform" : " attributable to you"}
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
                  className="h-10 animate-pulse rounded-lg bg-white/[0.03]"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-12 text-center text-xs text-slate-500">
              No audit events match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Severity</th>
                    <th className="px-3 py-3 font-medium">Description</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top transition hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[12rem] truncate text-slate-300">
                          {row.actorEmail ?? "system"}
                        </p>
                        <p className="text-[10px] text-slate-600">
                          {row.actorRole ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-[11px] text-cyan-300/90">
                          {row.action}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-600">
                          {row.category}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={severityTone(row.severity)}>
                          {row.severity}
                        </Badge>
                        {!row.success ? (
                          <span className="ml-1 text-[10px] text-red-400">failed</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[24rem] text-slate-400">
                          {row.description ?? "—"}
                        </p>
                        {row.metadata ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] text-slate-600 hover:text-slate-400">
                              metadata
                            </summary>
                            <pre className="mt-1 max-h-40 max-w-[26rem] overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-2 text-[10px] text-slate-400">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-mono text-[10px] text-slate-500">
                          {row.ipAddress ?? "—"}
                        </p>
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
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Page {page} of {pages}</span>
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
