const base = "http://localhost:3000";
const email = `smoke+${Date.now()}@1security.test`;
const password = "Sm0ke-Test-Passw0rd!2026";
const jar = new Map();
function cookieHeader() { return [...jar.entries()].map(([k,v]) => `${k}=${v}`).join("; "); }
function capture(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
async function call(path, init = {}) {
  const res = await fetch(base + path, {
    ...init,
    headers: { origin: base, "content-type": "application/json", cookie: cookieHeader(), ...(init.headers || {}) },
    redirect: "manual",
  });
  capture(res);
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 500) };
}
(async () => {
  const signup = await call("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Smoke Tester", email, password }) });
  console.log("signup:", signup.status, signup.body);
  const session = await call("/api/auth/get-session");
  console.log("session:", session.status, session.body);
  const signout = await call("/api/auth/sign-out", { method: "POST", body: "{}" });
  console.log("signout:", signout.status, signout.body);
  const after = await call("/api/auth/get-session");
  console.log("session after signout:", after.status, after.body);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
