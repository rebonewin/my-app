import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { securityEvent } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "resolved", "dismissed"]),
});

export async function GET(request: Request) {
  const gate = await guard("security:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);

  const scope = eq(securityEvent.userId, gate.ctx.user.id);

  const rows = await db
    .select()
    .from(securityEvent)
    .where(
      status && ["open", "resolved", "dismissed"].includes(status)
        ? and(scope, eq(securityEvent.status, status))
        : scope,
    )
    .orderBy(desc(securityEvent.createdAt))
    .limit(limit);

  return NextResponse.json({ events: rows });
}

export async function PATCH(request: Request) {
  const gate = await guard("security:read");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, patchSchema);
  if (!body.ok) return body.response;

  const required =
    body.data.status === "dismissed" ? "security:dismiss" : "security:resolve";

  if (!gate.ctx.permissions.has(required)) {
    return NextResponse.json(
      { error: "Your role cannot change security event status." },
      { status: 403 },
    );
  }

  const [existing] = await db
    .select({ id: securityEvent.id, userId: securityEvent.userId })
    .from(securityEvent)
    .where(eq(securityEvent.id, body.data.id))
    .limit(1);

  if (!existing || existing.userId !== gate.ctx.user.id) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const [updated] = await db
    .update(securityEvent)
    .set({
      status: body.data.status,
      resolvedAt: body.data.status === "open" ? null : new Date(),
      resolvedBy: body.data.status === "open" ? null : gate.ctx.user.id,
    })
    .where(eq(securityEvent.id, body.data.id))
    .returning();

  await recordAudit({
    action:
      body.data.status === "resolved"
        ? "security.event_resolved"
        : body.data.status === "dismissed"
          ? "security.event_dismissed"
          : "security.event_reopened",
    category: "security",
    severity: "medium",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "security_event",
    resourceId: body.data.id,
    description: `Security event marked ${body.data.status}.`,
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ event: updated });
}
