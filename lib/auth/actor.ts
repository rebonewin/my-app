import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  permissionsForRole,
  type Permission,
} from "@/lib/rbac/permissions";
import { getAuthContext } from "@/lib/auth/server";

export interface Actor {
  id: string;
  email: string;
  name: string;
  role: string | null;
  permissions: Set<string>;
  activeOrganizationId: string | null;
  via: "session" | "api_key";
  apiKeyId: string | null;
}

/**
 * Resolve the caller from either a browser session cookie or a Bearer API key.
 *
 * API keys are verified by Better Auth (hashed lookup, expiry, refill and
 * per-key rate limit) and additionally scoped by the permission requested at
 * call time. The key inherits the owner's role permissions at creation, so a
 * key can never exceed the role that minted it.
 */
export async function resolveActor(
  request: Request,
  required: Permission,
): Promise<Actor | null> {
  const context = await getAuthContext();
  if (context) {
    return {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
      role: context.user.role ?? null,
      permissions: context.permissions,
      activeOrganizationId: context.activeOrganizationId,
      via: "session",
      apiKeyId: null,
    };
  }

  const header =
    request.headers.get("authorization") ??
    request.headers.get("x-api-key") ??
    "";
  const raw = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : header.trim();

  if (!raw) return null;

  const [resource, action] = required.split(":");
  const verification = await auth.api
    .verifyApiKey({
      body: {
        key: raw,
        permissions: { [resource]: [action] },
      },
    })
    .catch(() => null);

  if (!verification?.valid || !verification.key) return null;

  const [owner] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      banned: userTable.banned,
    })
    .from(userTable)
    .where(eq(userTable.id, verification.key.referenceId))
    .limit(1);

  if (!owner || owner.banned) return null;

  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    permissions: permissionsForRole(owner.role),
    activeOrganizationId: null,
    via: "api_key",
    apiKeyId: verification.key.id,
  };
}

/** True when the request carries an Authorization / x-api-key header. */
export async function hasApiKeyHeader(): Promise<boolean> {
  const header = await headers();
  return Boolean(header.get("authorization") || header.get("x-api-key"));
}
