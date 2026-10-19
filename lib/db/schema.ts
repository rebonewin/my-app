import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                            Better Auth core tables                         */
/* -------------------------------------------------------------------------- */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /* Enterprise extensions */
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    role: text("role").default("customer").notNull(),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    lastLoginMethod: text("last_login_method"),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").default(false),
    locale: varchar("locale", { length: 16 }).default("en").notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    jobTitle: text("job_title"),
    department: text("department"),
  },
  (table) => [index("user_email_idx").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /* Enterprise extensions */
    impersonatedBy: text("impersonated_by"),
    activeOrganizationId: text("active_organization_id"),
    deviceId: text("device_id"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/**
 * Required when `rateLimit.storage` is `"database"`. Better Auth writes one row
 * per rate-limit key and increments `count` in place.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    count: integer("count").default(0).notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).default(0).notNull(),
  },
  (table) => [uniqueIndex("rate_limit_key_idx").on(table.key)],
);

/* -------------------------------------------------------------------------- */
/*                           Better Auth plugin tables                        */
/* -------------------------------------------------------------------------- */

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_id_idx").on(table.userId),
  ],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_idx").on(table.credentialID),
  ],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    metadata: text("metadata"),
    /* Enterprise extensions */
    plan: varchar("plan", { length: 32 }).default("free").notNull(),
    billingEmail: text("billing_email"),
    seats: integer("seats").default(5).notNull(),
    securityPolicy: jsonb("security_policy"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("organization_slug_idx").on(table.slug)],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("member_organization_id_idx").on(table.organizationId),
    index("member_user_id_idx").on(table.userId),
    uniqueIndex("member_org_user_idx").on(table.organizationId, table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("invitation_organization_id_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(60000),
    rateLimitMax: integer("rate_limit_max").default(120),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_config_id_idx").on(table.configId),
    index("apikey_reference_id_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

/* -------------------------------------------------------------------------- */
/*                         Enterprise security tables                         */
/* -------------------------------------------------------------------------- */

/**
 * Canonical role definitions. `user.role` and `member.role` store the slug.
 * Seeded in lib/rbac/seed.ts and enforced by lib/rbac/permissions.ts.
 */
export const role = pgTable(
  "role",
  {
    id: text("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    scope: varchar("scope", { length: 16 }).default("organization").notNull(),
    rank: integer("rank").default(0).notNull(),
    isSystem: boolean("is_system").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("role_slug_idx").on(table.slug)],
);

export const permission = pgTable(
  "permission",
  {
    id: text("id").primaryKey(),
    key: varchar("key", { length: 96 }).notNull().unique(),
    resource: varchar("resource", { length: 48 }).notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 48 }).default("general").notNull(),
  },
  (table) => [uniqueIndex("permission_key_idx").on(table.key)],
);

export const rolePermission = pgTable(
  "role_permission",
  {
    id: text("id").primaryKey(),
    roleSlug: varchar("role_slug", { length: 64 })
      .notNull()
      .references(() => role.slug, { onDelete: "cascade" }),
    permissionKey: varchar("permission_key", { length: 96 })
      .notNull()
      .references(() => permission.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("role_permission_unique_idx").on(
      table.roleSlug,
      table.permissionKey,
    ),
    index("role_permission_role_idx").on(table.roleSlug),
  ],
);

export const device = pgTable(
  "device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    name: text("name"),
    browser: text("browser"),
    browserVersion: text("browser_version"),
    os: text("os"),
    osVersion: text("os_version"),
    deviceType: varchar("device_type", { length: 24 }).default("desktop"),
    trusted: boolean("trusted").default(false).notNull(),
    trustedUntil: timestamp("trusted_until", { withTimezone: true }),
    lastIp: text("last_ip"),
    lastCountry: varchar("last_country", { length: 8 }),
    lastCity: text("last_city"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("device_user_fingerprint_idx").on(
      table.userId,
      table.fingerprint,
    ),
    index("device_user_id_idx").on(table.userId),
  ],
);

export const trustedDevice = pgTable(
  "trusted_device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("trusted_device_token_idx").on(table.token),
    index("trusted_device_user_id_idx").on(table.userId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    actorRole: varchar("actor_role", { length: 64 }),
    action: varchar("action", { length: 96 }).notNull(),
    category: varchar("category", { length: 48 }).default("general").notNull(),
    severity: varchar("severity", { length: 16 }).default("info").notNull(),
    resourceType: varchar("resource_type", { length: 48 }),
    resourceId: text("resource_id"),
    organizationId: text("organization_id"),
    description: text("description"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    success: boolean("success").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_created_idx").on(table.createdAt),
    index("audit_log_org_idx").on(table.organizationId),
    index("audit_log_category_idx").on(table.category),
  ],
);

export const loginHistory = pgTable(
  "login_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    method: varchar("method", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    failureReason: text("failure_reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    browser: text("browser"),
    os: text("os"),
    deviceType: varchar("device_type", { length: 24 }),
    country: varchar("country", { length: 8 }),
    region: text("region"),
    city: text("city"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    isVpn: boolean("is_vpn").default(false),
    isTor: boolean("is_tor").default(false),
    isProxy: boolean("is_proxy").default(false),
    isBot: boolean("is_bot").default(false),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("login_history_user_id_idx").on(table.userId),
    index("login_history_email_idx").on(table.email),
    index("login_history_created_idx").on(table.createdAt),
    index("login_history_status_idx").on(table.status),
  ],
);

export const securityEvent = pgTable(
  "security_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 16 }).default("medium").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    country: varchar("country", { length: 8 }),
    city: text("city"),
    riskScore: integer("risk_score").default(0).notNull(),
    status: varchar("status", { length: 16 }).default("open").notNull(),
    actionTaken: varchar("action_taken", { length: 32 }).default("logged"),
    metadata: jsonb("metadata"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("security_event_user_id_idx").on(table.userId),
    index("security_event_type_idx").on(table.type),
    index("security_event_created_idx").on(table.createdAt),
    index("security_event_status_idx").on(table.status),
  ],
);

export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    ipAddress: text("ip_address").notNull(),
    success: boolean("success").default(false).notNull(),
    method: varchar("method", { length: 32 }).default("password").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("login_attempt_identifier_idx").on(table.identifier),
    index("login_attempt_ip_idx").on(table.ipAddress),
    index("login_attempt_created_idx").on(table.createdAt),
  ],
);

export const recoveryCode = pgTable(
  "recovery_code",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("recovery_code_user_id_idx").on(table.userId)],
);

/**
 * Per-user / per-organization security policy overrides.
 * When `organizationId` is null the row is the user's own preference.
 */
export const securitySetting = pgTable(
  "security_setting",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    requireMfa: boolean("require_mfa").default(false).notNull(),
    requirePasskey: boolean("require_passkey").default(false).notNull(),
    sessionTimeoutMinutes: integer("session_timeout_minutes")
      .default(10080)
      .notNull(),
    idleTimeoutMinutes: integer("idle_timeout_minutes").default(60).notNull(),
    maxConcurrentSessions: integer("max_concurrent_sessions")
      .default(10)
      .notNull(),
    maxDevices: integer("max_devices").default(10).notNull(),
    singleSession: boolean("single_session").default(false).notNull(),
    passwordMinLength: integer("password_min_length").default(12).notNull(),
    passwordRequireComplexity: boolean("password_require_complexity")
      .default(true)
      .notNull(),
    passwordHistoryCount: integer("password_history_count")
      .default(5)
      .notNull(),
    passwordMaxAgeDays: integer("password_max_age_days").default(0).notNull(),
    lockoutThreshold: integer("lockout_threshold").default(5).notNull(),
    lockoutDurationMinutes: integer("lockout_duration_minutes")
      .default(15)
      .notNull(),
    ipAllowlist: jsonb("ip_allowlist"),
    allowedEmailDomains: jsonb("allowed_email_domains"),
    trustedProxies: jsonb("trusted_proxies"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("security_setting_user_idx").on(table.userId),
    index("security_setting_org_idx").on(table.organizationId),
  ],
);

/** Geo/ASN cache for threat-intel lookups, avoids hammering the provider. */
export const ipIntel = pgTable(
  "ip_intel",
  {
    ip: text("ip").primaryKey(),
    country: varchar("country", { length: 8 }),
    region: text("region"),
    city: text("city"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    asn: text("asn"),
    org: text("org"),
    isVpn: boolean("is_vpn").default(false).notNull(),
    isTor: boolean("is_tor").default(false).notNull(),
    isProxy: boolean("is_proxy").default(false).notNull(),
    isDatacenter: boolean("is_datacenter").default(false).notNull(),
    riskScore: integer("risk_score").default(0).notNull(),
    raw: jsonb("raw"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

/**
 * Persisted assessment runs. The scanner previously returned results and threw
 * them away; storing them makes the dashboard, reports and history real rather
 * than placeholder numbers.
 */
export const scan = pgTable(
  "scan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    target: text("target").notNull(),
    hostname: text("hostname"),
    status: varchar("status", { length: 16 }).default("running").notNull(),
    riskLevel: varchar("risk_level", { length: 16 }).default("unknown"),
    riskScore: integer("risk_score").default(0).notNull(),
    findingCount: integer("finding_count").default(0).notNull(),
    highCount: integer("high_count").default(0).notNull(),
    mediumCount: integer("medium_count").default(0).notNull(),
    lowCount: integer("low_count").default(0).notNull(),
    results: jsonb("results"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("scan_user_id_idx").on(table.userId),
    index("scan_organization_id_idx").on(table.organizationId),
    index("scan_created_idx").on(table.createdAt),
    index("scan_status_idx").on(table.status),
  ],
);

export const securityAlert = pgTable(
  "security_alert",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id"),
    eventId: text("event_id"),
    channel: varchar("channel", { length: 24 }).default("in_app").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    severity: varchar("severity", { length: 16 }).default("medium").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("security_alert_user_idx").on(table.userId),
    index("security_alert_created_idx").on(table.createdAt),
  ],
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Organization = typeof organization.$inferSelect;
export type Member = typeof member.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type LoginHistory = typeof loginHistory.$inferSelect;
export type SecurityEvent = typeof securityEvent.$inferSelect;
export type Device = typeof device.$inferSelect;
export type ApiKey = typeof apikey.$inferSelect;
