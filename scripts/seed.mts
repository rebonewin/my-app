/**
 * Seeds the RBAC catalog and the first super admin.
 *
 * The role and permission definitions are imported from
 * `lib/rbac/permissions.ts` — the same matrix that authorises pages, API routes
 * and buttons at runtime. The database rows are a published copy for
 * administration, so deriving them here makes drift impossible.
 *
 * Idempotent: safe to run on every deploy. Uses DIRECT_URL so it can hold a
 * transaction.
 *
 *   npm run seed
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import { PERMISSIONS, ROLES } from "../lib/rbac/permissions";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL required");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client);

/** Presentation grouping for the permission catalog. */
const CATEGORY_BY_RESOURCE: Record<string, string> = {
  user: "identity",
  session: "session",
  device: "session",
  organization: "organization",
  member: "organization",
  role: "rbac",
  scanner: "scanner",
  report: "report",
  api_key: "api",
  audit: "audit",
  security: "security",
  dashboard: "platform",
  settings: "platform",
  billing: "platform",
  ai: "ai",
};

function splitPermission(key: string): {
  resource: string;
  action: string;
  category: string;
} {
  const [resource, action] = key.split(":");
  return {
    resource,
    action,
    category: CATEGORY_BY_RESOURCE[resource] ?? "general",
  };
}

async function seedRbac() {
  console.log("Seeding permissions…");
  const permissionKeys = Object.keys(PERMISSIONS);

  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const { resource, action, category } = splitPermission(key);
    await db.execute(sql`
      insert into permission (id, key, resource, action, description, category)
      values (${crypto.randomUUID()}, ${key}, ${resource}, ${action}, ${description}, ${category})
      on conflict (key) do update
        set resource = excluded.resource,
            action = excluded.action,
            description = excluded.description,
            category = excluded.category
    `);
  }

  // Drop catalog rows that no longer exist in the matrix.
  await db.execute(
    sql`delete from permission where key not in (${sql.join(
      permissionKeys.map((key) => sql`${key}`),
      sql`, `,
    )})`,
  );

  console.log("Seeding roles…");
  const roles = Object.values(ROLES);

  for (const role of roles) {
    await db.execute(sql`
      insert into role (id, slug, name, description, scope, rank, is_system)
      values (
        ${crypto.randomUUID()}, ${role.slug}, ${role.name}, ${role.description},
        ${role.scope}, ${role.rank}, true
      )
      on conflict (slug) do update
        set name = excluded.name,
            description = excluded.description,
            scope = excluded.scope,
            rank = excluded.rank,
            is_system = true
    `);

    // Replace the role's permission set so removals are honoured on re-seed.
    await db.execute(sql`delete from role_permission where role_slug = ${role.slug}`);

    // A role may hold a wildcard (`*` or `scanner:*`); persist the concrete
    // permissions it expands to so the catalog is always explicit.
    const expanded = new Set<string>();
    for (const permission of role.permissions) {
      const key = permission as string;
      if (key === "*") {
        for (const entry of permissionKeys) expanded.add(entry);
        continue;
      }
      if (key.endsWith(":*")) {
        const prefix = key.slice(0, -1);
        for (const entry of permissionKeys) {
          if (entry.startsWith(prefix)) expanded.add(entry);
        }
        continue;
      }
      expanded.add(permission);
    }

    for (const key of expanded) {
      await db.execute(sql`
        insert into role_permission (id, role_slug, permission_key)
        values (${crypto.randomUUID()}, ${role.slug}, ${key})
        on conflict do nothing
      `);
    }
  }

  const unknownRoles = roles.map((role) => role.slug);
  await db.execute(
    sql`delete from role where is_system = true and slug not in (${sql.join(
      unknownRoles.map((slug) => sql`${slug}`),
      sql`, `,
    )})`,
  );

  console.log(`  ${permissionKeys.length} permissions, ${roles.length} roles`);
}

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email) {
    console.log("No SUPER_ADMIN_EMAIL set — skipping admin creation.");
    return;
  }

  const [existing] = await db.execute(
    sql`select id from "user" where email = ${email.toLowerCase()}`,
  );

  if (existing) {
    await db.execute(
      sql`update "user" set role = 'super_admin', email_verified = true where email = ${email.toLowerCase()}`,
    );
    console.log(`Promoted existing account ${email} to super_admin.`);
    return;
  }

  if (!password) {
    console.log(`SUPER_ADMIN_PASSWORD not set — cannot create ${email}.`);
    return;
  }

  // Hash with Better Auth's own scrypt parameters so sign-in works unchanged.
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await db.execute(sql`
    insert into "user" (id, name, email, email_verified, role, created_at, updated_at)
    values (${userId}, ${"Security Administrator"}, ${email.toLowerCase()}, true, 'super_admin', now(), now())
  `);

  await db.execute(sql`
    insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    values (${crypto.randomUUID()}, ${userId}, 'credential', ${userId}, ${hash}, now(), now())
  `);

  console.log(`Created super admin ${email}.`);
}

try {
  await seedRbac();
  await seedSuperAdmin();
  console.log("Seed complete.");
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
