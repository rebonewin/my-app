import { NextResponse } from "next/server";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { session } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";

const revokeSchema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true), keepCurrent: z.boolean().optional() }),
]);

export async function GET() {
  const gate = await guard("session:read");
  if (!gate.ok) return gate.response;

  const rows = await db
    .select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      deviceId: session.deviceId,
      impersonatedBy: session.impersonatedBy,
    })
    .from(session)
    .where(
      and(
        eq(session.userId, gate.ctx.user.id),
        gte(session.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(session.lastActiveAt));

  return NextResponse.json({
    currentSessionId: gate.ctx.session.session.id,
    sessions: rows,
  });
}

export async function DELETE(request: Request) {
  const gate = await guard("session:revoke");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, revokeSchema);
  if (!body.ok) return body.response;

  const { ctx } = gate;
  const ip = clientIpFromHeaders(request.headers);

  if ("all" in body.data) {
    if (!ctx.permissions.has("session:revoke-all")) {
      return NextResponse.json(
        { error: "Your role cannot revoke every session." },
        { status: 403 },
      );
    }

    const keepCurrent = body.data.keepCurrent ?? false;
    const where = keepCurrent
      ? and(
          eq(session.userId, ctx.user.id),
          ne(session.id, ctx.session.session.id),
        )
      : eq(session.userId, ctx.user.id);

    const deleted = await db.delete(session).where(where).returning({
      id: session.id,
    });

    await recordAudit({
      action: "session.revoked_all",
      category: "session",
      severity: "high",
      actorId: ctx.user.id,
      actorEmail: ctx.user.email,
      actorRole: ctx.user.role ?? null,
      description: `Revoked ${deleted.length} session(s)${keepCurrent ? " (current session kept)" : ""}.`,
      metadata: { count: deleted.length, keepCurrent },
      ipAddress: ip,
    });

    return NextResponse.json({ revoked: deleted.length, signedOut: !keepCurrent });
  }

  const [target] = await db
    .select({ id: session.id, userId: session.userId })
    .from(session)
    .where(eq(session.id, body.data.id))
    .limit(1);

  if (!target || target.userId !== ctx.user.id) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  await db.delete(session).where(eq(session.id, target.id));

  await recordAudit({
    action: "session.revoked",
    category: "session",
    severity: "medium",
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    actorRole: ctx.user.role ?? null,
    resourceType: "session",
    resourceId: target.id,
    description: "Session revoked from the sessions page.",
    ipAddress: ip,
  });

  return NextResponse.json({
    revoked: 1,
    signedOut: target.id === ctx.session.session.id,
  });
}
