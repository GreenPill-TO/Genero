#!/usr/bin/env node

import { readFileSync } from "node:fs";
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
  "shared/utils/**/*.ts",
  "shared/utils/**/*.tsx",
  "app/api/**/*.ts",
  "app/api/**/*.tsx",
];

const allowlist = new Set([
  "app/api/send_otp/route.ts",
  "app/api/verify_otp/route.ts",
  "shared/api/services/contractManagementService.ts",
]);

function listFiles() {
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
    .filter((file) => !allowlist.has(file));
}

const matcher = /\bsupabase\s*\.\s*(from|rpc)\s*\(/g;
const violations = [];

for (const file of listFiles()) {
  const absolutePath = path.join(repoRoot, file);
  const source = readFileSync(absolutePath, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (matcher.test(line)) {
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
    matcher.lastIndex = 0;
  });
}

if (violations.length > 0) {
  console.error("Direct Supabase DB access is not allowed in app-facing code:");
  violations.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

console.log("No direct Supabase DB access found in guarded app-facing paths.");
