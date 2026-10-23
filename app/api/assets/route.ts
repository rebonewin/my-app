import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { tenantScope } from "@/lib/tenancy";
import {
  AssetConflictError,
  createAsset,
  listAssets,
} from "@/services/assets";
import {
  ASSET_CRITICALITIES,
  ASSET_ENVIRONMENTS,
  ASSET_RISK_LEVELS,
  ASSET_STATUSES,
  ASSET_TYPES,
  type AssetCriticality,
} from "@/types/assets";

const assetSchema = z.object({
  name: z.string().trim().min(2, "Asset name must be at least 2 characters.").max(160),
  targetUrl: z.string().trim().min(4, "Enter a target URL.").max(2048),
  type: z.enum(ASSET_TYPES),
  environment: z.enum(ASSET_ENVIRONMENTS),
  criticality: z.enum(ASSET_CRITICALITIES),
  owner: z.string().trim().max(200).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(ASSET_STATUSES).default("active"),
});

export async function GET(request: Request) {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const scope = tenantScope(gate.ctx);
  const type = ASSET_TYPES.find((value) => value === searchParams.get("type"));
  const environment = ASSET_ENVIRONMENTS.find(
    (value) => value === searchParams.get("environment"),
  );
  const criticality = ASSET_CRITICALITIES.find(
    (value) => value === searchParams.get("criticality"),
  );
  const status = ASSET_STATUSES.find(
    (value) => value === searchParams.get("status"),
  );
  const riskLevel = ASSET_RISK_LEVELS.find(
    (value) => value === searchParams.get("riskLevel"),
  );
  const sortParam = searchParams.get("sort");
  const sort = ["recent", "name", "risk", "criticality", "last-scan"].includes(
    sortParam ?? "",
  )
    ? (sortParam as "recent" | "name" | "risk" | "criticality" | "last-scan")
    : "recent";

  const data = await listAssets(scope, {
    query: searchParams.get("q") ?? undefined,
    type,
    environment,
    criticality,
    status,
    riskLevel,
    sort,
    page: Math.max(1, Number(searchParams.get("page") ?? 1) || 1),
    pageSize: Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? 12) || 12),
    ),
  });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const gate = await guard("scanner:start");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, assetSchema);
  if (!body.ok) return body.response;

  const scope = tenantScope(gate.ctx);

  try {
    const created = await createAsset(scope, {
      ...body.data,
      criticality: body.data.criticality as AssetCriticality,
      tags: Array.from(new Set(body.data.tags)),
    });

    await recordAudit({
      action: "asset.created",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "asset",
      resourceId: created.id,
      description: `Registered asset ${created.name} (${created.targetUrl}).`,
      metadata: {
        type: created.type,
        environment: created.environment,
        criticality: created.criticality,
      },
      ipAddress: clientIpFromHeaders(request.headers),
    });

    return NextResponse.json({ asset: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AssetConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("Only http")
            ? error.message
            : "The asset could not be created.",
      },
      { status: 400 },
    );
  }
}
