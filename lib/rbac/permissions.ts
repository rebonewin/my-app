/**
 * 1Security Enterprise RBAC
 * ---------------------------------------------------------------------------
 * Single source of truth for roles, permissions and the permission matrix.
 *
 * Two scopes exist:
 *  - `platform` roles live on `user.role`      (super_admin, platform_admin)
 *  - `organization` roles live on `member.role` (owner, admin, soc_analyst, ...)
 *
 * `customer`, `read_only` and `guest` are valid in both scopes.
 *
 * Permission keys are `resource:action`. A role may hold `resource:*` to grant
 * every action on a resource, or `*` for unrestricted platform access.
 */

export const PERMISSIONS = {
  // ---- identity ----
  "user:read": "View users",
  "user:create": "Create users",
  "user:update": "Update user profiles",
  "user:delete": "Delete users",
  "user:invite": "Invite users",
  "user:ban": "Ban / unban users",
  "user:impersonate": "Impersonate users",
  "user:set-role": "Change a user's role",
  "user:set-password": "Reset a user's password",
  "user:export": "Export user data",

  // ---- sessions & devices ----
  "session:read": "View sessions",
  "session:revoke": "Revoke a session",
  "session:revoke-all": "Revoke all sessions for a user",
  "device:read": "View devices",
  "device:revoke": "Revoke / untrust a device",

  // ---- organizations ----
  "organization:read": "View organizations",
  "organization:create": "Create organizations",
  "organization:update": "Update organization settings",
  "organization:delete": "Delete organizations",
  "organization:transfer": "Transfer organization ownership",
  "organization:billing": "Manage organization billing",

  // ---- membership ----
  "member:read": "View members",
  "member:invite": "Invite members",
  "member:remove": "Remove members",
  "member:update-role": "Change member roles",

  // ---- roles ----
  "role:read": "View roles",
  "role:assign": "Assign roles",
  "role:create": "Create custom roles",
  "role:update": "Update custom roles",
  "role:delete": "Delete custom roles",

  // ---- scanning ----
  "scanner:read": "View scans",
  "scanner:start": "Start scans",
  "scanner:stop": "Stop scans",
  "scanner:delete": "Delete scans",
  "scanner:configure": "Configure scan profiles",

  // ---- reports ----
  "report:read": "View reports",
  "report:create": "Create reports",
  "report:download": "Download reports",
  "report:delete": "Delete reports",
  "report:share": "Share reports externally",

  // ---- api keys ----
  "api_key:read": "View API keys",
  "api_key:create": "Create API keys",
  "api_key:revoke": "Revoke API keys",
  "api_key:rotate": "Rotate API keys",

  // ---- audit & compliance ----
  "audit:read": "View audit logs",
  "audit:export": "Export audit logs",
  "audit:delete": "Purge audit logs",

  // ---- security operations ----
  "security:read": "View security events",
  "security:resolve": "Resolve security events",
  "security:dismiss": "Dismiss security events",
  "security:block": "Block IPs / users",
  "security:policy": "Manage security policy",

  // ---- platform ----
  "dashboard:read": "View dashboards",
  "dashboard:admin": "View platform admin dashboard",
  "settings:read": "View settings",
  "settings:update": "Update settings",
  "settings:integrations": "Manage integrations",
  "billing:read": "View billing",
  "billing:manage": "Manage billing",
  "ai:read": "View AI insights",
  "ai:use": "Use AI features",
  "ai:configure": "Configure AI features",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_LIST = Object.keys(PERMISSIONS) as Permission[];

/**
 * Permissions that only ever apply to the whole platform.
 *
 * Organization roles legitimately hold tenant-wide rights (invite members,
 * revoke tenant sessions), and `getAuthContext` unions the platform role with
 * the active organization role so those pages work. That union must never
 * escalate into platform administration: an organization owner is not a
 * platform administrator. These permissions are therefore always evaluated
 * against the caller's *platform* role only.
 */
export const PLATFORM_ONLY_PERMISSIONS: ReadonlySet<string> = new Set([
  "user:read",
  "user:create",
  "user:update",
  "user:delete",
  "user:invite",
  "user:set-role",
  "user:set-password",
  "user:ban",
  "user:impersonate",
  "user:export",
  "dashboard:admin",
  "audit:delete",
]);

export function isPlatformOnlyPermission(permission: string): boolean {
  return PLATFORM_ONLY_PERMISSIONS.has(permission);
}

/* -------------------------------------------------------------------------- */
/*                                   Roles                                    */
/* -------------------------------------------------------------------------- */

export type RoleSlug =
  | "super_admin"
  | "platform_admin"
  | "owner"
  | "admin"
  | "security_manager"
  | "soc_manager"
  | "soc_analyst"
  | "pentester"
  | "red_team"
  | "blue_team"
  | "developer"
  | "devops"
  | "security_auditor"
  | "compliance_officer"
  | "customer"
  | "read_only"
  | "guest";

export type RoleScope = "platform" | "organization" | "both";

export interface RoleDefinition {
  slug: RoleSlug;
  name: string;
  description: string;
  scope: RoleScope;
  /** Higher rank = more authority. Used for privilege-escalation guards. */
  rank: number;
  permissions: Permission[];
}

const ALL = PERMISSION_LIST;

const ORG_READ = [
  "organization:read",
  "member:read",
  "role:read",
  "dashboard:read",
  "scanner:read",
  "report:read",
  "audit:read",
  "security:read",
  "settings:read",
  "billing:read",
] as const satisfies readonly Permission[];

const ANALYST_CORE = [
  ...ORG_READ,
  "report:download",
  "ai:read",
  "ai:use",
] as const satisfies readonly Permission[];

const SOC_CORE = [
  ...ANALYST_CORE,
  "security:resolve",
  "security:dismiss",
  "security:block",
  "session:read",
  "session:revoke",
  "device:read",
  "audit:export",
] as const satisfies readonly Permission[];

export const ROLES: Record<RoleSlug, RoleDefinition> = {
  super_admin: {
    slug: "super_admin",
    name: "Super Admin",
    description:
      "Unrestricted platform access. Reserved for the founding security team.",
    scope: "platform",
    rank: 100,
    permissions: ALL,
  },
  platform_admin: {
    slug: "platform_admin",
    name: "Platform Admin",
    description:
      "Full platform administration except destructive tenant operations.",
    scope: "platform",
    rank: 90,
    permissions: ALL.filter((p) => p !== "audit:delete"),
  },
  owner: {
    slug: "owner",
    name: "Organization Owner",
    description:
      "Owns the organization. Can transfer ownership, delete the tenant and manage billing.",
    scope: "organization",
    rank: 80,
    permissions: [
      ...ORG_READ,
      ...SOC_CORE,
      "organization:update",
      "organization:delete",
      "organization:transfer",
      "organization:billing",
      "member:invite",
      "member:remove",
      "member:update-role",
      "role:assign",
      "user:invite",
      "user:read",
      "user:update",
      "user:export",
      "session:revoke-all",
      "device:revoke",
      "scanner:start",
      "scanner:stop",
      "scanner:delete",
      "scanner:configure",
      "report:create",
      "report:delete",
      "report:share",
      "api_key:read",
      "api_key:create",
      "api_key:revoke",
      "api_key:rotate",
      "audit:export",
      "security:policy",
      "settings:update",
      "settings:integrations",
      "billing:manage",
      "ai:configure",
    ],
  },
  admin: {
    slug: "admin",
    name: "Organization Admin",
    description:
      "Administers the tenant: members, roles, scanners, reports and integrations.",
    scope: "organization",
    rank: 70,
    permissions: [
      ...SOC_CORE,
      "organization:update",
      "member:invite",
      "member:remove",
      "member:update-role",
      "role:assign",
      "user:invite",
      "user:read",
      "user:update",
      "session:revoke-all",
      "device:revoke",
      "scanner:start",
      "scanner:stop",
      "scanner:delete",
      "scanner:configure",
      "report:create",
      "report:delete",
      "report:share",
      "api_key:read",
      "api_key:create",
      "api_key:revoke",
      "api_key:rotate",
      "settings:update",
      "settings:integrations",
      "security:policy",
      "ai:configure",
    ],
  },
  security_manager: {
    slug: "security_manager",
    name: "Security Manager",
    description:
      "Owns the security programme. Sets policy, reviews findings, approves exceptions.",
    scope: "organization",
    rank: 60,
    permissions: [
      ...SOC_CORE,
      "user:read",
      "user:update",
      "user:ban",
      "session:revoke-all",
      "device:revoke",
      "scanner:start",
      "scanner:stop",
      "scanner:configure",
      "report:create",
      "report:delete",
      "report:share",
      "api_key:read",
      "api_key:create",
      "api_key:revoke",
      "security:policy",
      "settings:update",
      "ai:configure",
    ],
  },
  soc_manager: {
    slug: "soc_manager",
    name: "SOC Manager",
    description:
      "Runs the SOC: triages escalations, manages analysts and response playbooks.",
    scope: "organization",
    rank: 55,
    permissions: [
      ...SOC_CORE,
      "user:read",
      "session:revoke-all",
      "device:revoke",
      "scanner:start",
      "scanner:stop",
      "report:create",
      "report:share",
      "security:policy",
      "ai:configure",
    ],
  },
  soc_analyst: {
    slug: "soc_analyst",
    name: "SOC Analyst",
    description:
      "Monitors alerts, triages security events and investigates sessions.",
    scope: "organization",
    rank: 45,
    permissions: [...SOC_CORE, "scanner:start", "report:create"],
  },
  pentester: {
    slug: "pentester",
    name: "Pentester",
    description:
      "Runs authorised assessments, creates findings and exports reports.",
    scope: "organization",
    rank: 45,
    permissions: [
      ...ANALYST_CORE,
      "scanner:start",
      "scanner:stop",
      "scanner:delete",
      "scanner:configure",
      "report:create",
      "report:share",
      "api_key:read",
      "api_key:create",
    ],
  },
  red_team: {
    slug: "red_team",
    name: "Red Team",
    description:
      "Offensive operator. Full scanner control, restricted audit visibility.",
    scope: "organization",
    rank: 45,
    permissions: [
      ...ANALYST_CORE,
      "scanner:start",
      "scanner:stop",
      "scanner:delete",
      "scanner:configure",
      "report:create",
      "api_key:read",
      "api_key:create",
    ],
  },
  blue_team: {
    slug: "blue_team",
    name: "Blue Team",
    description:
      "Defensive operator. Investigates and remediates security events.",
    scope: "organization",
    rank: 45,
    permissions: [
      ...SOC_CORE,
      "report:create",
    ],
  },
  developer: {
    slug: "developer",
    name: "Developer",
    description:
      "Fixes findings. Read access to scans and reports, no security policy control.",
    scope: "organization",
    rank: 30,
    permissions: [
      ...ANALYST_CORE,
      "report:create",
      "api_key:read",
      "api_key:create",
    ],
  },
  devops: {
    slug: "devops",
    name: "DevOps",
    description:
      "Runs infrastructure and CI. Manages integrations and API keys.",
    scope: "organization",
    rank: 35,
    permissions: [
      ...ANALYST_CORE,
      "scanner:start",
      "scanner:stop",
      "report:create",
      "api_key:read",
      "api_key:create",
      "api_key:revoke",
      "api_key:rotate",
      "settings:integrations",
    ],
  },
  security_auditor: {
    slug: "security_auditor",
    name: "Security Auditor",
    description:
      "Independent assurance. Full read access plus audit export, no mutations.",
    scope: "organization",
    rank: 40,
    permissions: [
      ...ORG_READ,
      "report:download",
      "audit:export",
      "session:read",
      "device:read",
      "user:export",
    ],
  },
  compliance_officer: {
    slug: "compliance_officer",
    name: "Compliance Officer",
    description:
      "Evidence gathering for SOC 2 / ISO 27001. Audit and report read access.",
    scope: "organization",
    rank: 40,
    permissions: [
      ...ORG_READ,
      "report:download",
      "audit:export",
      "user:export",
      "billing:read",
    ],
  },
  customer: {
    slug: "customer",
    name: "Customer",
    description:
      "Tenant customer. Can run scans and read their own reports.",
    scope: "both",
    rank: 20,
    permissions: [
      "organization:read",
      "organization:create",
      "dashboard:read",
      "scanner:read",
      "scanner:start",
      "report:read",
      "report:download",
      "report:create",
      // Self-service security controls are available to every principal.
      "settings:read",
      "settings:update",
      "session:read",
      "session:revoke",
      "device:read",
      "device:revoke",
      "security:read",
      "api_key:read",
      "api_key:create",
      "api_key:revoke",
      "api_key:rotate",
      "billing:read",
      "ai:read",
      "ai:use",
    ],
  },
  read_only: {
    slug: "read_only",
    name: "Read Only",
    description: "View-only access to dashboards, scans and reports.",
    scope: "both",
    rank: 10,
    permissions: [
      "organization:read",
      "dashboard:read",
      "scanner:read",
      "report:read",
      "settings:read",
      "settings:update",
      "session:read",
      "session:revoke",
      "device:read",
      "device:revoke",
      "security:read",
    ],
  },
  guest: {
    slug: "guest",
    name: "Guest",
    description: "Minimal access. Landing dashboard only.",
    scope: "both",
    rank: 0,
    permissions: ["dashboard:read"],
  },
};

export const ROLE_LIST = Object.values(ROLES);

export const ROLE_SLUGS = Object.keys(ROLES) as RoleSlug[];

/** Roles that may be assigned inside an organization. */
export const ORGANIZATION_ROLES: RoleSlug[] = ROLE_LIST.filter(
  (r) => r.scope === "organization" || r.scope === "both",
).map((r) => r.slug);

/** Roles that may be assigned at the platform level. */
export const PLATFORM_ROLES: RoleSlug[] = ROLE_LIST.filter(
  (r) => r.scope === "platform" || r.scope === "both",
).map((r) => r.slug);

export const DEFAULT_ROLE: RoleSlug = "customer";
export const DEFAULT_ORG_ROLE: RoleSlug = "customer";

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

export function isRoleSlug(value: string | null | undefined): value is RoleSlug {
  return !!value && value in ROLES;
}

export function getRole(slug: string | null | undefined): RoleDefinition {
  if (isRoleSlug(slug)) return ROLES[slug];
  return ROLES.guest;
}

/**
 * Expand wildcards so `scanner:*` satisfies `scanner:start`.
 */
function expand(role: RoleDefinition): Set<string> {
  const set = new Set<string>();
  for (const permission of role.permissions) {
    set.add(permission);
    if ((permission as string) === "*") {
      for (const p of PERMISSION_LIST) set.add(p);
      continue;
    }
    if (permission.endsWith(":*")) {
      const resource = permission.slice(0, -1); // keep trailing colon
      for (const p of PERMISSION_LIST) {
        if (p.startsWith(resource)) set.add(p);
      }
    }
  }
  return set;
}

const roleCache = new Map<RoleSlug, Set<string>>();

export function permissionsForRole(slug: string | null | undefined): Set<string> {
  const role = getRole(slug);
  let cached = roleCache.get(role.slug);
  if (!cached) {
    cached = expand(role);
    roleCache.set(role.slug, cached);
  }
  return cached;
}

export function roleHasPermission(
  slug: string | null | undefined,
  permission: Permission,
): boolean {
  return permissionsForRole(slug).has(permission);
}

export function roleHasAnyPermission(
  slug: string | null | undefined,
  permissions: readonly Permission[],
): boolean {
  const set = permissionsForRole(slug);
  return permissions.some((p) => set.has(p));
}

export function roleHasAllPermissions(
  slug: string | null | undefined,
  permissions: readonly Permission[],
): boolean {
  const set = permissionsForRole(slug);
  return permissions.every((p) => set.has(p));
}

/**
 * A user holds the union of their platform role and their active
 * organization role. This mirrors the authorization model used by the API.
 */
export function permissionsForRoles(
  slugs: Array<string | null | undefined>,
): Set<string> {
  const set = new Set<string>();
  for (const slug of slugs) {
    for (const p of permissionsForRole(slug)) set.add(p);
  }
  return set;
}

export function hasPermission(
  roles: Array<string | null | undefined>,
  permission: Permission,
): boolean {
  return permissionsForRoles(roles).has(permission);
}

export function hasAnyPermission(
  roles: Array<string | null | undefined>,
  permissions: readonly Permission[],
): boolean {
  const set = permissionsForRoles(roles);
  return permissions.some((p) => set.has(p));
}

/** Prevents privilege escalation: you cannot assign a role at/above your rank. */
export function canAssignRole(
  actorRoles: Array<string | null | undefined>,
  targetRole: string,
): boolean {
  if (!isRoleSlug(targetRole)) return false;
  const actorRank = Math.max(
    ...actorRoles.map((r) => getRole(r).rank),
    0,
  );
  const target = ROLES[targetRole];
  if (target.rank >= actorRank) {
    // Only a super admin may hand out super admin, and only to a peer.
    return actorRoles.some((r) => getRole(r).slug === "super_admin") && target.rank <= actorRank;
  }
  return true;
}

/** Grouped permission catalog for rendering the matrix UI. */
export function groupedPermissions(): Array<{
  resource: string;
  label: string;
  items: Array<{ key: Permission; description: string }>;
}> {
  const groups = new Map<
    string,
    Array<{ key: Permission; description: string }>
  >();
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const [resource] = key.split(":");
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource)!.push({ key: key as Permission, description });
  }
  return [...groups.entries()]
    .map(([resource, items]) => ({
      resource,
      label: resource
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      items,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Full role x permission matrix, used by the admin UI and the seed script. */
export function permissionMatrix(): Array<{
  role: RoleDefinition;
  permissions: Permission[];
}> {
  return ROLE_LIST.map((role) => ({
    role,
    permissions: PERMISSION_LIST.filter((p) => roleHasPermission(role.slug, p)),
  }));
}
