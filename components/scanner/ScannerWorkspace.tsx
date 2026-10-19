"use client";

import { useState } from "react";
import Link from "next/link";
import ScanResultView from "@/components/scanner/ScanResultView";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Badge, severityTone } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadarIcon, ShieldIcon } from "@/components/ui/icons";
import { relativeTime } from "@/lib/utils";
import type { ScanResult } from "@/types/scan";

type ScanResponse = ScanResult & {
  scanId: string;
  riskLevel: string;
  riskScore: number;
  findingCount: number;
};

const STAGES = [
  "Resolving target and checking address space",
  "Fetching response and security headers",
  "Inspecting TLS certificate",
  "Probing common service ports",
  "Calculating risk score and persisting report",
];

export function ScannerWorkspace({
  canStart,
  recentScans,
}: {
  canStart: boolean;
  recentScans: Array<{
    id: string;
    target: string;
    riskLevel: string | null;
    riskScore: number;
    createdAt: Date | string;
  }>;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  async function startScan(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStage(0);

    const timer = setInterval(
      () => setStage((current) => Math.min(current + 1, STAGES.length - 1)),
      1_200,
    );

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(
          typeof payload?.error === "string"
            ? payload.error
            : "The scan could not be completed.",
        );
        return;
      }

      setResult(payload as ScanResponse);
    } catch {
      setError("Network error while contacting the scanner.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!canStart ? (
        <Alert tone="warning" title="Read-only access">
          Your role can view scan reports but cannot start new assessments.
        </Alert>
      ) : null}

      <Card>
        <CardBody className="space-y-4">
          <form onSubmit={startScan} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                <ShieldIcon size={16} />
              </span>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="example.com or https://example.com"
                className="h-12 pl-10"
                disabled={!canStart || loading}
                aria-label="Target URL"
                inputMode="url"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={!canStart || !url.trim()}
              className="sm:w-44"
            >
              <RadarIcon size={16} />
              {loading ? "Scanning" : "Run assessment"}
            </Button>
          </form>

          <p className="text-[11px] text-slate-500">
            Only public http/https targets are accepted. Private, loopback and
            cloud-metadata addresses are refused before any connection is made.
            Scan budget: 10 per 5 minutes.
          </p>

          {loading ? (
            <div className="space-y-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] px-4 py-3">
              {STAGES.map((label, index) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 text-xs"
                  style={{ opacity: index <= stage ? 1 : 0.35 }}
                >
                  <span
                    className={
                      index < stage
                        ? "h-1.5 w-1.5 rounded-full bg-emerald-400"
                        : index === stage
                          ? "h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400"
                          : "h-1.5 w-1.5 rounded-full bg-slate-700"
                    }
                  />
                  <span
                    className={
                      index <= stage ? "text-slate-300" : "text-slate-600"
                    }
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}
        </CardBody>
      </Card>

      {result ? <ScanResultView result={result} /> : null}

      <Card>
        <CardHeader
          title="Recent assessments"
          description="Every scan is persisted with its full evidence bundle"
          action={
            <Link
              href="/reports"
              className="text-[11px] text-cyan-400 hover:text-cyan-300"
            >
              All reports
            </Link>
          }
        />
        <CardBody className="p-0">
          {recentScans.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-slate-500">
              No scans yet. Run your first assessment above.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {recentScans.map((scan) => (
                <li key={scan.id}>
                  <Link
                    href={`/reports/${scan.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400">
                      <RadarIcon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-slate-200">
                        {scan.target}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {relativeTime(scan.createdAt)} · risk score {scan.riskScore}
                      </span>
                    </span>
                    <Badge tone={severityTone(scan.riskLevel ?? "unknown")}>
                      {scan.riskLevel ?? "unknown"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
