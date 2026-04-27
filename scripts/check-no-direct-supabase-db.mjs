#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();

const targetGlobs = [
  "app/tcoin/**/*.ts",
  "app/tcoin/**/*.tsx",
  "shared/hooks/**/*.ts",
  "shared/hooks/**/*.tsx",
  "shared/api/services/**/*.ts",
  "shared/api/services/**/*.tsx",
  "shared/lib/**/*.ts",
  "shared/lib/**/*.tsx",
  "shared/utils/**/*.ts",
  "shared/utils/**/*.tsx",
  "app/api/**/*.ts",
  "app/api/**/*.tsx",
];

const allowedDirectAccess = new Map([
  [
    "shared/api/services/contractManagementService.ts",
    "temporary contract-management metadata compatibility surface; writes remain action-scoped and documented",
  ],
  [
    "shared/lib/bia/apiAuth.ts",
    "local/development auth bypass helper; guarded from production use",
  ],
  [
    "shared/lib/bia/server.ts",
    "server-side BIA/app-scope authorisation helper used behind route and edge boundaries",
  ],
  [
    "shared/lib/contracts/management/cubidSigner.ts",
    "action-time Cubid custody signer boundary; reads wallet shares only when a signed write is invoked",
  ],
  [
    "shared/lib/merchantSignup/application.ts",
    "server-side merchant onboarding mutation helper retained until merchant flows move fully behind edge functions",
  ],
  [
    "shared/lib/merchantSignup/server.ts",
    "server-side merchant onboarding read/authorisation helper retained for compatibility shims",
  ],
  [
    "shared/lib/sarafu/guards.ts",
    "server/worker Sarafu redemption guard helper; not browser/page code",
  ],
  [
    "shared/lib/sarafu/routing.ts",
    "server/worker Sarafu routing helper; not browser/page code",
  ],
  [
    "shared/lib/supabase/appInstance.ts",
    "shared app-instance resolver until app context is fully supplied by typed edge/bootstrap contracts",
  ],
  [
    "shared/lib/supabase/walletIdentities.ts",
    "read-only wallet identity view helper for app-facing consumers",
  ],
  [
    "shared/lib/vouchers/routing.ts",
    "server/worker voucher routing helper retained until voucher routing is fully RPC/edge-backed",
  ],
]);

function normalisePath(file) {
  return file.split(path.sep).join("/");
}

function matchesTargetGlob(file) {
  return targetGlobs.some((glob) => {
    const prefix = glob.slice(0, glob.indexOf("**"));
    return file.startsWith(prefix) && (file.endsWith(".ts") || file.endsWith(".tsx"));
  });
}

function listFilesWithRipgrep() {
  const args = [
    "--files",
    ...targetGlobs.flatMap((glob) => ["-g", glob]),
  ];
  const output = execFileSync("rg", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !isSkippedFile(file));
}

function walkDirectory(rootRelativePath) {
  const absoluteRoot = path.join(repoRoot, rootRelativePath);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const queue = [absoluteRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absoluteEntry = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absoluteEntry);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const relativeEntry = normalisePath(path.relative(repoRoot, absoluteEntry));
      if (!matchesTargetGlob(relativeEntry) || isSkippedFile(relativeEntry)) {
        continue;
      }
      files.push(relativeEntry);
    }
  }

  return files;
}

function listFiles() {
  try {
    return listFilesWithRipgrep();
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return [
    ...walkDirectory("app/tcoin"),
    ...walkDirectory("shared/hooks"),
    ...walkDirectory("shared/api/services"),
    ...walkDirectory("shared/lib"),
    ...walkDirectory("shared/utils"),
    ...walkDirectory("app/api"),
  ];
}

function isSkippedFile(file) {
  return (
    allowedDirectAccess.has(file) ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.tsx") ||
    file.includes("/__tests__/")
  );
}

const matcher =
  /(?:\b(?:[A-Za-z_$][\w$]*\.)?supabase|\bserviceRole|\brpcClient)\s*(?:\.\s*schema\s*\([^)]*\))?\s*\.\s*from\s*\(/g;
const violations = [];

for (const file of listFiles()) {
  const absolutePath = path.join(repoRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const lines = source.split("\n");

  for (const match of source.matchAll(matcher)) {
    const lineNumber = source.slice(0, match.index).split("\n").length;
    const line = lines[lineNumber - 1]?.trim() ?? match[0].replace(/\s+/g, " ");
    violations.push(`${file}:${lineNumber}: ${line}`);
  }
}

if (violations.length > 0) {
  console.error("Direct Supabase table access is not allowed in app-facing code:");
  violations.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

console.log(
  `No direct Supabase DB access found in guarded app-facing paths. ${allowedDirectAccess.size} documented exception paths are allowed.`
);
