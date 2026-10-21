/**
 * End-to-end platform smoke test.
 *
 * Exercises the real HTTP surface against a running server: session auth,
 * RBAC enforcement, scanner, reports, devices, sessions, audit, API keys,
 * organizations, members and two-factor enrolment.
 *
 *   node --env-file=.env.local scripts/smoke-platform.mjs
 *
 * Requires SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD (seeded by scripts/seed.mjs)
 * and a server listening on SMOKE_BASE (default http://localhost:3000).
 *
 * The run creates disposable `smoke+…@1security.test` accounts and removes
 * them again in `cleanup()` (audit rows are intentionally left in place: the
 * audit trail is append-only).
 */

import postgres from "postgres";

const base = (process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");

// Each run presents a fresh test-net address. The platform's credential-
// stuffing rule blocks an IP after 5 distinct accounts in 30 minutes, which is
// correct in production but would make repeated CI runs trip their own defence.
const smokeIp = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

const results = [];
let failures = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function createClient() {
  const cookies = new Map();

  function cookieHeader() {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function capture(response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value) cookies.delete(name);
      else cookies.set(name, value);
    }
  }

  async function call(path, init = {}) {
    const headers = {
      origin: base,
      "x-forwarded-for": smokeIp,
      ...(init.headers ?? {}),
    };
    const cookie = cookieHeader();
    if (cookie) headers.cookie = cookie;
    if (init.body && !headers["content-type"] && typeof init.body === "string") {
      headers["content-type"] = "application/json";
    }

    const method = (init.method ?? "GET").toUpperCase();
    // Reads are safe to retry once; mutations are not (a request that timed
    // out may already have been applied). Bounded timeouts keep a transient
    // network stall from aborting the whole run.
    const attempts = method === "GET" ? 2 : 1;
    let response = null;
    let text = "";
    let lastError = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        response = await fetch(base + path, {
          ...init,
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(method === "GET" ? 45_000 : 120_000),
        });
        capture(response);
        text = await response.text();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }
    }

    if (!response || lastError) throw lastError ?? new Error("request failed");

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json, text, headers: response.headers };
  }

  return { call };
}

const admin = createClient();
const customer = createClient();

