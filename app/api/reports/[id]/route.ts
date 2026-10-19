import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { guard } from "@/lib/api/guard";
import { db } from "@/lib/db";
import { scan } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await guard("report:read");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(scan)
    .where(eq(scan.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const isOwner = row.userId === gate.ctx.user.id;
  const isAdmin = gate.ctx.permissions.has("dashboard:admin");

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("download") === "1") {
    if (!gate.ctx.permissions.has("report:download")) {
      return NextResponse.json(
        { error: "Your role cannot download reports." },
        { status: 403 },
      );
    }

    await recordAudit({
      action: "report.downloaded",
      category: "scanner",
      severity: "info",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      organizationId: row.organizationId,
      resourceType: "scan",
      resourceId: row.id,
      description: `Downloaded report for ${row.target}.`,
      ipAddress: clientIpFromHeaders(request.headers),
    });

    const hostname =
      row.hostname?.replace(/[^a-z0-9.-]/gi, "") || "target";

    return new NextResponse(JSON.stringify(row, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="1security-${hostname}-${row.id.slice(0, 8)}.json"`,
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.json({ report: row });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await guard("report:delete");
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const [row] = await db
    .select({ id: scan.id, userId: scan.userId, target: scan.target })
    .from(scan)
    .where(eq(scan.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const isOwner = row.userId === gate.ctx.user.id;
  if (!isOwner && !gate.ctx.permissions.has("dashboard:admin")) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  await db.delete(scan).where(eq(scan.id, row.id));

  await recordAudit({
    action: "report.deleted",
    category: "scanner",
    severity: "medium",
    actorId: gate.ctx.user.id,
    actorEmail: gate.ctx.user.email,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "scan",
    resourceId: row.id,
    description: `Deleted report for ${row.target}.`,
    ipAddress: clientIpFromHeaders(request.headers),
  });

  return NextResponse.json({ ok: true });
}
