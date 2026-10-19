import fs from "node:fs";
import postgres from "postgres";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
  })
);
const sql = postgres(env.DIRECT_URL, { prepare: false, max: 1 });
const tables = ["audit_log", "login_history", "security_event", "device", "user", "session", "scan"];
for (const t of tables) {
  const [{ n }] = await sql.unsafe(`select count(*)::int as n from "${t}"`);
  console.log(t.padEnd(18), n);
}
const rows = await sql.unsafe(`select action, category, severity, actor_email, description from audit_log order by created_at desc limit 8`);
console.log("\nrecent audit:");
for (const r of rows) console.log(" -", r.action, "|", r.category, "|", r.severity, "|", r.actor_email, "|", (r.description ?? "").slice(0, 60));
const lh = await sql.unsafe(`select status, method, ip_address, browser, os from login_history order by created_at desc limit 5`);
console.log("\nlogin history:");
for (const r of lh) console.log(" -", r.status, r.method, r.ip_address, r.browser, r.os);

const [{ permissions }] = await sql.unsafe(`select count(*)::int as permissions from permission`);
const [{ roles }] = await sql.unsafe(`select count(*)::int as roles from role`);
const [{ links }] = await sql.unsafe(`select count(*)::int as links from role_permission`);
console.log("\nrbac catalog:", { permissions, roles, links });
const customer = await sql.unsafe(`select permission_key from role_permission where role_slug = 'customer' order by permission_key`);
console.log("customer permissions:", customer.map((r) => r.permission_key).join(", "));
const owner = await sql.unsafe(`select count(*)::int as n from role_permission where role_slug = 'owner'`);
console.log("owner permissions:", owner[0].n);
await sql.end();
