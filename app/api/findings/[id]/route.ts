import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { tenantScope } from "@/lib/tenancy";
import { updateFindingStatus } from "@/services/findings";
import { FINDING_STATUSES } from "@/types/findings";

const statusSchema = z.object({
  status: z.enum(FINDING_STATUSES),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:start");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, statusSchema);
  if (!body.ok) return body.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);
  const finding = await updateFindingStatus(scope, id, body.data.status);

  if (!finding) {
    return NextResponse.json({ error: "Finding not found." }, { status: 404 });
  }

  await recordAudit({
    action: "finding.status_changed",
    category: "scanner",
    severity: body.data.status === "accepted-risk" ? "medium" : "info",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    organizationId: scope.organizationId,
    resourceType: "finding",
    resourceId: id,
    description: `Set ${finding.title} to ${body.data.status}.`,
    metadata: {
      assetId: finding.assetId,
      severity: finding.severity,
      status: body.data.status,
    },
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ finding });
}
