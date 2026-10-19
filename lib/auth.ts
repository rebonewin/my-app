import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin,
  emailOTP,
  haveIBeenPwned,
  lastLoginMethod,
  magicLink,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  DEFAULT_ORG_ROLE,
  DEFAULT_ROLE,
  permissionsForRole,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac/permissions";
import {
  ac,
  accessRoles,
  organizationRoles,
} from "@/lib/rbac/access-control";
import {
  invitationEmail,
  isEmailConfigured,
  magicLinkEmail,
  otpEmail,
  resetPasswordEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/email";
import { recordAudit } from "@/lib/audit";
import { parseUserAgent } from "@/lib/security/user-agent";
import {
  clearFailedLogins,
  evaluateLogin,
  isAccountLocked,
  registerFailedLogin,
} from "@/lib/security/threat-detection";
import { loginAttempt, loginHistory, member, user as userTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { resolveSessionFromHeaders } from "@/lib/auth/session-lookup";

/* -------------------------------------------------------------------------- */
/*                          Endpoint permission map                           */
/* -------------------------------------------------------------------------- */

/**
 * Better Auth endpoints that are *not* self-service are gated by the same RBAC
 * matrix as pages and our own API routes. Without this, a customer could call
 * `/api/auth/api-key/create` directly and bypass the hidden button.
 *
 * Self-service endpoints (profile, password, passkeys, two-factor, session
 * listing, sign-out) are intentionally absent: every authenticated principal
 * may manage their own credentials.
 */
const AUTH_ENDPOINT_PERMISSIONS: Record<string, Permission> = {
  // API keys
  "/api-key/create": "api_key:create",
  "/api-key/list": "api_key:read",
  "/api-key/get": "api_key:read",
  "/api-key/update": "api_key:rotate",
  "/api-key/delete": "api_key:revoke",

  // Platform administration
  "/admin/list-users": "user:read",
  "/admin/get-user": "user:read",
  "/admin/create-user": "user:create",
  "/admin/update-user": "user:update",
  "/admin/set-role": "user:set-role",
  "/admin/ban-user": "user:ban",
  "/admin/unban-user": "user:ban",
  "/admin/impersonate-user": "user:impersonate",
  "/admin/stop-impersonating": "user:impersonate",
  "/admin/remove-user": "user:delete",
  "/admin/set-user-password": "user:set-password",
  "/admin/list-user-sessions": "session:read",
  "/admin/revoke-user-session": "session:revoke",
  "/admin/revoke-user-sessions": "session:revoke-all",

  // Organization administration
  "/organization/create": "organization:create",
  "/organization/update": "organization:update",
  "/organization/delete": "organization:delete",
  "/organization/invite-member": "member:invite",
  "/organization/cancel-invitation": "member:invite",
  "/organization/remove-member": "member:remove",
  "/organization/update-member-role": "member:update-role",
};

/* -------------------------------------------------------------------------- */
/*                              Provider wiring                               */
/* -------------------------------------------------------------------------- */

/**
 * Only providers with real credentials are registered. A half-configured
 * provider would render a button that always fails, which is worse than not
 * showing it. `configuredProviders` is exported so the UI can match.
 */
function socialProviders() {
  const providers: Record<
    string,
    { clientId: string; clientSecret: string; tenantId?: string }
  > = {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.microsoft = {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    };
  }
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    providers.linkedin = {
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    };
  }
  if (
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_CLIENT_SECRET &&
    process.env.APPLE_TEAM_ID
  ) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    };
  }

  return providers;
}

export const configuredProviders = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  microsoft: Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  ),
  linkedin: Boolean(
    process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET,
  ),
  apple: Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_CLIENT_SECRET &&
      process.env.APPLE_TEAM_ID,
  ),
  email: isEmailConfigured(),
  sms: Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  ),
} as const;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function baseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Extract the real client IP behind Vercel / Cloudflare / nginx. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Auth                                     */
/* -------------------------------------------------------------------------- */

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET is required. Generate one with: openssl rand -base64 32",
  );
}

