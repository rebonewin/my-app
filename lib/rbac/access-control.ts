/**
 * Better Auth access-control definitions.
 *
 * The `admin` plugin validates `adminRoles` against a registered access
 * controller, so our platform role slugs must exist there. This is separate
 * from — and deliberately narrower than — the application permission matrix in
 * `permissions.ts`, which governs pages, API routes and UI actions.
 *
 * Keeping them apart means a platform admin can manage users and sessions
 * through Better Auth without implicitly gaining scanner or billing rights.
 */
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  userAc,
} from "better-auth/plugins/admin/access";
import {
  defaultAc as organizationAc,
  ownerAc as organizationOwnerAc,
  adminAc as organizationAdminAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/** Full user + session administration. */
export const superAdminRole = ac.newRole({
  ...adminAc.statements,
});

/**
 * Platform admin: everything a super admin can do except hard-deleting users.
 */
export const platformAdminRole = ac.newRole({
  user: adminAc.statements.user.filter((action) => action !== "delete"),
  session: adminAc.statements.session,
});

/** Baseline role for every self-service account. */
export const customerRole = ac.newRole({
  ...userAc.statements,
});

/** Read-only operators cannot mutate users or sessions. */
export const readOnlyRole = ac.newRole({
  user: ["get", "list"],
  session: ["list"],
});

export const guestRole = ac.newRole({
  user: [],
  session: [],
});

export const accessRoles = {
  super_admin: superAdminRole,
  platform_admin: platformAdminRole,
  customer: customerRole,
  read_only: readOnlyRole,
  guest: guestRole,
};

export type AccessRoleName = keyof typeof accessRoles;

/* -------------------------------------------------------------------------- */
/*                       Organization plugin access roles                     */
/* -------------------------------------------------------------------------- */

/**
 * The organization plugin requires a `Role` object (with statements) for every
 * value in `member.role`. The application permission matrix in `permissions.ts`
 * is the authoritative gate for pages and API routes; these statements exist so
 * the plugin can authorise its own endpoints (invite, remove, update-role).
 */

/** Members may read but not administer. */
const orgReader = organizationAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
});

/** Operational roles that coordinate response but do not administer the tenant. */
const orgOperator = organizationAc.newRole({
  organization: [],
  member: [],
  invitation: ["create", "cancel"],
  team: ["create", "update"],
  ac: ["read"],
});

export const organizationRoles = {
  owner: organizationOwnerAc,
  admin: organizationAdminAc,
  security_manager: organizationAc.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["read"],
  }),
  soc_manager: organizationAc.newRole({
    organization: ["update"],
    member: ["create", "update"],
    invitation: ["create", "cancel"],
    team: ["create", "update"],
    ac: ["read"],
  }),
  soc_analyst: orgOperator,
  pentester: orgOperator,
  red_team: orgOperator,
  blue_team: orgOperator,
  developer: orgReader,
  devops: orgOperator,
  security_auditor: orgReader,
  compliance_officer: orgReader,
  customer: orgReader,
  read_only: orgReader,
  guest: orgReader,
} as const;

export type OrganizationRoleName = keyof typeof organizationRoles;
