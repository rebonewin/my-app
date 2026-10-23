import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { tenantScope } from "@/lib/tenancy";
import {
  deleteScanProfile,
  updateScanProfile,
} from "@/services/scanner/profiles";
import { SCAN_MODULES } from "@/types/scanner";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(""),
  modules: z.array(z.enum(SCAN_MODULES)).min(1, "Select at least one module."),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:configure");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, profileSchema);
  if (!body.ok) return body.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);

  try {
    const profile = await updateScanProfile(scope, id, body.data);
    if (!profile) {
      return NextResponse.json(
        { error: "Scan profile not found." },
        { status: 404 },
      );
    }

    await recordAudit({
      action: "scanner.profile_updated",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "scan_profile",
      resourceId: profile.id,
      description: `Updated scan profile ${profile.name}.`,
      metadata: { modules: profile.modules },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The scan profile could not be updated.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await guard("scanner:configure");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const scope = tenantScope(gate.ctx);

  try {
    const deleted = await deleteScanProfile(scope, id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Scan profile not found." },
        { status: 404 },
      );
    }

    await recordAudit({
      action: "scanner.profile_deleted",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "scan_profile",
      resourceId: id,
      description: "Deleted a custom scan profile.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The scan profile could not be deleted.",
      },
      { status: 400 },
    );
  }
}