export const auth = betterAuth({
  appName: "1Security",
  secret,
  baseURL: baseUrl(),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  /* ------------------------------ sessions ------------------------------ */

  session: {
    // 7 days absolute, refreshed on activity (Remember Me extends to 30d).
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Signed cookie cache avoids a DB round-trip on every request while
    // still expiring quickly enough to pick up revocation.
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
    additionalFields: {
      deviceId: { type: "string", required: false, input: false },
      lastActiveAt: {
        type: "date",
        required: false,
        input: false,
        defaultValue: () => new Date(),
      },
      revokedAt: { type: "date", required: false, input: false },
      revokedReason: { type: "string", required: false, input: false },
    },
  },

  /* ------------------------------ accounts ------------------------------ */

  account: {
    accountLinking: {
      enabled: true,
      // Only auto-link when the provider asserts the email is verified.
      trustedProviders: ["google", "github", "microsoft", "linkedin", "apple"],
    },
  },

  /* --------------------------- email + password -------------------------- */

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: isEmailConfigured(),
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your 1Security password",
        html: resetPasswordEmail(user.name ?? "", url),
      });
    },
    onPasswordReset: async ({ user }) => {
      await recordAudit({
        action: "auth.password_reset",
        category: "auth",
        severity: "high",
        actorId: user.id,
        actorEmail: user.email,
        description: "Password was reset via email link.",
        resourceType: "user",
        resourceId: user.id,
      });
    },
  },

  /* --------------------------- email verification ------------------------ */

  emailVerification: {
    sendOnSignUp: isEmailConfigured(),
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Verify your 1Security email",
        html: verificationEmail(user.name ?? "", url),
      });
    },
    afterEmailVerification: async (user) => {
      await recordAudit({
        action: "auth.email_verified",
        category: "auth",
        severity: "info",
        actorId: user.id,
        actorEmail: user.email,
        description: "Email address verified.",
        resourceType: "user",
        resourceId: user.id,
      });
    },
  },

  /* -------------------------------- social ------------------------------- */

  socialProviders: socialProviders(),

  /* -------------------------------- security ----------------------------- */

  advanced: {
    cookiePrefix: "1security",
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    // Trust the platform proxy chain; Vercel sets these correctly.
    ipAddress: {
      ipAddressHeaders: [
        "x-forwarded-for",
        "cf-connecting-ip",
        "x-real-ip",
        "x-vercel-forwarded-for",
      ],
    },
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-otp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/passkey/verify-authentication": { window: 60, max: 10 },
    },
  },

  /* ---------------------------- user model ------------------------------- */

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: DEFAULT_ROLE,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      passwordChangedAt: { type: "date", required: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
      failedLoginCount: {
        type: "number",
        required: false,
        input: false,
        defaultValue: 0,
      },
      lockedUntil: { type: "date", required: false, input: false },
      phoneNumber: { type: "string", required: false, input: false },
      phoneNumberVerified: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      locale: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "en",
      },
      timezone: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "UTC",
      },
      jobTitle: { type: "string", required: false, input: true },
      department: { type: "string", required: false, input: true },
    },
  },

  /* ---------------------------- trusted origins -------------------------- */

  trustedOrigins: [
    baseUrl(),
    process.env.NEXT_PUBLIC_SITE_URL ?? "",
    "https://1security-lemon.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : []),
  ].filter(Boolean),

  /* ------------------------------- plugins ------------------------------- */

  plugins: [
    twoFactor({
      issuer: "1Security",
      allowPasswordless: true,
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          await sendEmail({
            to: user.email,
            subject: "Your 1Security verification code",
            html: otpEmail(user.name ?? "", otp, "two-factor authentication"),
          });
        },
      },
    }),

    passkey({
      rpID:
        process.env.PASSKEY_RP_ID ??
        (process.env.NODE_ENV === "production"
          ? new URL(baseUrl()).hostname
          : "localhost"),
      rpName: "1Security",
      origin: baseUrl(),
      registration: {
        requireSession: true,
      },
    }),

    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      // Store a hash, never the plaintext code.
      storeOTP: "hashed",
      overrideDefaultEmailVerification: false,
      sendVerificationOTP: async ({ email, otp, type }) => {
        const purpose =
          type === "sign-in"
            ? "sign-in"
            : type === "email-verification"
              ? "email verification"
              : "password reset";
        await sendEmail({
          to: email,
          subject: `Your 1Security ${purpose} code`,
          html: otpEmail("", otp, purpose),
        });
      },
    }),

    magicLink({
      expiresIn: 300,
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your 1Security sign-in link",
          html: magicLinkEmail(url, new URL(baseUrl()).host),
        });
      },
    }),

    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 500,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      invitationLimit: 100,
      requireEmailVerificationOnInvitation: isEmailConfigured(),
      creatorRole: "owner",
      defaultRole: DEFAULT_ORG_ROLE,
      // Organization roles are our RBAC slugs, backed by real access roles.
      roles: organizationRoles,
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${baseUrl()}/accept-invitation/${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on 1Security`,
          html: invitationEmail({
            inviterName: data.inviter.user.name || data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
            url: inviteUrl,
          }),
        });
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization, member, user }) => {
          await recordAudit({
            action: "organization.created",
            category: "organization",
            severity: "info",
            actorId: user.id,
            actorEmail: user.email,
            organizationId: organization.id,
            resourceType: "organization",
            resourceId: organization.id,
            description: `Organization "${organization.name}" created.`,
            metadata: { slug: organization.slug, role: member.role },
          });
        },
        afterAddMember: async ({ member, user, organization }) => {
          await recordAudit({
            action: "organization.member_added",
            category: "member",
            severity: "info",
            actorId: user.id,
            actorEmail: user.email,
            organizationId: organization.id,
            resourceType: "member",
            resourceId: member.id,
            description: `${user.email} added to ${organization.name}.`,
            metadata: { role: member.role },
          });
        },
        afterRemoveMember: async ({ member, user, organization }) => {
          await recordAudit({
            action: "organization.member_removed",
            category: "member",
            severity: "medium",
            actorId: user.id,
            actorEmail: user.email,
            organizationId: organization.id,
            resourceType: "member",
            resourceId: member.id,
            description: `${user.email} removed from ${organization.name}.`,
          });
        },
        afterUpdateMemberRole: async ({
          member,
          previousRole,
          user,
          organization,
        }) => {
          await recordAudit({
            action: "organization.member_role_changed",
            category: "role",
            severity: "high",
            actorId: user.id,
            actorEmail: user.email,
            organizationId: organization.id,
            resourceType: "member",
            resourceId: member.id,
            description: `Role changed from ${previousRole} to ${member.role}.`,
            metadata: { previousRole, newRole: member.role },
          });
        },
        afterAcceptInvitation: async ({
          invitation,
          member,
          user,
          organization,
        }) => {
          await recordAudit({
            action: "organization.invitation_accepted",
            category: "member",
            severity: "info",
            actorId: user.id,
            actorEmail: user.email,
            organizationId: organization.id,
            resourceType: "invitation",
            resourceId: invitation.id,
            description: `${user.email} accepted the invitation to ${organization.name}.`,
            metadata: { role: member.role },
          });
        },
        afterCreateInvitation: async ({ invitation, inviter, organization }) => {
          await recordAudit({
            action: "organization.invitation_sent",
            category: "member",
            severity: "info",
            actorId: inviter.id,
            actorEmail: inviter.email,
            organizationId: organization.id,
            resourceType: "invitation",
            resourceId: invitation.id,
            description: `Invitation sent to ${invitation.email}.`,
            metadata: { role: invitation.role },
          });
        },
      },
    }),

    admin({
      defaultRole: DEFAULT_ROLE,
      adminRoles: ["super_admin", "platform_admin"],
      ac,
      roles: accessRoles,
      impersonationSessionDuration: 60 * 60,
      defaultBanReason: "Policy violation",
    }),

    apiKey({
      // Keys are hashed at rest; only the prefix is stored for display.
      defaultPrefix: "1sec_",
      apiKeyHeaders: ["x-api-key", "authorization"],
      rateLimit: {
        enabled: true,
        timeWindow: 60_000,
        maxRequests: 120,
      },
      enableMetadata: true,
      enableSessionForAPIKeys: false,
      // Scopes map onto the platform permission matrix and follow the owner's
      // role at creation time, so a key can never exceed its creator.
      permissions: {
        defaultPermissions: async (referenceId: string) => {
          const [owner] = await db
            .select({ role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, referenceId))
            .limit(1);

          const statements: Record<string, string[]> = {};
          for (const permission of permissionsForRole(owner?.role)) {
            const [resource, action] = permission.split(":");
            if (!resource || !action) continue;
            (statements[resource] ??= []).push(action);
          }
          return statements;
        },
      },
      maximumNameLength: 64,
      // Units verified against @better-auth/api-key: a request's `expiresIn`
      // and `defaultExpiresIn` are seconds, while `minExpiresIn` and
      // `maxExpiresIn` are days. Passing milliseconds here produced keys that
      // expired in the year 2273.
      keyExpiration: {
        defaultExpiresIn: 60 * 60 * 24 * 90, // 90 days, in seconds
        minExpiresIn: 1, // days
        maxExpiresIn: 365, // days
      },
    }),

    haveIBeenPwned(),

    lastLoginMethod({ storeInDatabase: true }),

    // MUST be last: it copies Set-Cookie headers onto Next.js responses.
    nextCookies(),
  ],

  /* ----------------------------- database hooks -------------------------- */

  databaseHooks: {
    account: {
      create: {
        after: async (createdAccount) => {
          // Email/password registration is audited by the /sign-up/email hook,
          // which has request context. This branch covers OAuth first-time
          // sign-ups, where no /sign-up/email request happens.
          if (createdAccount.providerId === "credential") return;

          const [accountUser] = await db
            .select({
              email: userTable.email,
              name: userTable.name,
            })
            .from(userTable)
            .where(eq(userTable.id, createdAccount.userId))
            .limit(1);

          await recordAudit({
            action: "auth.signup",
            category: "auth",
            severity: "info",
            actorId: createdAccount.userId,
            actorEmail: accountUser?.email ?? null,
            resourceType: "user",
            resourceId: createdAccount.userId,
            description: `New account registered via ${createdAccount.providerId}.`,
            metadata: { provider: createdAccount.providerId, name: accountUser?.name },
          });
        },
      },
    },

    session: {
      create: {
        before: async (sessionData) => {
          // Enforce lockout before any session is issued.
          const lock = await isAccountLocked(sessionData.userId);
          if (lock.locked) {
            throw new APIError("FORBIDDEN", {
              message: lock.reason
                ? `Account locked: ${lock.reason}.`
                : "Account is locked.",
            });
          }
          return { data: sessionData };
        },
        after: async (createdSession) => {
          await recordAudit({
            action: "session.created",
            category: "session",
            severity: "info",
            actorId: createdSession.userId,
            resourceType: "session",
            resourceId: createdSession.id,
            description: "New session established.",
            ipAddress: createdSession.ipAddress ?? null,
            userAgent: createdSession.userAgent ?? null,
          });

          // Universal login-history row. Password sign-in enriches this row
          // with geolocation in the /sign-in/email hook; every other method
          // (OAuth, magic link, email OTP, passkey) keeps the baseline so the
          // history is never silently empty.
          const [sessionUser] = await db
            .select({ email: userTable.email })
            .from(userTable)
            .where(eq(userTable.id, createdSession.userId))
            .limit(1);

          if (!sessionUser?.email) return;

          const parsed = parseUserAgent(createdSession.userAgent ?? null);
          await db
            .insert(loginHistory)
            .values({
              id: crypto.randomUUID(),
              userId: createdSession.userId,
              email: sessionUser.email,
              method: "session",
              status: "success",
              ipAddress: createdSession.ipAddress ?? null,
              userAgent: createdSession.userAgent ?? null,
              browser: parsed.browser,
              os: parsed.os,
              deviceType: parsed.deviceType,
              isBot: parsed.isBot,
              sessionId: createdSession.id,
            })
            .catch(() => undefined);

          await db
            .update(userTable)
            .set({
              lastLoginAt: new Date(),
              failedLoginCount: 0,
              lockedUntil: null,
            })
            .where(eq(userTable.id, createdSession.userId))
            .catch(() => undefined);

          // Bind the session to a device record so the devices page has real
          // objects to revoke. The fingerprint is the UA hash: stable per
          // browser build, and never exposed to the client.
          try {
            const fingerprint = createHash("sha256")
              .update(createdSession.userAgent ?? "unknown")
              .digest("hex")
              .slice(0, 64);

            const [bound] = await db
              .insert(schema.device)
              .values({
                id: crypto.randomUUID(),
                userId: createdSession.userId,
                fingerprint,
                name: `${parsed.browser ?? "Unknown browser"} on ${parsed.os ?? "unknown OS"}`,
                browser: parsed.browser,
                os: parsed.os,
                deviceType: parsed.deviceType,
                lastIp: createdSession.ipAddress ?? null,
                lastSeenAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [schema.device.userId, schema.device.fingerprint],
                set: {
                  lastIp: createdSession.ipAddress ?? null,
                  lastSeenAt: new Date(),
                  revokedAt: null,
                },
              })
              .returning({ id: schema.device.id });

            if (bound?.id) {
              await db
                .update(schema.session)
                .set({ deviceId: bound.id })
                .where(eq(schema.session.id, createdSession.id));
            }
          } catch {
            // Device binding is best-effort; losing it must not block sign-in.
          }
        },
      },
      delete: {
        after: async (deletedSession) => {
          const [sessionUser] = await db
            .select({ email: userTable.email })
            .from(userTable)
            .where(eq(userTable.id, deletedSession.userId))
            .limit(1)
            .catch(() => []);

          await recordAudit({
            action: "session.revoked",
            category: "session",
            severity: "info",
            actorId: deletedSession.userId,
            actorEmail: sessionUser?.email ?? null,
            resourceType: "session",
            resourceId: deletedSession.id,
            description: "Session ended.",
          });
        },
      },
    },
  },

  /* -------------------------------- hooks -------------------------------- */

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Role gate for non-self-service Better Auth endpoints.
      const requiredPermission = AUTH_ENDPOINT_PERMISSIONS[ctx.path];
      if (requiredPermission) {
        const lookup = await resolveSessionFromHeaders(ctx.headers);
        if (lookup) {
          const roles = lookup.role ? [lookup.role] : [];

          // Organization endpoints are tenant-scoped: authority over them
          // comes from the caller's membership role in the active
          // organization, not from their platform role. Without this, an
          // organization owner (whose platform role is `customer`) would be
          // blocked from inviting their own teammates. Platform endpoints
          // (admin, API keys) keep using the platform role alone, so tenant
          // authority can never escalate into platform administration.
          if (
            ctx.path.startsWith("/organization/") &&
            lookup.activeOrganizationId
          ) {
            const [membership] = await db
              .select({ role: member.role })
              .from(member)
              .where(
                and(
                  eq(member.userId, lookup.userId),
                  eq(member.organizationId, lookup.activeOrganizationId),
                ),
              )
              .limit(1);
            if (membership?.role) roles.push(membership.role);
          }

          const granted = permissionsForRoles(roles);
          if (!granted.has(requiredPermission)) {
            throw new APIError("FORBIDDEN", {
              message: "Your role does not permit this action.",
            });
          }
        }
      }

      // Enforce organization role allowlist on invitation creation.
      if (ctx.path === "/organization/invite-member") {
        const role = (ctx.body as { role?: unknown } | undefined)?.role;
        const roles = Array.isArray(role) ? role : [role];
        const allowed = new Set(Object.keys(organizationRoles));
        for (const candidate of roles) {
          if (typeof candidate === "string" && !allowed.has(candidate)) {
            throw new APIError("BAD_REQUEST", {
              message: `Unknown organization role: ${candidate}.`,
            });
          }
        }
      }

      // Block password sign-in for accounts already locked out, before we
      // spend a bcrypt verification on them.
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === "string" && email) {
          const [existing] = await db
            .select({ id: userTable.id })
            .from(userTable)
            .where(eq(userTable.email, email.toLowerCase()))
            .limit(1);

          if (existing) {
            const lock = await isAccountLocked(existing.id);
            if (lock.locked) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message: lock.reason
                  ? `Account locked: ${lock.reason}. Try again later.`
                  : "Account is locked.",
              });
            }
          }
        }
      }
    }),

    after: createAuthMiddleware(async (ctx) => {
      const ip = clientIpFromHeaders(ctx.headers ?? new Headers());
      const userAgent = ctx.headers?.get("user-agent") ?? null;
      const parsed = parseUserAgent(userAgent);

      /* --------------------------- sign-in events --------------------------- */

      if (ctx.path === "/sign-in/email") {
        const body = ctx.body as
          | { email?: string; rememberMe?: boolean }
          | undefined;
        const email = (body?.email ?? "").toLowerCase();
        const newSession = ctx.context.newSession;
        const failed = !newSession;

        if (ip) {
          await db
            .insert(loginAttempt)
            .values({
              id: crypto.randomUUID(),
              identifier: email || "unknown",
              ipAddress: ip,
              success: !failed,
              method: "password",
            })
            .catch(() => undefined);
        }

        if (failed) {
          if (email) {
            const [existing] = await db
              .select({ id: userTable.id })
              .from(userTable)
              .where(eq(userTable.email, email))
              .limit(1);

            if (existing) {
              const lock = await registerFailedLogin(existing.id);
              await db
                .insert(loginHistory)
                .values({
                  id: crypto.randomUUID(),
                  userId: existing.id,
                  email,
                  method: "password",
                  status: "failed",
                  failureReason: "Invalid credentials",
                  ipAddress: ip,
                  userAgent,
                  browser: parsed.browser,
                  os: parsed.os,
                  deviceType: parsed.deviceType,
                  isBot: parsed.isBot,
                })
                .catch(() => undefined);

              await recordAudit({
                action: "auth.login_failed",
                category: "auth",
                severity: lock.locked ? "high" : "low",
                actorId: existing.id,
                actorEmail: email,
                description: lock.locked
                  ? "Sign-in failed and the account is now locked."
                  : "Sign-in failed: invalid credentials.",
                ipAddress: ip,
                userAgent,
                success: false,
              });

              await evaluateLogin(
                {
                  userId: existing.id,
                  email,
                  ip,
                  userAgent,
                  success: false,
                  method: "password",
                },
                { parsedIsBot: parsed.isBot },
              ).catch(() => undefined);
            }
          }
          return;
        }

        /* ---------------------- successful sign-in ---------------------- */

        if (newSession) {
          await clearFailedLogins(newSession.user.id);

          const evaluation = await evaluateLogin(
            {
              userId: newSession.user.id,
              email: newSession.user.email,
              ip,
              userAgent,
              success: true,
              method: "password",
            },
            { parsedIsBot: parsed.isBot },
          ).catch(() => null);

          // The session hook inserted the baseline row; enrich it with the
          // method and the geo/risk data resolved above.
          await db
            .update(loginHistory)
            .set({
              method: "password",
              status: "success",
              ipAddress: ip,
              userAgent,
              browser: parsed.browser,
              os: parsed.os,
              deviceType: parsed.deviceType,
              country: evaluation?.ipInfo?.country ?? null,
              region: evaluation?.ipInfo?.region ?? null,
              city: evaluation?.ipInfo?.city ?? null,
              latitude: evaluation?.ipInfo?.latitude ?? null,
              longitude: evaluation?.ipInfo?.longitude ?? null,
              isVpn: evaluation?.ipInfo?.isVpn ?? false,
              isTor: evaluation?.ipInfo?.isTor ?? false,
              isProxy: evaluation?.ipInfo?.isProxy ?? false,
              isBot: parsed.isBot,
            })
            .where(eq(loginHistory.sessionId, newSession.session.id))
            .catch(() => undefined);

          await db
            .update(userTable)
            .set({ lastLoginMethod: "email" })
            .where(eq(userTable.id, newSession.user.id))
            .catch(() => undefined);

          await recordAudit({
            action: "auth.login",
            category: "auth",
            severity:
              (evaluation?.riskScore ?? 0) >= 70
                ? "high"
                : (evaluation?.riskScore ?? 0) >= 40
                  ? "medium"
                  : "info",
            actorId: newSession.user.id,
            actorEmail: newSession.user.email,
            actorRole: newSession.user.role ?? null,
            resourceType: "session",
            resourceId: newSession.session.id,
            description: "Successful password sign-in.",
            metadata: {
              method: "password",
              riskScore: evaluation?.riskScore ?? 0,
              threats: evaluation?.findings.map((f) => f.type) ?? [],
              rememberMe: body?.rememberMe ?? false,
            },
            ipAddress: ip,
            userAgent,
          });

          // A blocked verdict terminates the session we just created.
          if (evaluation?.blocked) {
            await db
              .delete(schema.session)
              .where(eq(schema.session.id, newSession.session.id))
              .catch(() => undefined);

            throw new APIError("FORBIDDEN", {
              message:
                "Sign-in blocked by security policy. Contact your administrator.",
            });
          }
        }
        return;
      }

      /* ------------------------- sign-up / verify -------------------------- */

      if (ctx.path === "/sign-up/email") {
        const newSession = ctx.context.newSession;
        await recordAudit({
          action: "auth.signup",
          category: "auth",
          severity: "info",
          actorId: newSession?.user.id ?? null,
          actorEmail:
            newSession?.user.email ??
            (ctx.body as { email?: string } | undefined)?.email ??
            null,
          description: "Account registered via email and password.",
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      if (ctx.path === "/change-password") {
        const session = ctx.context.session;
        await db
          .update(userTable)
          .set({ passwordChangedAt: new Date(), mustChangePassword: false })
          .where(eq(userTable.id, session?.user.id ?? ""))
          .catch(() => undefined);

        await recordAudit({
          action: "auth.password_changed",
          category: "auth",
          severity: "high",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          description: "Password changed from account settings.",
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      /* ------------------------------- 2FA -------------------------------- */

      if (ctx.path.startsWith("/two-factor/")) {
        const session = ctx.context.session;
        const action = ctx.path.split("/").pop() ?? "unknown";
        await recordAudit({
          action: `two_factor.${action.replace(/-/g, "_")}`,
          category: "auth",
          severity:
            action === "disable" || action === "generate-backup-codes"
              ? "high"
              : "medium",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          description: `Two-factor operation: ${action}.`,
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      /* ----------------------------- passkeys ------------------------------ */

      if (ctx.path.startsWith("/passkey/")) {
        const session = ctx.context.session;
        const action = ctx.path.split("/").pop() ?? "unknown";
        await recordAudit({
          action: `passkey.${action.replace(/-/g, "_")}`,
          category: "auth",
          severity: action === "delete-passkey" ? "high" : "medium",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          description: `Passkey operation: ${action}.`,
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      /* ----------------------------- api keys ------------------------------ */

      if (ctx.path.startsWith("/api-key/")) {
        const session = ctx.context.session;
        const action = ctx.path.split("/").pop() ?? "unknown";
        await recordAudit({
          action: `api_key.${action.replace(/-/g, "_")}`,
          category: "api_key",
          severity: action === "create" || action === "delete" ? "high" : "medium",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          description: `API key operation: ${action}.`,
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      /* ----------------------------- admin actions ------------------------- */

      if (ctx.path === "/admin/set-role") {
        const session = ctx.context.session;
        const body = ctx.body as
          | { userId?: string; role?: string | string[] }
          | undefined;
        await recordAudit({
          action: "user.role_changed",
          category: "role",
          severity: "high",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          actorRole: session?.user.role ?? null,
          resourceType: "user",
          resourceId: body?.userId ?? null,
          description: `Platform role set to ${String(body?.role ?? "unknown")}.`,
          metadata: { role: body?.role ?? null },
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      if (ctx.path === "/admin/ban-user" || ctx.path === "/admin/unban-user") {
        const session = ctx.context.session;
        const body = ctx.body as
          | { userId?: string; banReason?: string }
          | undefined;
        const banned = ctx.path === "/admin/ban-user";
        await recordAudit({
          action: banned ? "user.banned" : "user.unbanned",
          category: "user",
          severity: "high",
          actorId: session?.user.id ?? null,
          actorEmail: session?.user.email ?? null,
          actorRole: session?.user.role ?? null,
          resourceType: "user",
          resourceId: body?.userId ?? null,
          description: banned
            ? `Account banned: ${body?.banReason ?? "no reason given"}.`
            : "Account ban lifted.",
          ipAddress: ip,
          userAgent,
        });
        return;
      }

      /* --------------------------- magic link ------------------------------ */

      if (ctx.path === "/sign-in/magic-link") {
        const email = (ctx.body as { email?: string } | undefined)?.email;
        await recordAudit({
          action: "auth.magic_link_requested",
          category: "auth",
          severity: "info",
          actorEmail: email ?? null,
          description: "Magic link sign-in requested.",
          ipAddress: ip,
          userAgent,
        });
      }
    }),
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
