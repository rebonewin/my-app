import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import {
  isPlatformOnlyPermission,
  permissionsForRole,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac/permissions";

export interface AuthContext {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  user: NonNullable<
    Awaited<ReturnType<typeof auth.api.getSession>>
  >["user"] & {
    mustChangePassword?: boolean | null;
    twoFactorEnabled?: boolean | null;
    role?: string | null;
  };
  /** Platform role + active organization role, if any. */
  roles: string[];
  permissions: Set<string>;
  activeOrganizationId: string | null;
}

/**
 * Resolves the current session and the caller's effective roles.
 *
 * Cached per request so a page and its nested components share one DB read.
 * Returns null when unauthenticated — never throws.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
    // Authorization must observe the current row, never a cached payload: a
    // revoked session would otherwise stay usable until the cache TTL.
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  const activeOrganizationId = session.session.activeOrganizationId ?? null;
  const roles: string[] = [];

  if (session.user.role) roles.push(session.user.role);

  if (activeOrganizationId) {
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, activeOrganizationId),
        ),
      )
      .limit(1);
    if (membership?.role) roles.push(membership.role);
  }

  return {
    session,
    user: session.user as AuthContext["user"],
    roles,
    permissions: permissionsForRoles(roles),
    activeOrganizationId,
  };
});

/**
 * Effective permission check.
 *
 * Tenant-scoped permissions consider the union of the platform role and the
 * active organization role, so an organization owner can administer their own
 * tenant. Platform-only permissions are always evaluated against the platform
 * role, so tenant authority can never be escalated into platform
 * administration. Every guard in the app routes through this function.
 */
export function hasEffectivePermission(
  context: AuthContext,
  permission: string,
): boolean {
  const granted = isPlatformOnlyPermission(permission)
    ? permissionsForRole(context.user.role)
    : context.permissions;
  return granted.has(permission);
}

/** Throws a redirect to sign-in when unauthenticated. */
export async function requireAuth(
  next?: string,
): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    const target = next
      ? `/sign-in?next=${encodeURIComponent(next)}`
      : "/sign-in";
    redirect(target);
  }
  return context;
}

export async function requirePermission(
  permission: Permission,
  options: { next?: string } = {},
): Promise<AuthContext> {
  const context = await requireAuth(options.next);
  if (!hasEffectivePermission(context, permission)) {
    forbidden();
  }
  return context;
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
  options: { next?: string } = {},
): Promise<AuthContext> {
  const context = await requireAuth(options.next);
  if (
    !permissions.some((permission) =>
      hasEffectivePermission(context, permission),
    )
  ) {
    forbidden();
  }
  return context;
}

export async function requireRole(role: string): Promise<AuthContext> {
  const context = await requireAuth();
  if (!context.roles.includes(role)) forbidden();
  return context;
}

/** Non-throwing permission check for conditional rendering. */
export async function can(permission: Permission): Promise<boolean> {
  const context = await getAuthContext();
  if (!context) return false;
  return hasEffectivePermission(context, permission);
}

export async function canAny(
  permissions: readonly Permission[],
): Promise<boolean> {
  const context = await getAuthContext();
  if (!context) return false;
  return permissions.some((permission) =>
    hasEffectivePermission(context, permission),
  );
}

/**
 * Server-action guard. Throws instead of redirecting so the caller can turn it
 * into a structured error response.
 */
export async function assertPermission(
  permission: Permission,
): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) throw new Error("UNAUTHENTICATED");
  if (!hasEffectivePermission(context, permission)) throw new Error("FORBIDDEN");
  return context;
}

/* -------------------------------------------------------------------------- */
/*                              Organizations                                 */
/* -------------------------------------------------------------------------- */

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * Every organization the signed-in user belongs to. Cached per request so the
 * shell, the org switcher and any page share a single query.
 */
export const getOrganizations = cache(
  async (): Promise<OrganizationSummary[]> => {
    const context = await getAuthContext();
    if (!context) return [];

    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, context.user.id));

    return rows;
  },
);

/** The organization the session is currently scoped to, if any. */
export async function getActiveOrganization(): Promise<OrganizationSummary | null> {
  const context = await getAuthContext();
  if (!context) return null;
  if (!context.activeOrganizationId) return null;

  const organizations = await getOrganizations();
  return (
    organizations.find((o) => o.id === context.activeOrganizationId) ?? null
  );
}

