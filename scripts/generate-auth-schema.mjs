/**
 * One-shot schema generation helper.
 *
 * The Better Auth CLI loads the auth config through jiti, which cannot resolve
 * the `server-only` package. This script temporarily comments those imports
 * out, runs `auth generate`, and always restores the original files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "lib/email/index.ts",
  "lib/audit/index.ts",
  "lib/security/ip-intel.ts",
  "lib/security/threat-detection.ts",
  "lib/security/user-agent.ts",
];

const originals = new Map();

for (const file of FILES) {
  const source = readFileSync(file, "utf8");
  originals.set(file, source);
  if (source.includes('import "server-only";')) {
    writeFileSync(
      file,
      source.replace('import "server-only";', '// import "server-only";'),
    );
    console.log("stripped", file);
  }
}

let exitCode = 0;
try {
  execFileSync(
    "npx",
    [
      "--yes",
      "auth@latest",
      "generate",
      "--config",
      "lib/auth.ts",
      "--output",
      "lib/db/auth-schema.generated.ts",
      "--yes",
    ],
    { encoding: "utf8", stdio: "pipe" },
  );
  console.log("GENERATE_OK");
} catch (error) {
  exitCode = 1;
  const fs = await import("node:fs");
  fs.writeFileSync("generate-error.log", String(error.stdout ?? ""));
  fs.appendFileSync("generate-error.log", String(error.stderr ?? ""));
  console.error("see generate-error.log");
} finally {
  for (const [file, source] of originals) {
    writeFileSync(file, source);
    console.log("restored", file);
  }
}

process.exit(exitCode);
