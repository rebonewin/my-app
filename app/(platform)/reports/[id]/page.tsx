import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import ScanResultView from "@/components/scanner/ScanResultView";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, CardBody, severityTone } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scan } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";
import type { ScanResult } from "@/types/scan";

export const instant = false;

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("report:read");
  const { id } = await params;

  const [row] = await db.select().from(scan).where(eq(scan.id, id)).limit(1);

  if (!row) notFound();
  if (
    row.userId !== context.user.id &&
    !context.permissions.has("dashboard:admin")
  ) {
    notFound();
  }

  const result = row.results as
    | (ScanResult & {
        riskLevel?: string;
        riskScore?: number;
        findingCount?: number;
      })
    | null;

  return (
    <div>
      <PageHeader
        eyebrow="Report"
        title={row.hostname ?? row.target}
        description={`Assessment recorded ${formatDate(row.createdAt)}${
          row.durationMs ? ` · completed in ${(row.durationMs / 1000).toFixed(1)}s` : ""
        }`}
        actions={
          <>
            <ButtonLink href="/reports" size="sm" variant="secondary">
              Back to reports
            </ButtonLink>
            <ButtonLink
              href={`/api/reports/${row.id}?download=1`}
              size="sm"
              variant="outline"
            >
              <DownloadIcon size={14} />
              Download JSON
            </ButtonLink>
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Target
            </p>
            <p className="mt-1 truncate font-mono text-xs text-slate-200">
              {row.target}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Risk
            </p>
            <p className="mt-1">
              <Badge tone={severityTone(row.riskLevel ?? "unknown")}>
                {row.riskLevel ?? "unknown"} · {row.riskScore}/100
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Findings
            </p>
            <p className="mt-1 text-sm text-slate-200">{row.findingCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Status
            </p>
            <p className="mt-1">
              <Badge tone={row.status === "completed" ? "green" : "red"}>
                {row.status}
              </Badge>
            </p>
          </div>
        </CardBody>
      </Card>

      {row.status === "failed" ? (
        <Alert tone="error" title="Scan did not complete">
          {row.error ?? "The target did not respond."} You can retry from the{" "}
          <Link href="/scanner" className="underline decoration-dotted">
            scanner
          </Link>
          .
        </Alert>
      ) : result ? (
        <ScanResultView result={result} />
      ) : (
        <Alert tone="warning" title="No evidence bundle">
          The scan record exists but its evidence payload is missing.
        </Alert>
      )}
    </div>
  );
}
