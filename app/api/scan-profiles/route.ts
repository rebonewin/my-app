import { NextResponse } from "next/server";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { recordAudit } from "@/lib/audit";
import { tenantScope } from "@/lib/tenancy";
import {
  createScanProfile,
  listScanProfiles,
} from "@/services/scanner/profiles";
import { SCAN_MODULES } from "@/types/scanner";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(""),
  modules: z.array(z.enum(SCAN_MODULES)).min(1, "Select at least one module."),
});

export async function GET() {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const profiles = await listScanProfiles(tenantScope(gate.ctx));
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const gate = await guard("scanner:configure");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, profileSchema);
  if (!body.ok) return body.response;

  const scope = tenantScope(gate.ctx);

  try {
    const profile = await createScanProfile(scope, body.data);
    await recordAudit({
      action: "scanner.profile_created",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: scope.organizationId,
      resourceType: "scan_profile",
      resourceId: profile.id,
      description: `Created scan profile ${profile.name}.`,
      metadata: { modules: profile.modules },
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The scan profile could not be created.",
      },
      { status: 400 },
    );
  }
}
