import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { session, user } from "@/lib/db/schema";

export interface SessionLookup {
  sessionId: string;
  userId: string;
  email: string;
  role: string | null;
  emailVerified: boolean | null;
  twoFactorEnabled: boolean | null;
  activeOrganizationId: string | null;
}

const SESSION_COOKIE_PATTERN =
  /(?:^|;\s*)(?:__Secure-)?1security\.session_token=([^;]+)/;

/**
 * Resolve the caller's session from the request cookies with a direct
 * database read.
 *
 * This exists for Better Auth `before` hooks, where `ctx.context.session` is
 * not populated yet. The cookie contains `<token>.<hmac>`; the token is the
 * database primary lookup, so a forged cookie cannot match a stored row.
 */
export async function resolveSessionFromHeaders(
  headers: Headers | undefined,
): Promise<SessionLookup | null> {
  if (!headers) return null;

  const match = (headers.get("cookie") ?? "").match(SESSION_COOKIE_PATTERN);
  if (!match) return null;

  const raw = decodeURIComponent(match[1]);
  const token = raw.split(".")[0];
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: session.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      activeOrganizationId: session.activeOrganizationId,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}