async function main() {
  /* ------------------------------ availability ----------------------------- */
  const home = await admin.call("/sign-in");
  check("sign-in page renders", home.status === 200, `HTTP ${home.status}`);

  /* ------------------------------- admin sign-in -------------------------- */
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    check("admin credentials present", false, "set SUPER_ADMIN_EMAIL/PASSWORD");
    return;
  }

  const adminSignIn = await admin.call("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  check(
    "super admin signs in",
    adminSignIn.status === 200 && Boolean(adminSignIn.json?.user),
    `HTTP ${adminSignIn.status} role=${adminSignIn.json?.user?.role ?? "?"}`,
  );

  const adminSession = await admin.call("/api/auth/get-session");
  check(
    "session resolves with super_admin role",
    adminSession.json?.user?.role === "super_admin",
    `role=${adminSession.json?.user?.role ?? "none"}`,
  );

  /* ------------------------------- admin pages ---------------------------- */
  for (const [path, marker] of [
    ["/dashboard", "Security posture"],
    ["/scanner", "Security scanner"],
    ["/security", "Security centre"],
    ["/reports", "Security reports"],
    ["/sessions", "Active sessions"],
    ["/devices", "Devices"],
    ["/activity", "Login activity"],
    ["/audit", "Audit log"],
    ["/api-keys", "API keys"],
    ["/organization", "Organizations"],
    ["/admin", "Administration"],
    ["/admin/users", "User management"],
    ["/settings", "Settings"],
    ["/settings/security", "Security settings"],
    ["/profile", "Account details"],
  ]) {
    const page = await admin.call(path);
    check(
      `page ${path}`,
      page.status === 200 &&
        page.text.includes(marker) &&
        !page.text.includes("__next_error__"),
      `HTTP ${page.status}${page.text.includes("__next_error__") ? " (error shell)" : ""}`,
    );
  }

  /* ------------------------------- admin APIs ----------------------------- */
  const users = await admin.call("/api/admin/users");
  check(
    "admin user list",
    users.status === 200 && (users.json?.users?.length ?? 0) >= 1,
    `${users.json?.pagination?.total ?? 0} users`,
  );

  const audit = await admin.call("/api/audit?pageSize=5");
  check(
    "audit log readable by admin",
    audit.status === 200 && (audit.json?.pagination?.total ?? 0) > 0,
    `${audit.json?.pagination?.total ?? 0} entries`,
  );

  const auditFiltered = await admin.call("/api/audit?category=auth");
  check(
    "audit category filter",
    auditFiltered.status === 200,
    `${auditFiltered.json?.pagination?.total ?? 0} auth entries`,
  );

  const devices = await admin.call("/api/devices");
  check(
    "device bound to session",
    devices.status === 200 && (devices.json?.devices?.length ?? 0) >= 1,
    `${devices.json?.devices?.length ?? 0} devices`,
  );

  const sessions = await admin.call("/api/sessions");
  check(
    "session list",
    sessions.status === 200 && (sessions.json?.sessions?.length ?? 0) >= 1,
    `${sessions.json?.sessions?.length ?? 0} sessions`,
  );

  /* ---------------------------------- scan -------------------------------- */
  const keyCreate = await admin.call("/api/auth/api-key/create", {
    method: "POST",
    // `expiresIn` is seconds; minimum allowed is one day.
    body: JSON.stringify({ name: "smoke-test", expiresIn: 30 * 86_400 }),
  });
  const apiKey = keyCreate.json?.key;
  check(
    "API key created with inherited scopes",
    keyCreate.status === 200 && typeof apiKey === "string",
    `prefix=${keyCreate.json?.prefix ?? "?"} scopes=${
      keyCreate.json?.permissions
        ? Object.keys(keyCreate.json.permissions).length
        : 0
    } resources`,
  );

  let scanId = null;
  if (apiKey) {
    const scan = await admin.call("/api/scan", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    scanId = scan.json?.scanId ?? null;
    check(
      "scan authorised by API key",
      scan.status === 200 && Boolean(scanId),
      scan.status === 200
        ? `risk=${scan.json?.riskLevel} score=${scan.json?.riskScore} findings=${scan.json?.findingCount}`
        : `HTTP ${scan.status} ${scan.json?.error ?? scan.text.slice(0, 80)}`,
    );
  }

  const keyList = await admin.call("/api/auth/api-key/list", { method: "GET" });
  check(
    "API key list",
    keyList.status === 200,
    `${keyList.json?.apiKeys?.length ?? keyList.json?.total ?? 0} keys`,
  );

  /* --------------------------------- reports ------------------------------ */
  const reports = await admin.call("/api/reports");
  check("reports API reachable", reports.status === 404, "route is page-level only");

  const reportList = await admin.call("/reports");
  check(
    "report list renders",
    reportList.status === 200 && reportList.text.includes("Security reports"),
    `HTTP ${reportList.status}`,
  );

  if (scanId) {
    const report = await admin.call(`/api/reports/${scanId}`);
    check(
      "report payload persisted",
      report.status === 200 && report.json?.report?.target === "https://example.com",
      `HTTP ${report.status}`,
    );

    const download = await admin.call(`/api/reports/${scanId}?download=1`);
    check(
      "report download",
      download.status === 200 &&
        (download.headers.get("content-disposition") ?? "").includes("attachment"),
      `HTTP ${download.status}`,
    );

    const detail = await admin.call(`/reports/${scanId}`);
    check(
      "report detail page renders evidence",
      detail.status === 200 && detail.text.includes("Security headers"),
      `HTTP ${detail.status}`,
    );
  }

  /* ---------------------------- SSRF protections -------------------------- */
  const blocked = await admin.call("/api/scan", {
    method: "POST",
    body: JSON.stringify({ url: "http://127.0.0.1:3000" }),
  });
  check(
    "private target refused",
    blocked.status === 400 || blocked.status === 403,
    `HTTP ${blocked.status} ${blocked.json?.error ?? ""}`.slice(0, 90),
  );

  const metadata = await admin.call("/api/scan", {
    method: "POST",
    body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data" }),
  });
  check(
    "cloud metadata address refused",
    metadata.status === 400 || metadata.status === 403,
    `HTTP ${metadata.status}`,
  );

  const invalid = await admin.call("/api/scan", {
    method: "POST",
    body: JSON.stringify({ url: "not-a-url" }),
  });
  check("invalid target rejected", invalid.status === 400, `HTTP ${invalid.status}`);

  /* ------------------------------- two-factor ----------------------------- */
  const totp = await admin.call("/api/auth/two-factor/enable", {
    method: "POST",
    body: JSON.stringify({ password: adminPassword }),
  });
  check(
    "TOTP enrolment generates secret",
    totp.status === 200 && typeof totp.json?.totpURI === "string",
    `codes=${totp.json?.backupCodes?.length ?? 0}`,
  );

  const passkeys = await admin.call("/api/auth/passkey/list-user-passkeys");
  check(
    "passkey list endpoint",
    passkeys.status === 200,
    `${Array.isArray(passkeys.json) ? passkeys.json.length : "?"} passkeys`,
  );

  const anonRename = await createClient().call(
    "/api/auth/passkey/update-passkey",
    {
      method: "POST",
      body: JSON.stringify({ id: "smoke-nonexistent", name: "renamed" }),
    },
  );
  check(
    "passkey rename endpoint requires a session",
    anonRename.status === 401,
    `HTTP ${anonRename.status}`,
  );

  if (totp.status === 200) {
    const disabled = await admin.call("/api/auth/two-factor/disable", {
      method: "POST",
      body: JSON.stringify({ password: adminPassword }),
    });
    check("TOTP enrolment reverted", disabled.status === 200, `HTTP ${disabled.status}`);
  }

  /* --------------------------- customer boundaries ------------------------- */
  let email = `smoke+${Date.now()}@1security.test`;
  const password = "Sm0ke-Customer-Passw0rd!2026";
  const signUp = await customer.call("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Customer", email, password }),
  });
  check(
    "customer signs up",
    signUp.status === 200 && signUp.json?.user?.role === "customer",
    `role=${signUp.json?.user?.role ?? "?"}`,
  );

  const customerId = signUp.json?.user?.id ?? "";

  /* --------------------------- per-user admin view ------------------------- */
  const profileView = await admin.call(
    `/api/admin/users/${customerId}?scope=profile`,
  );
  check(
    "admin reads per-user profile",
    profileView.status === 200 &&
      profileView.json?.user?.email === email &&
      profileView.json?.user?.role === "customer" &&
      profileView.json?.canForceLogout === true,
    `HTTP ${profileView.status}`,
  );

  const sessionsView = await admin.call(
    `/api/admin/users/${customerId}?scope=sessions`,
  );
  check(
    "admin reads per-user sessions",
    sessionsView.status === 200 &&
      (sessionsView.json?.sessions?.length ?? 0) >= 1,
    `${sessionsView.json?.sessions?.length ?? 0} sessions`,
  );

  const auditView = await admin.call(
    `/api/admin/users/${customerId}?scope=audit`,
  );
  check(
    "admin reads per-user audit history",
    auditView.status === 200 &&
      (auditView.json?.audit ?? []).some((row) => row.action === "auth.signup"),
    `${auditView.json?.audit?.length ?? 0} events`,
  );

  const customerProfileView = await customer.call(
    `/api/admin/users/${customerId}?scope=profile`,
  );
  check(
    "customer blocked from per-user admin view",
    customerProfileView.status === 403,
    `HTTP ${customerProfileView.status}`,
  );

  /* ------------------------------ email change ---------------------------- */
  const sameEmail = await customer.call("/api/account/email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  check(
    "email change rejects the current address",
    sameEmail.status === 400,
    `HTTP ${sameEmail.status}`,
  );

  const badEmail = await customer.call("/api/account/email", {
    method: "POST",
    body: JSON.stringify({ email: "not-an-address" }),
  });
  check(
    "email change validates the new address",
    badEmail.status === 400,
    `HTTP ${badEmail.status}`,
  );

  const anonEmail = await createClient().call("/api/account/email", {
    method: "POST",
    body: JSON.stringify({ email: "someone@1security.test" }),
  });
  check(
    "email change requires authentication",
    anonEmail.status === 401,
    `HTTP ${anonEmail.status}`,
  );

  const customerAdmin = await customer.call("/api/admin/users");
  check(
    "customer blocked from admin API",
    customerAdmin.status === 403,
    `HTTP ${customerAdmin.status}`,
  );

  const customerAudit = await customer.call("/api/audit");
  check(
    "customer blocked from audit API",
    customerAudit.status === 403,
    `HTTP ${customerAudit.status}`,
  );

  const customerForbidden = await customer.call("/forbidden");
  check("forbidden page renders", customerForbidden.status === 200, `HTTP ${customerForbidden.status}`);

  const customerScanIp = await customer.call("/api/scan", {
    method: "POST",
    body: JSON.stringify({ url: "http://10.0.0.1" }),
  });
  check(
    "customer scan of private range refused",
    customerScanIp.status === 400 || customerScanIp.status === 403,
    `HTTP ${customerScanIp.status}`,
  );

  const revokeAll = await customer.call("/api/sessions", {
    method: "DELETE",
    body: JSON.stringify({ all: true, keepCurrent: true }),
  });
  check(
    "revoke-all requires elevated permission",
    revokeAll.status === 403,
    `HTTP ${revokeAll.status}`,
  );

  /* ------------------------------ organizations --------------------------- */
  const orgName = `Smoke Corp ${Date.now().toString().slice(-6)}`;
  const createOrg = await customer.call("/api/organizations", {
    method: "POST",
    body: JSON.stringify({ name: orgName }),
  });
  check(
    "customer creates organization",
    createOrg.status === 201,
    `HTTP ${createOrg.status} ${createOrg.json?.error ?? ""}`.slice(0, 80),
  );

  const orgList = await customer.call("/api/organizations");
  check(
    "organization list",
    orgList.status === 200 && (orgList.json?.organizations?.length ?? 0) >= 1,
    `${orgList.json?.organizations?.length ?? 0} organizations`,
  );

  const members = await customer.call("/api/organizations/members");
  check(
    "owner sees own membership",
    members.status === 200 && (members.json?.members?.length ?? 0) === 1,
    `${members.json?.members?.length ?? 0} members`,
  );

  const membersPage = await customer.call("/organization/members");
  check(
    "members page renders",
    membersPage.status === 200 && membersPage.text.includes("Members"),
    `HTTP ${membersPage.status}`,
  );

  const teammate = `teammate+${Date.now()}@1security.test`;
  const inviteSelf = await customer.call("/api/organizations/members", {
    method: "POST",
    body: JSON.stringify({ email: teammate, role: "soc_analyst" }),
  });
  check(
    "invite created for teammate",
    inviteSelf.status === 201,
    `HTTP ${inviteSelf.status} ${inviteSelf.json?.error ?? ""}`.slice(0, 80),
  );

  /* ------------------- tenant authority must not escalate ------------------ */
  const ownerAdminApi = await customer.call("/api/admin/users");
  check(
    "org owner still blocked from platform user list",
    ownerAdminApi.status === 403,
    `HTTP ${ownerAdminApi.status}`,
  );

  const ownerAdminPage = await customer.call("/admin/users");
  const ownerDenied =
    ownerAdminPage.status === 403 ||
    ownerAdminPage.text.includes("Your role cannot open this");
  check(
    "org owner denied the platform admin page",
    ownerDenied && !ownerAdminPage.text.includes("Assign platform roles"),
    `HTTP ${ownerAdminPage.status}${ownerDenied ? " (403 boundary)" : " (leaked)"}`,
  );

  const anonymousPage = await createClient().call("/dashboard");
  check(
    "anonymous visitor redirected to sign-in",
    anonymousPage.status === 307 ||
      (anonymousPage.headers.get("location") ?? "").includes("/sign-in") ||
      anonymousPage.text.includes("Sign in"),
    `HTTP ${anonymousPage.status} -> ${anonymousPage.headers.get("location") ?? "-"}`,
  );

  const anonymousProfile = await createClient().call("/profile");
  check(
    "profile page requires authentication",
    anonymousProfile.status === 307 ||
      (anonymousProfile.headers.get("location") ?? "").includes("/sign-in"),
    `HTTP ${anonymousProfile.status} -> ${anonymousProfile.headers.get("location") ?? "-"}`,
  );

  const ownerBan = await createClient().call("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({ action: "ban", userId: "any", reason: "escalation test" }),
  });
  check(
    "unauthenticated admin mutation refused",
    ownerBan.status === 401 || ownerBan.status === 403,
    `HTTP ${ownerBan.status}`,
  );

  const ownerAuditPage = await customer.call("/audit");
  check(
    "org owner sees audit page with own scope only",
    ownerAuditPage.status === 200,
    `HTTP ${ownerAuditPage.status}`,
  );

  const ownerAuditApi = await customer.call("/api/audit");
  const ownerRows = ownerAuditApi.json?.logs ?? [];
  const ownerLeak = ownerRows.some(
    (row) => row.actorEmail && row.actorEmail !== email,
  );
  check(
    "org owner audit rows are restricted to self",
    ownerAuditApi.status === 200 && !ownerLeak,
    `${ownerRows.length} rows, leak=${ownerLeak}`,
  );

  const cancelInvite = await customer.call("/api/organizations/members", {
    method: "DELETE",
    body: JSON.stringify({ invitationId: inviteSelf.json?.invitation?.id ?? "" }),
  });
  check(
    "owner can cancel a pending invitation",
    inviteSelf.json?.invitation?.id ? cancelInvite.status === 200 : true,
    `HTTP ${cancelInvite.status}`,
  );
  /* ------------------------------ api key scope --------------------------- */
  const customerKey = await customer.call("/api/auth/api-key/create", {
    method: "POST",
    body: JSON.stringify({ name: "customer-key", expiresIn: 30 * 86_400 }),
  });
  check(
    "customer can mint a scoped key",
    customerKey.status === 200 && typeof customerKey.json?.key === "string",
    `HTTP ${customerKey.status}`,
  );

  if (customerKey.json?.key) {
    const rawKey = customerKey.json.key;
    const anonymous = createClient();
    const elevated = await anonymous.call("/api/admin/users", {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    check(
      "API key cannot exceed owner role",
      elevated.status === 401 || elevated.status === 403,
      `HTTP ${elevated.status}`,
    );

    const keyDelete = await customer.call("/api/auth/api-key/delete", {
      method: "POST",
      body: JSON.stringify({ keyId: customerKey.json.id }),
    });
    check("API key revoked", keyDelete.status === 200, `HTTP ${keyDelete.status}`);
  }

  if (keyCreate.json?.id) {
    await admin.call("/api/auth/api-key/delete", {
      method: "POST",
      body: JSON.stringify({ keyId: keyCreate.json.id }),
    });
  }

  /* ------------------------------ email change ---------------------------- */
  // End-to-end confirmation without sending mail: seed the same verification
  // row the POST handler writes, then consume it through the API. Runs after
  // the tenant-scoping checks because the address change legitimately rewrites
  // the actor email on later audit rows.
  const updatedEmail = `smoke+changed-${Date.now()}@1security.test`;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (dbUrl) {
    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      const { createHash, randomBytes, randomUUID } = await import(
        "node:crypto"
      );
      const token = randomBytes(32).toString("base64url");
      const hash = createHash("sha256").update(token).digest("hex");

      await sql`
        insert into verification (id, identifier, value, expires_at)
        values (
          ${randomUUID()},
          ${`change-email:${customerId}`},
          ${`${hash}:${updatedEmail}`},
          ${new Date(Date.now() + 3_600_000)}
        )
      `;

      const confirm = await customer.call("/api/account/email", {
        method: "PUT",
        body: JSON.stringify({ token }),
      });
      check(
        "email change consumes a valid token",
        confirm.status === 200,
        `HTTP ${confirm.status}`,
      );

      const changedProfile = await admin.call(
        `/api/admin/users/${customerId}?scope=profile`,
      );
      check(
        "email change persists and resets verification",
        changedProfile.json?.user?.email === updatedEmail &&
          changedProfile.json?.user?.emailVerified === false,
        `${changedProfile.json?.user?.email ?? "?"} verified=${changedProfile.json?.user?.emailVerified ?? "?"}`,
      );

      const changedAudit = await admin.call(
        `/api/admin/users/${customerId}?scope=audit`,
      );
      check(
        "email change is recorded in the audit trail",
        (changedAudit.json?.audit ?? []).some(
          (row) => row.action === "auth.email_changed",
        ),
        `${changedAudit.json?.audit?.length ?? 0} events`,
      );

      // Keep the disposable account usable for the remaining sign-in checks.
      await sql`update "user" set email_verified = true where id = ${customerId}`;
      email = updatedEmail;
    } finally {
      await sql.end();
    }
  }

  /* ------------------------------- sign-out ------------------------------- */
  const signOut = await customer.call("/api/auth/sign-out", {
    method: "POST",
    body: "{}",
  });
  check("sign-out", signOut.status === 200, `HTTP ${signOut.status}`);

  const afterSignOut = await customer.call("/api/auth/get-session");
  check(
    "session cleared after sign-out",
    afterSignOut.json === null || afterSignOut.json === undefined,
    `HTTP ${afterSignOut.status}`,
  );

  /* -------------------------- logout + force logout ------------------------ */
  const logoutAudit = await admin.call(
    `/api/admin/users/${customerId}?scope=audit`,
  );
  check(
    "logout is recorded in the audit trail",
    logoutAudit.status === 200 &&
      (logoutAudit.json?.audit ?? []).some(
        (row) => row.action === "auth.logout",
      ),
    `${logoutAudit.json?.audit?.length ?? 0} events`,
  );

  // A second live session proves force-logout actually revokes credentials.
  const customerTwo = createClient();
  const signInAgain = await customerTwo.call("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  check(
    "customer signs in on a second device",
    signInAgain.status === 200,
    `HTTP ${signInAgain.status}`,
  );

  const customerForceLogout = await customerTwo.call(
    `/api/admin/users/${customerId}`,
    { method: "DELETE" },
  );
  check(
    "customer cannot force-logout an account",
    customerForceLogout.status === 403,
    `HTTP ${customerForceLogout.status}`,
  );

  const forceLogout = await admin.call(`/api/admin/users/${customerId}`, {
    method: "DELETE",
  });
  check(
    "admin force-logout revokes sessions",
    forceLogout.status === 200 && (forceLogout.json?.sessionsRevoked ?? 0) >= 1,
    `HTTP ${forceLogout.status} revoked=${forceLogout.json?.sessionsRevoked ?? 0}`,
  );

  const afterForceLogout = await customerTwo.call("/api/devices");
  check(
    "force-logout clears the target session",
    afterForceLogout.status === 401,
    `HTTP ${afterForceLogout.status}`,
  );

  const forceAudit = await admin.call(
    `/api/admin/users/${customerId}?scope=audit`,
  );
  check(
    "force-logout is recorded in the audit trail",
    forceAudit.status === 200 &&
      (forceAudit.json?.audit ?? []).some(
        (row) => row.action === "user.force_logout",
      ),
    `${forceAudit.json?.audit?.length ?? 0} events`,
  );

  const adminSignOut = await admin.call("/api/auth/sign-out", {
    method: "POST",
    body: "{}",
  });
  check("admin sign-out", adminSignOut.status === 200, `HTTP ${adminSignOut.status}`);
}

