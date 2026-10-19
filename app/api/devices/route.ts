import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { device, session } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  trusted: z.boolean().optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const gate = await guard("device:read");
  if (!gate.ok) return gate.response;

  const rows = await db
    .select()
    .from(device)
    .where(and(eq(device.userId, gate.ctx.user.id), isNull(device.revokedAt)))
    .orderBy(desc(device.lastSeenAt));

  return NextResponse.json({ devices: rows });
}

export async function PATCH(request: Request) {
  const gate = await guard("device:revoke");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, updateSchema);
  if (!body.ok) return body.response;

  const [existing] = await db
    .select({ id: device.id, userId: device.userId, name: device.name })
    .from(device)
    .where(eq(device.id, body.data.id))
    .limit(1);

  if (!existing || existing.userId !== gate.ctx.user.id) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  const [updated] = await db
    .update(device)
    .set({
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.trusted !== undefined
        ? {
            trusted: body.data.trusted,
            trustedUntil: body.data.trusted
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : null,
          }
        : {}),
    })
    .where(eq(device.id, body.data.id))
    .returning();

  await recordAudit({
    action: body.data.trusted === undefined ? "device.renamed" : "device.trust_changed",
    category: "session",
    severity: "medium",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "device",
    resourceId: body.data.id,
    description:
      body.data.trusted === undefined
        ? `Renamed device to "${body.data.name}".`
        : body.data.trusted
          ? "Device marked as trusted for 30 days."
          : "Device trust removed.",
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ device: updated });
}

export async function DELETE(request: Request) {
  const gate = await guard("device:revoke");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, deleteSchema);
  if (!body.ok) return body.response;

  const [existing] = await db
    .select({ id: device.id, userId: device.userId })
    .from(device)
    .where(eq(device.id, body.data.id))
    .limit(1);

  if (!existing || existing.userId !== gate.ctx.user.id) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  await db
    .update(device)
    .set({ revokedAt: new Date(), trusted: false, trustedUntil: null })
    .where(eq(device.id, body.data.id));

  // Revoking a device must also invalidate the sessions bound to it, otherwise
  // the revocation is cosmetic.
  const revoked = await db
    .delete(session)
    .where(
      and(
        eq(session.userId, gate.ctx.user.id),
        eq(session.deviceId, body.data.id),
      ),
    )
    .returning({ id: session.id });

  await recordAudit({
    action: "device.revoked",
    category: "session",
    severity: "high",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "device",
    resourceId: body.data.id,
    description: `Device revoked and ${revoked.length} session(s) terminated.`,
    metadata: { sessionsRevoked: revoked.length },
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({
    revoked: 1,
    sessionsRevoked: revoked.length,
  });
}
