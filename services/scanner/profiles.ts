import "server-only";

import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { scanProfile } from "@/lib/db/schema";
import type { TenantScope } from "@/lib/tenancy";
import {
  SCAN_MODULES,
  type CreateScanProfileInput,
  type ScanModule,
  type ScanProfileSummary,
} from "@/types/scanner";

export const DEFAULT_SCAN_PROFILE_ID = "system-standard";

export const SYSTEM_SCAN_PROFILES: ScanProfileSummary[] = [
  {
    id: "system-quick",
    name: "Quick Scan",
    description: "Fast HTTP and header posture check for a quick signal.",
    modules: ["http", "headers"],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-standard",
    name: "Standard Scan",
    description:
      "Headers, TLS, cookies and CORS. The default assessment for an asset.",
    modules: ["http", "headers", "tls", "cookies", "cors"],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-full",
    name: "Full Scan",
    description:
      "Every passive module, including service exposure and technology discovery.",
    modules: [...SCAN_MODULES],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-ssl",
    name: "SSL Audit",
    description: "Certificate validity, issuer, protocol and expiry tracking.",
    modules: ["http", "tls"],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-headers",
    name: "Header Audit",
    description:
      "Security headers, cookie controls, CORS policy and robots discovery.",
    modules: ["http", "headers", "cookies", "cors", "robots"],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-technology",
    name: "Technology Discovery",
    description: "Identify the serving stack and version-disclosing headers.",
    modules: ["http", "technology"],
    isSystem: true,
    createdAt: null,
  },
  {
    id: "system-compliance",
    name: "Compliance Scan",
    description:
      "Evidence-oriented scan across transport, headers, cookies, CORS and exposure.",
    modules: [
      "http",
      "headers",
      "tls",
      "cookies",
      "cors",
      "robots",
      "ports",
      "compliance",
    ],
    isSystem: true,
    createdAt: null,
  },
];

function profileScope(scope: TenantScope) {
  if (scope.organizationId) {
    return or(
      eq(scanProfile.organizationId, scope.organizationId),
      and(
        isNull(scanProfile.organizationId),
        eq(scanProfile.userId, scope.userId),
      ),
    );
  }
  return and(
    isNull(scanProfile.organizationId),
    eq(scanProfile.userId, scope.userId),
  );
}

export function sanitizeModules(values: readonly string[]): ScanModule[] {
  const allowed = new Set<string>(SCAN_MODULES);
  return Array.from(new Set(values.filter((value) => allowed.has(value)))) as ScanModule[];
}

function toSummary(row: typeof scanProfile.$inferSelect): ScanProfileSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    modules: sanitizeModules(row.modules as string[]),
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScanProfiles(
  scope: TenantScope,
): Promise<ScanProfileSummary[]> {
  const rows = await db
    .select()
    .from(scanProfile)
    .where(profileScope(scope))
    .orderBy(desc(scanProfile.createdAt));

  return [...SYSTEM_SCAN_PROFILES, ...rows.map(toSummary)];
}

export async function getScanProfile(
  scope: TenantScope,
  id: string,
): Promise<ScanProfileSummary | null> {
  const system = SYSTEM_SCAN_PROFILES.find((profile) => profile.id === id);
  if (system) return system;

  const [row] = await db
    .select()
    .from(scanProfile)
    .where(and(eq(scanProfile.id, id), profileScope(scope)))
    .limit(1);

  return row ? toSummary(row) : null;
}

export async function resolveScanProfile(
  scope: TenantScope,
  id?: string | null,
): Promise<ScanProfileSummary> {
  if (id) {
    const profile = await getScanProfile(scope, id);
    if (profile) return profile;
  }

  return (
    SYSTEM_SCAN_PROFILES.find(
      (profile) => profile.id === DEFAULT_SCAN_PROFILE_ID,
    ) ?? SYSTEM_SCAN_PROFILES[0]
  );
}

export async function createScanProfile(
  scope: TenantScope,
  input: CreateScanProfileInput,
): Promise<ScanProfileSummary> {
  const modules = sanitizeModules(input.modules);
  if (modules.length === 0) {
    throw new Error("Choose at least one scan module.");
  }

  const [row] = await db
    .insert(scanProfile)
    .values({
      id: crypto.randomUUID(),
      userId: scope.userId,
      organizationId: scope.organizationId,
      name: input.name,
      description: input.description ?? null,
      modules,
      isSystem: false,
    })
    .returning();

  return toSummary(row);
}

export async function updateScanProfile(
  scope: TenantScope,
  id: string,
  input: CreateScanProfileInput,
): Promise<ScanProfileSummary | null> {
  if (SYSTEM_SCAN_PROFILES.some((profile) => profile.id === id)) {
    throw new Error("Built-in profiles cannot be edited.");
  }

  const modules = sanitizeModules(input.modules);
  if (modules.length === 0) {
    throw new Error("Choose at least one scan module.");
  }

  const [row] = await db
    .update(scanProfile)
    .set({
      name: input.name,
      description: input.description ?? null,
      modules,
      updatedAt: new Date(),
    })
    .where(and(eq(scanProfile.id, id), profileScope(scope)))
    .returning();

  return row ? toSummary(row) : null;
}

export async function deleteScanProfile(
  scope: TenantScope,
  id: string,
): Promise<boolean> {
  if (SYSTEM_SCAN_PROFILES.some((profile) => profile.id === id)) {
    throw new Error("Built-in profiles cannot be deleted.");
  }

  const deleted = await db
    .delete(scanProfile)
    .where(and(eq(scanProfile.id, id), profileScope(scope)))
    .returning({ id: scanProfile.id });

  return deleted.length > 0;
}
