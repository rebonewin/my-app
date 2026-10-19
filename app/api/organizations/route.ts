import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers and single hyphens.",
    )
    .optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const gate = await guard("organization:read");
  if (!gate.ok) return gate.response;

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, gate.ctx.user.id))
    .orderBy(desc(organization.createdAt));

  return NextResponse.json({
    organizations: rows,
    activeOrganizationId: gate.ctx.activeOrganizationId,
  });
}

export async function POST(request: Request) {
  const gate = await guard("organization:create");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, createSchema);
  if (!body.ok) return body.response;

  const slug = body.data.slug ?? slugify(body.data.name);

  try {
    const created = await auth.api.createOrganization({
      body: { name: body.data.name, slug },
      headers: request.headers,
    });

    if (created && "id" in created) {
      await auth.api.setActiveOrganization({
        body: { organizationId: created.id as string },
        headers: request.headers,
      });
    }

    await recordAudit({
      action: "organization.created",
      category: "organization",
      severity: "medium",
      actorId: gate.ctx.user.id,
      actorEmail: gate.ctx.user.email,
      actorRole: gate.ctx.user.role ?? null,
      resourceType: "organization",
      resourceId: created && "id" in created ? (created.id as string) : null,
      description: `Created organization "${body.data.name}" (${slug}).`,
      ipAddress: clientIpFromHeaders(request.headers),
    });

    return NextResponse.json({ organization: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create organization.";
    return NextResponse.json(
      {
        error: message.includes("slug")
          ? "That slug is already taken. Choose another."
          : message,
      },
      { status: 400 },
    );
  }
}
