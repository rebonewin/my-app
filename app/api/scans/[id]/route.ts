import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { tenantScope } from "@/lib/tenancy";
import {
  cancelScan,
  getScan,
  getScanDetail,
} from "@/services/scanner/scans";
import { ACTIVE_SCAN_STATUSES } from "@/types/scanner";

const actionSchema = z.object({
  action: z.literal("cancel"),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const detail = await getScanDetail(tenantScope(gate.ctx), id);
  if (!detail) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:stop");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, actionSchema);
  if (!body.ok) return body.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);
  const current = await getScan(scope, id);
  if (!current) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (!ACTIVE_SCAN_STATUSES.includes(current.status)) {
    return NextResponse.json(
      { error: "Only pending or running scans can be cancelled." },
      { status: 409 },
    );
  }

  const updated = await cancelScan(scope, id);
  if (!updated) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  await recordAudit({
    action: "scanner.scan_cancelled",
    category: "scanner",
    severity: "info",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    organizationId: scope.organizationId,
    resourceType: "scan",
    resourceId: id,
    description: `Cancelled scan of ${current.target}.`,
    metadata: { assetId: current.assetId, previousStatus: current.status },
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ scan: updated });
}