main()
  .catch((error) => {
    console.error("SMOKE RUNNER ERROR", error);
    failures += 1;
  })
  .then(cleanup)
  .catch((error) => console.error("CLEANUP ERROR", error))
  .finally(() => {
    console.log(
      `\n${results.length - failures}/${results.length} checks passed${
        failures ? ` — ${failures} FAILED` : ""
      }`,
    );
    process.exit(failures ? 1 : 0);
  });

/**
 * Removes the disposable accounts this run created. Audit entries stay: the
 * audit log is append-only by design.
 */
async function cleanup() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) return;

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const users = await sql`
      select id from "user" where email like 'smoke+%@1security.test'
    `;
    if (users.length === 0) return;

    const ids = users.map((row) => row.id);
    const organizations = await sql`
      select id from organization where slug like 'smoke-corp%'
    `;
    const orgIds = organizations.map((row) => row.id);

    await sql`delete from invitation where inviter_id in ${sql(ids)} or organization_id in ${sql(orgIds)}`;
    await sql`delete from member where user_id in ${sql(ids)} or organization_id in ${sql(orgIds)}`;
    await sql`delete from session where user_id in ${sql(ids)}`;
    await sql`delete from account where user_id in ${sql(ids)}`;
    await sql`delete from two_factor where user_id in ${sql(ids)}`;
    await sql`delete from device where user_id in ${sql(ids)}`;
    await sql`delete from login_history where user_id in ${sql(ids)}`;
    await sql`delete from apikey where reference_id in ${sql(ids)}`;
    await sql`delete from organization where id in ${sql(orgIds)}`;
    await sql`delete from "user" where id in ${sql(ids)}`;

    console.log(`cleanup: removed ${ids.length} smoke account(s)`);
  } finally {
    await sql.end();
  }
}
