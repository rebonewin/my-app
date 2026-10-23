import { after, NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { tenantScope } from "@/lib/tenancy";
import { getAsset } from "@/services/assets";
import { getScanProfile } from "@/services/scanner/profiles";
import {
  enqueueScan,
  listScans,
  processScanJob,
  ScanLimitError,
} from "@/services/scanner/scans";
import { SCAN_STATUSES } from "@/types/scanner";

export const maxDuration = 60;

const queueSchema = z.object({
  assetId: z.string().min(1),
  profileId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "active"
      ? "active"
      : SCAN_STATUSES.find((value) => value === statusParam);

  const data = await listScans(tenantScope(gate.ctx), {
    status,
    assetId: searchParams.get("assetId") ?? undefined,
    query: searchParams.get("q") ?? undefined,
    page: Math.max(1, Number(searchParams.get("page") ?? 1) || 1),
    pageSize: Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? 20) || 20),
    ),
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const gate = await guard("scanner:start");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, queueSchema);
  if (!body.ok) return body.response;

  const scope = tenantScope(gate.ctx);
  const asset = await getAsset(scope, body.data.assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  if (asset.status !== "active") {
    return NextResponse.json(
      { error: "Enable the asset before queueing a scan." },
      { status: 400 },
    );
  }

  if (body.data.profileId) {
    const profile = await getScanProfile(scope, body.data.profileId);
    if (!profile) {
      return NextResponse.json(
        { error: "Scan profile not found." },
        { status: 400 },
      );
    }
  }

  try {
    const scan = await enqueueScan(scope, asset.id, body.data.profileId);
    const ip = clientIpFromHeaders(request.headers);

    await recordAudit({
      action: "scanner.scan_queued",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "scan",
      resourceId: scan.id,
      description: `Queued ${scan.profileName ?? "scan"} for ${asset.name}.`,
      metadata: {
        assetId: asset.id,
        target: asset.targetUrl,
        profileId: scan.profileId,
        modules: scan.profileModules,
      },
      ipAddress: ip,
    });

    // The worker runs after the response is flushed. The status transition in
    // processScanJob is atomic, so duplicate invocations cannot run a scan twice.
    after(() => processScanJob(scan.id));

    return NextResponse.json({ scan }, { status: 202 });
  } catch (error) {
    if (error instanceof ScanLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The scan could not be queued.",
      },
      { status: 400 },
    );
  }
}
