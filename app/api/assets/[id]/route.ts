import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { tenantScope } from "@/lib/tenancy";
import {
  AssetConflictError,
  deleteAsset,
  getAsset,
  updateAsset,
} from "@/services/assets";
import {
  ASSET_CRITICALITIES,
  ASSET_ENVIRONMENTS,
  ASSET_STATUSES,
  ASSET_TYPES,
  type AssetCriticality,
} from "@/types/assets";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  targetUrl: z.string().trim().min(4).max(2048),
  type: z.enum(ASSET_TYPES),
  environment: z.enum(ASSET_ENVIRONMENTS),
  criticality: z.enum(ASSET_CRITICALITIES),
  owner: z.string().trim().max(200).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(ASSET_STATUSES),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const asset = await getAsset(tenantScope(gate.ctx), id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  return NextResponse.json({ asset });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:start");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, updateSchema);
  if (!body.ok) return body.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);

  try {
    const updated = await updateAsset(scope, id, {
      ...body.data,
      criticality: body.data.criticality as AssetCriticality,
      tags: Array.from(new Set(body.data.tags)),
    });
    if (!updated) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    await recordAudit({
      action: "asset.updated",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "asset",
      resourceId: updated.id,
      description: `Updated asset ${updated.name} (${updated.targetUrl}).`,
      metadata: {
        status: updated.status,
        criticality: updated.criticality,
      },
      ipAddress: clientIpFromHeaders(request.headers),
    });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    if (error instanceof AssetConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "The asset could not be updated." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:delete");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);
  const asset = await getAsset(scope, id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const deleted = await deleteAsset(scope, id);
  if (!deleted) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  await recordAudit({
    action: "asset.deleted",
    category: "scanner",
    severity: "medium",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    organizationId: scope.organizationId,
    resourceType: "asset",
    resourceId: id,
    description: `Deleted asset ${asset.name} (${asset.targetUrl}).`,
    metadata: { target: asset.targetUrl },
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ ok: true });
}
