import "server-only";

import { NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { guard, readJson } from "@/lib/api/guard";
import { db } from "@/lib/db";
import {
  session as sessionTable,
  user as userTable,
  verification,
} from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/auth";
import { emailChangeEmail, isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * Self-service email change.
 *
 * Better Auth 1.7 does not expose a `changeEmail` endpoint, so the two-step
 * verification pattern is implemented here:
 *
 *   POST → proves the caller owns the *new* inbox (token emailed there)
 *   PUT  → consumes the token from a signed-in session and swaps the address
 *
 * The raw token is never stored: the `verification` row keeps a SHA-256 hash
 * plus the pending address. Owning the new mailbox is the proof of ownership,
 * and the address only changes while the account holder is signed in.
 */

const IDENTIFIER_PREFIX = "change-email:";
const TOKEN_TTL_MS = 60 * 60 * 1000;

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
});

const confirmSchema = z.object({
  token: z.string().trim().min(20).max(200),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(storedHash: string, token: string): boolean {
  const left = Buffer.from(storedHash, "utf8");
  const right = Buffer.from(hashToken(token), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const gate = await guard("settings:update");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, requestSchema);
  if (!body.ok) return body.response;

  const nextEmail = body.data.email;
  const currentEmail = gate.ctx.user.email.toLowerCase();

  if (nextEmail === currentEmail) {
    return NextResponse.json(
      { error: "That is already the address on this account." },
      { status: 400 },
    );
  }

  const [clash] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, nextEmail))
    .limit(1);

  if (clash) {
    return NextResponse.json(
      { error: "That address is already in use by another account." },
      { status: 409 },
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email delivery is not configured, so the new address cannot be confirmed. Set RESEND_API_KEY or the SMTP variables first.",
      },
      { status: 503 },
    );
  }

  const token = randomBytes(32).toString("base64url");
  const identifier = `${IDENTIFIER_PREFIX}${gate.ctx.user.id}`;

  // One pending change at a time: a fresh request invalidates the previous link.
  await db.delete(verification).where(eq(verification.identifier, identifier));
  await db.insert(verification).values({
    id: randomUUID(),
    identifier,
    value: `${hashToken(token)}:${nextEmail}`,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const baseUrl =
    process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ??
    new URL(request.url).origin;
  const confirmUrl = `${baseUrl}/settings?emailChangeToken=${encodeURIComponent(token)}`;

  const sent = await sendEmail({
    to: nextEmail,
    subject: "Confirm your new 1Security email address",
    html: emailChangeEmail(gate.ctx.user.name ?? "", nextEmail, confirmUrl),
    text: `Confirm your new 1Security email address: ${confirmUrl}`,
  });

  if (!sent.ok) {
    await db
      .delete(verification)
      .where(eq(verification.identifier, identifier));
    return NextResponse.json(
      { error: sent.error ?? "Could not send the confirmation email." },
      { status: 502 },
    );
  }

  await recordAudit({
    action: "auth.email_change_requested",
    category: "auth",
    severity: "medium",
    actorId: gate.ctx.user.id,
    actorEmail: currentEmail,
    actorRole: gate.ctx.user.role ?? null,
    description: `Requested an email change to ${nextEmail}.`,
    metadata: { nextEmail },
    ipAddress: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, email: nextEmail });
}

export async function PUT(request: Request) {
  const gate = await guard("settings:update");
  if (!gate.ok) return gate.response;

  const body = await readJson(request, confirmSchema);
  if (!body.ok) return body.response;

  const identifier = `${IDENTIFIER_PREFIX}${gate.ctx.user.id}`;
  const [row] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "This confirmation link is invalid or has already been used." },
      { status: 400 },
    );
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(verification).where(eq(verification.id, row.id));
    return NextResponse.json(
      { error: "This confirmation link has expired. Request a new one." },
      { status: 400 },
    );
  }

  const separator = row.value.indexOf(":");
  const storedHash = separator > 0 ? row.value.slice(0, separator) : "";
  const nextEmail = separator > 0 ? row.value.slice(separator + 1) : "";

  if (!storedHash || !nextEmail || !tokenMatches(storedHash, body.data.token)) {
    return NextResponse.json(
      { error: "This confirmation link is invalid or has already been used." },
      { status: 400 },
    );
  }

  const [clash] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, nextEmail))
    .limit(1);

  if (clash && clash.id !== gate.ctx.user.id) {
    return NextResponse.json(
      { error: "That address was claimed by another account in the meantime." },
      { status: 409 },
    );
  }

  const previousEmail = gate.ctx.user.email;

  await db
    .update(userTable)
    .set({
      email: nextEmail,
      // The new mailbox now needs its own verification pass.
      emailVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, gate.ctx.user.id));

  await db.delete(verification).where(eq(verification.id, row.id));

  // Session rotation: other devices were authenticated against the old
  // identity, so they are revoked. The confirming device stays signed in.
  let rotatedSessions = 0;
  try {
    const removed = await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, gate.ctx.user.id),
          ne(sessionTable.id, gate.ctx.session.session.id),
        ),
      )
      .returning({ id: sessionTable.id });
    rotatedSessions = removed.length;
  } catch {
    rotatedSessions = 0;
  }

  await recordAudit({
    action: "auth.email_changed",
    category: "auth",
    severity: "high",
    actorId: gate.ctx.user.id,
    actorEmail: nextEmail,
    actorRole: gate.ctx.user.role ?? null,
    resourceType: "user",
    resourceId: gate.ctx.user.id,
    description: `Email changed from ${previousEmail} to ${nextEmail}.`,
    metadata: { previousEmail, newEmail: nextEmail, rotatedSessions },
    ipAddress: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    email: nextEmail,
    rotatedSessions,
  });
}
