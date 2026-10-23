import "server-only";

import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { AuthContext } from "@/lib/auth/server";
import { asset, finding, scan } from "@/lib/db/schema";

/**
 * Tenant boundary used by every Phase 3 service and API route.
 *
 * Organization assets are visible to members of the active organization.
 * Personal assets remain visible only to their creator. When an organization
 * is active we also include the caller's personal records so switching into a
 * tenant never hides work they created before joining it.
 */
export interface TenantScope {
  userId: string;
  organizationId: string | null;
}

export function tenantScope(context: AuthContext): TenantScope {
  return {
    userId: context.user.id,
    organizationId: context.activeOrganizationId ?? null,
  };
}

type ScopeColumns = {
  organizationId: AnyPgColumn;
  userId: AnyPgColumn;
};

function scopeFilter(
  columns: ScopeColumns,
  scope: TenantScope,
): SQL {
  if (scope.organizationId) {
    return or(
      eq(columns.organizationId, scope.organizationId),
      and(
        isNull(columns.organizationId),
        eq(columns.userId, scope.userId),
      ),
    ) as SQL;
  }

  return and(
    isNull(columns.organizationId),
    eq(columns.userId, scope.userId),
  ) as SQL;
}

export function assetScopeFilter(scope: TenantScope): SQL {
  return scopeFilter(
    { organizationId: asset.organizationId, userId: asset.userId },
    scope,
  );
}

export function scanScopeFilter(scope: TenantScope): SQL {
  return scopeFilter(
    { organizationId: scan.organizationId, userId: scan.userId },
    scope,
  );
}

export function findingScopeFilter(scope: TenantScope): SQL {
  return scopeFilter(
    { organizationId: finding.organizationId, userId: finding.userId },
    scope,
  );
}
